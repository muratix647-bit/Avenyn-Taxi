package se.avenyntaxi.app;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name="AvenynMicrophone", permissions={
    @Permission(alias="microphone", strings={Manifest.permission.RECORD_AUDIO})
})
public class AvenynMicrophonePlugin extends Plugin {
    private boolean trustedPage() {
        String url=getBridge().getWebView().getUrl();
        if(url==null)return false;
        Uri uri=Uri.parse(url);
        return "https".equals(uri.getScheme()) &&
            ("avenyntaxi.se".equals(uri.getHost()) || "www.avenyntaxi.se".equals(uri.getHost()));
    }
    @PluginMethod public void requestAccess(PluginCall call) {
        getActivity().runOnUiThread(()->{
            if(!trustedPage()){call.reject("Öppna Avenyn Taxi för att aktivera mikrofonen.");return;}
            if(getPermissionState("microphone")==PermissionState.GRANTED){microphoneReady(call);return;}
            requestPermissionForAlias("microphone",call,"microphoneReady");
        });
    }
    @PermissionCallback private void microphoneReady(PluginCall call) {
        JSObject result=new JSObject();
        result.put("granted",getPermissionState("microphone")==PermissionState.GRANTED);
        call.resolve(result);
    }
    @PluginMethod public void openSettings(PluginCall call) {
        getActivity().runOnUiThread(()->{
            if(!trustedPage()){call.reject("Öppna Avenyn Taxi först.");return;}
            try {
                Intent intent=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:"+getContext().getPackageName()));
                getActivity().startActivity(intent);
                call.resolve();
            } catch(Exception e){call.reject("Appinställningarna kunde inte öppnas.");}
        });
    }
}
