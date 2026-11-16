package se.avenyntaxi.driver;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

@CapacitorPlugin(name = "AvenynNavigation")
public class AvenynNavigationPlugin extends Plugin {
    private boolean active;
    private EmbeddedTripNavigation embedded;
    private EmbeddedTripNavigation embedded() {
        if (embedded == null) embedded = new EmbeddedTripNavigation(this);
        return embedded;
    }
    @PluginMethod public void capabilities(PluginCall call) {
        JSObject value = new JSObject(); value.put("embedded", true); value.put("audioSettings", true); value.put("mapSettings", true); value.put("idleMap", true); call.resolve(value);
    }
    @PluginMethod public void getAudioSettings(PluginCall call) {
        android.media.AudioManager audio = (android.media.AudioManager)getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
        JSObject result = new JSObject();
        int max = audio.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC);
        result.put("volume", Math.round(100f * audio.getStreamVolume(android.media.AudioManager.STREAM_MUSIC) / Math.max(1, max)));
        result.put("language", getContext().getSharedPreferences("navigation_audio", 0).getString("language", getActivity().getResources().getConfiguration().getLocales().get(0).getLanguage().equals("en") ? "en" : "sv"));
        result.put("theme", getContext().getSharedPreferences("navigation_audio", 0).getString("theme", "auto"));
        result.put("muted", getContext().getSharedPreferences("navigation_audio", 0).getBoolean("muted", false));
        call.resolve(result);
    }
    @PluginMethod public void setAudioSettings(PluginCall call) {
        String language = call.getString("language", "sv");
        String theme = call.getString("theme", "auto");
        boolean muted = call.getBoolean("muted", false);
        if (!theme.equals("auto") && !theme.equals("light") && !theme.equals("dark")) { call.reject("Ogiltigt kartläge."); return; }
        int volume = Math.max(0, Math.min(100, call.getInt("volume", 70)));
        if (!language.equals("sv") && !language.equals("en") && !language.equals("ml")) { call.reject("Ogiltigt språk."); return; }
        getActivity().runOnUiThread(() -> {
            try {
                String previous = getContext().getSharedPreferences("navigation_audio", 0).getString("language", getActivity().getResources().getConfiguration().getLocales().get(0).getLanguage().equals("en") ? "en" : "sv");
                if (!language.equals(previous) && (active || (embedded != null && embedded.isNavigating()))) {
                    call.reject("Byt språk mellan körningar, när navigationen är stängd."); return;
                }
                android.media.AudioManager audio = (android.media.AudioManager)getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
                int max = audio.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC);
                audio.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, Math.round(max * volume / 100f), android.media.AudioManager.FLAG_SHOW_UI);
                getContext().getSharedPreferences("navigation_audio", 0).edit().putString("language", language).putString("theme", theme).putBoolean("muted", muted).apply();
                if (embedded != null) embedded.applySettings();
                if (!language.equals(previous)) androidx.appcompat.app.AppCompatDelegate.setApplicationLocales(androidx.core.os.LocaleListCompat.forLanguageTags(language));
                call.resolve();
            } catch (Exception error) { call.reject("Kunde inte ändra ljudinställningarna."); }
        });
    }
    @PluginMethod public void showEmbedded(PluginCall call) {
        getActivity().runOnUiThread(() -> embedded().show(call));
    }
    @PluginMethod public void updateEmbeddedBounds(PluginCall call) {
        getActivity().runOnUiThread(() -> embedded().bounds(call));
    }
    @PluginMethod public void continueEmbeddedStop(PluginCall call) {
        getActivity().runOnUiThread(() -> embedded().nextStop(call));
    }
    @PluginMethod public void closeEmbedded(PluginCall call) {
        getActivity().runOnUiThread(() -> { if (embedded != null) embedded.close(); call.resolve(); });
    }
    void embeddedAction(String action) {
        JSObject event = new JSObject(); event.put("state", "action"); event.put("action", action);
        notifyListeners("embeddedNavigation", event);
    }
    void embeddedEvent(String state, boolean intermediateStop) {
        JSObject event = new JSObject(); event.put("state", state); event.put("intermediateStop", intermediateStop);
        notifyListeners("embeddedNavigation", event);
    }
    @Override protected void handleOnDestroy() {
        if (embedded != null) embedded.close();
        super.handleOnDestroy();
    }

    @PluginMethod public void start(PluginCall call) {
        if (active) { call.reject("Navigationen är redan öppen."); return; }
        JSArray points = call.getArray("waypoints");
        try {
            if (points == null || points.length() < 1 || points.length() > 10)
                throw new IllegalArgumentException();
            for (int i = 0; i < points.length(); i++) {
                JSONObject p = points.getJSONObject(i);
                double lat = p.getDouble("lat"), lng = p.getDouble("lng");
                if (!Double.isFinite(lat) || !Double.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
                    throw new IllegalArgumentException();
            }
        } catch (Exception e) { call.reject("Resan saknar giltiga koordinater."); return; }
        Intent intent = new Intent(getActivity(), TaxiNavigationActivity.class);
        intent.putExtra("waypoints", points.toString());
        intent.putExtra("phase", call.getString("phase", "pickup"));
        intent.putExtra("status", call.getString("status", ""));
        intent.putExtra("phone", call.getString("phone", ""));
        intent.putExtra("title", call.getString("title", "Avenyn Taxi"));
        active = true;
        try { startActivityForResult(call, intent, "navigationClosed"); }
        catch (Exception e) { active = false; call.reject("Navigationen kunde inte öppnas."); }
    }

    @ActivityCallback private void navigationClosed(PluginCall call, ActivityResult result) {
        active = false;
        if (call == null) return;
        Intent data = result.getData();
        JSObject value = new JSObject();
        value.put("action", result.getResultCode() == Activity.RESULT_OK && data != null
            ? data.getStringExtra("action") : "closed");
        call.resolve(value);
    }
}
