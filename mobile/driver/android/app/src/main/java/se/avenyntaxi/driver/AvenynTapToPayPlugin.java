package se.avenyntaxi.driver;

import android.Manifest;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.nfc.NfcAdapter;
import android.os.Build;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.stripe.stripeterminal.Terminal;
import com.stripe.stripeterminal.external.callable.*;
import com.stripe.stripeterminal.external.models.*;
import com.stripe.stripeterminal.log.LogLevel;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Card data is handled only by Stripe's native reader UI, never by the WebView. */
@CapacitorPlugin(name="AvenynTapToPay", permissions={
    @Permission(alias="location", strings={Manifest.permission.ACCESS_FINE_LOCATION})
})
public class AvenynTapToPayPlugin extends Plugin {
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private volatile String accessToken;
    private PluginCall active;
    private Cancelable operation;
    private boolean stopping;
    private boolean finishing;

    private boolean trustedPage() {
        String url=getBridge().getWebView().getUrl();
        if(url==null)return false;
        Uri uri=Uri.parse(url);
        return "https".equals(uri.getScheme())
            && ("avenyntaxi.se".equals(uri.getHost()) || "www.avenyntaxi.se".equals(uri.getHost()))
            && ("/driver".equals(uri.getPath()) || "/driver/".equals(uri.getPath()));
    }
    private String unavailable() {
        if(Build.VERSION.SDK_INT < 33) return "Tap to Pay kräver Android 13 eller senare.";
        NfcAdapter nfc=NfcAdapter.getDefaultAdapter(getContext());
        if(nfc==null) return "Telefonen saknar NFC för Tap to Pay.";
        if(!nfc.isEnabled()) return "Aktivera NFC i telefonens inställningar.";
        if((getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE)!=0)
            return "Tap to Pay kräver den signerade releaseversionen av förarappen.";
        return null;
    }
    @PluginMethod public void availability(PluginCall call) {
        getActivity().runOnUiThread(()->{
            if(!trustedPage()){call.reject("Öppna förarappen för att använda Tap to Pay.");return;}
            String reason=unavailable();JSObject result=new JSObject();
            result.put("available",reason==null);result.put("reason",reason);call.resolve(result);
        });
    }
    @PluginMethod public void pay(PluginCall call) {
        getActivity().runOnUiThread(()->{
            if(!trustedPage()){call.reject("Betalningen måste startas från förarappen.");return;}
            if(active!=null){call.reject("En betalning pågår redan. Kontrollera dess status först.");return;}
            String reason=unavailable();if(reason!=null){call.reject(reason);return;}
            String token=call.getString("accessToken","");
            String secret=call.getString("clientSecret","");
            String location=call.getString("locationId","");
            if(token.isEmpty()||!secret.startsWith("pi_")||!secret.contains("_secret_")||!location.matches("tml_[A-Za-z0-9]+")) {
                call.reject("Betalningsuppgifter saknas. Starta om betalningen.");return;
            }
            active=call;accessToken=token;stopping=false;finishing=false;
            if(getPermissionState("location")!=PermissionState.GRANTED) {
                requestPermissionForAlias("location",call,"locationReady");return;
            }
            connect(call);
        });
    }
    @PermissionCallback private void locationReady(PluginCall call) {
        getActivity().runOnUiThread(()->{
            if(getPermissionState("location")!=PermissionState.GRANTED){finish("Platsbehörighet behövs för kortbetalning.");return;}
            connect(call);
        });
    }
    private void token(ConnectionTokenCallback callback) {
        final String bearer=accessToken;
        network.execute(()->{
            HttpURLConnection connection=null;
            try {
                if(bearer==null) throw new Exception("Logga in och starta betalningen igen.");
                // Fixed trusted destination; never accept a token endpoint from JavaScript.
                connection=(HttpURLConnection)new URL("https://www.avenyntaxi.se/api/payments/terminal").openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setRequestMethod("POST");connection.setConnectTimeout(15000);connection.setReadTimeout(20000);
                connection.setRequestProperty("Authorization","Bearer "+bearer);
                connection.setRequestProperty("Content-Type","application/json");connection.setDoOutput(true);
                try(java.io.OutputStream stream=connection.getOutputStream()) {
                    stream.write("{\"action\":\"connection_token\"}".getBytes(StandardCharsets.UTF_8));
                }
                if(connection.getResponseCode()!=200)throw new Exception("Kunde inte ansluta till Avenyn Taxis betalkonto. Kontrollera inloggningen.");
                String response;
                try(java.io.InputStream input=connection.getInputStream()) { response=new String(input.readAllBytes(),StandardCharsets.UTF_8); }
                callback.onSuccess(new JSONObject(response).getString("secret"));
            } catch(Exception e) { callback.onFailure(new ConnectionTokenException("Anslutningen till betalservern misslyckades.",e)); }
            finally {if(connection!=null)connection.disconnect();}
        });
    }
    private void connect(PluginCall call) {
        try {
            if(!Terminal.isInitialized())Terminal.init(getContext().getApplicationContext(),LogLevel.NONE,
                this::token,new TerminalListener(){},null,LocaleConfig.CardLanguagePreferenceIfAvailable.INSTANCE);
            Terminal terminal=Terminal.getInstance();
            Runnable start=()->{
                terminal.clearCachedCredentials();
                EasyConnectConfiguration config=new EasyConnectConfiguration(){
                    public DiscoveryConfiguration getDiscoveryConfiguration(){return new DiscoveryConfiguration.TapToPayDiscoveryConfiguration(false);}
                    public ConnectionConfiguration getConnectionConfiguration(){return new ConnectionConfiguration.TapToPayConnectionConfiguration(
                        new TapUseCase.Pay(call.getString("locationId")),true,new TapToPayReaderListener(){
                            @Override public void onDisconnect(DisconnectReason reason){notifyStatus("Anslutningen bröts. Kontrollera betalningens status innan du försöker igen.");}
                            @Override public void onReaderReconnectStarted(Reader reader,Cancelable cancel,DisconnectReason reason){notifyStatus("Återansluter till kortläsaren…");}
                            @Override public void onReaderReconnectSucceeded(Reader reader){notifyStatus("Kortläsaren är ansluten.");}
                        });}
                };
                operation=terminal.easyConnect(config,new ReaderCallback(){
                    public void onSuccess(Reader reader){getActivity().runOnUiThread(()->{operation=null;if(stopping){finish("Betalningen avbröts. Kontrollera status.");return;}collect(call);});}
                    public void onFailure(TerminalException e){fail(e);}
                });
            };
            if(terminal.getConnectedReader()!=null) terminal.disconnectReader(new Callback(){
                public void onSuccess(){getActivity().runOnUiThread(start);}
                public void onFailure(TerminalException e){fail(e);}
            });else start.run();
        } catch(Exception e){finish("Tap to Pay kunde inte startas. Kontrollera telefonen och betalningsstatus.");}
    }
    private void collect(PluginCall call) {
        Terminal.getInstance().retrievePaymentIntent(call.getString("clientSecret"),new PaymentIntentCallback(){
            public void onSuccess(PaymentIntent intent){getActivity().runOnUiThread(()->{
                if(stopping){finish("Betalningen avbröts. Kontrollera status.");return;}
                if(intent.getStatus()==PaymentIntentStatus.SUCCEEDED){finish(null);return;}
                if(intent.getStatus()!=PaymentIntentStatus.REQUIRES_PAYMENT_METHOD && intent.getStatus()!=PaymentIntentStatus.REQUIRES_CONFIRMATION){finish("Betalningen behandlas eller har avbrutits. Uppdatera status.");return;}
                notifyStatus("Låt kunden blippa kortet mot telefonen.");
                operation=Terminal.getInstance().processPaymentIntent(intent,
                    new CollectPaymentIntentConfiguration.Builder().build(),new ConfirmPaymentIntentConfiguration.Builder().build(),new PaymentIntentCallback(){
                        public void onSuccess(PaymentIntent result){getActivity().runOnUiThread(()->finish(null));}
                        public void onFailure(TerminalException e){fail(e);}
                    });
            });}
            public void onFailure(TerminalException e){fail(e);}
        });
    }
    private void notifyStatus(String message){JSObject event=new JSObject();event.put("message",message);notifyListeners("status",event);}
    private void fail(TerminalException e){getActivity().runOnUiThread(()->finish("Kortbetalningen kunde inte slutföras ("+e.getErrorCode()+"). Kontrollera status och försök igen med samma betalning."));}
    private void finish(String error) {
        if(active==null||finishing)return;
        finishing=true;
        final PluginCall call=active;operation=null;
        Runnable complete=()->{
            if(Terminal.isInitialized())Terminal.getInstance().clearCachedCredentials();
            active=null;accessToken=null;stopping=false;finishing=false;
            if(call!=null){if(error!=null)call.reject(error);else{JSObject result=new JSObject();result.put("verifyOnServer",true);call.resolve(result);}}
        };
        if(Terminal.isInitialized()&&Terminal.getInstance().getConnectedReader()!=null)Terminal.getInstance().disconnectReader(new Callback(){
            public void onSuccess(){getActivity().runOnUiThread(complete);}
            public void onFailure(TerminalException e){getActivity().runOnUiThread(complete);}
        });else complete.run();
    }
    @Override protected void handleOnDestroy() {
        if(operation!=null)operation.cancel(new Callback(){public void onSuccess(){}public void onFailure(TerminalException e){}});
        accessToken=null;
        super.handleOnDestroy();
    }
}
