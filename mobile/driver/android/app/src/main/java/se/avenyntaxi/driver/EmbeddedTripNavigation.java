package se.avenyntaxi.driver;

import android.Manifest;
import android.content.pm.PackageManager;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.core.content.ContextCompat;
import com.getcapacitor.PluginCall;
import com.getcapacitor.JSObject;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.libraries.navigation.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/** Navigation in the existing BridgeActivity, never another Activity or browser tab. */
final class EmbeddedTripNavigation {
    private final AvenynNavigationPlugin plugin;
    private FrameLayout container;
    private SupportNavigationFragment map;
    private Navigator navigator;
    private Navigator.ArrivalListener arrival;
    private android.widget.LinearLayout navigationDock;
    private android.widget.TextView remainingTime, remainingDistance;
    private android.widget.Button voiceButton, volumeDown, volumeUp;
    private final android.os.Handler dockHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable dockTick = new Runnable() {
        @Override public void run() {
            if (navigationDock == null) return;
            if (visible) refreshNavigationDock();
            dockHandler.postDelayed(this, 1000);
        }
    };
    private long generation;
    private boolean visible;
    private boolean guiding;
    private android.widget.LinearLayout idleControls;
    private android.widget.Button onlineButton, earningsButton;
    static final int CONTAINER_ID = 0x00a7e002;
    private static final String TAG = "avenyn-embedded-navigation";

    EmbeddedTripNavigation(AvenynNavigationPlugin plugin) { this.plugin = plugin; }

    boolean isNavigating() { return guiding; }

    void show(PluginCall call) {
        if (ContextCompat.checkSelfPermission(plugin.getActivity(), Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Tillåt exakt plats för bilnavigation."); return;
        }
        final boolean idle = call.getBoolean("idle", false);
        final List<Waypoint> points = new ArrayList<>();
        try {
            JSONArray raw = call.getArray("waypoints");
            if (raw == null || (!idle && raw.length() < 1) || raw.length() > 10 || (idle && raw.length() != 0)) throw new IllegalArgumentException();
            for (int i = 0; i < raw.length(); i++) {
                JSONObject p = raw.getJSONObject(i);
                double lat = p.getDouble("lat"), lng = p.getDouble("lng");
                if (!Double.isFinite(lat) || !Double.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new IllegalArgumentException();
                points.add(Waypoint.builder().setLatLng(lat, lng).setTitle(p.optString("title", "Mål")).setVehicleStopover(true).build());
            }
        } catch (Exception e) { call.reject("Resan saknar giltiga koordinater."); return; }
        final long request = ++generation;
        try {
            if (container == null) {
                container = plugin.getActivity().findViewById(CONTAINER_ID);
                if (container == null) {
                    container = new FrameLayout(plugin.getActivity());
                    container.setId(CONTAINER_ID);
                    container.setVisibility(View.GONE);
                    plugin.getActivity().addContentView(container, new ViewGroup.LayoutParams(1, 1));
                }
                androidx.fragment.app.Fragment restored = plugin.getActivity().getSupportFragmentManager().findFragmentByTag(TAG);
                if (restored != null) plugin.getActivity().getSupportFragmentManager().beginTransaction().remove(restored).commitNow();
                map = SupportNavigationFragment.newInstance();
                plugin.getActivity().getSupportFragmentManager().beginTransaction().replace(container.getId(), map, TAG).commitNow();
            }
            NavigationApi.getNavigator(plugin.getActivity(), new NavigationApi.NavigatorListener() {
                @Override public void onNavigatorReady(Navigator ready) {
                    if (request != generation || container == null) { call.reject("Navigationen avbröts."); return; }
                    navigator = ready;
                    navigator.setTaskRemovedBehavior(Navigator.TaskRemovedBehavior.QUIT_SERVICE);
                    if (arrival != null) navigator.removeArrivalListener(arrival);
                    arrival = event -> plugin.getActivity().runOnUiThread(() -> {
                        if (request == generation) plugin.embeddedEvent("arrival", !event.isFinalDestination());
                    });
                    navigator.addArrivalListener(arrival);
                    navigator.stopGuidance();
                    guiding = false;
                    if (idle) {
                        navigator.clearDestinations();
                        map.getMapAsync(googleMap -> {
                            if (request != generation || container == null) return;
                            googleMap.setTrafficEnabled(true);
                            googleMap.followMyLocation(GoogleMap.CameraPerspective.TILTED);
                            map.setHeaderEnabled(false);
                            map.setEtaCardEnabled(false);
                            map.setRecenterButtonEnabled(true);
                            map.setSpeedometerEnabled(true);
                            applySettings();
                            addIdleControls();
                            container.setVisibility(visible ? View.VISIBLE : View.GONE);
                            call.resolve();
                        });
                        return;
                    }
                    navigator.setDestinations(points, new RoutingOptions().travelMode(RoutingOptions.TravelMode.DRIVING))
                        .setOnResultListener(result -> plugin.getActivity().runOnUiThread(() -> {
                            if (request != generation || container == null) { call.reject("Navigationen avbröts."); return; }
                            if (result != Navigator.RouteStatus.OK) { close(); call.reject("Färdvägen kunde inte hämtas: " + result); return; }
                            map.getMapAsync(googleMap -> {
                                if (request != generation || container == null) return;
                                map.setHeaderEnabled(true);
                                map.setEtaCardEnabled(false);
                                addNavigationDock();
                                applySettings();
                                map.setRecenterButtonEnabled(true);
                                map.setSpeedometerEnabled(true);
                                map.setSpeedLimitIconEnabled(true);
                                googleMap.setTrafficEnabled(true);
                                googleMap.followMyLocation(GoogleMap.CameraPerspective.TILTED);
                            });
                            guiding = true;
                            applySettings();
                            navigator.startGuidance();
                            container.setVisibility(visible ? View.VISIBLE : View.GONE);
                            call.resolve();
                        }));
                }
                @Override public void onError(int code) {
                    if (request == generation) close();
                    call.reject("Navigationen kunde inte starta (" + code + ").");
                }
            });
        } catch (Exception e) { close(); call.reject("Navigationen kunde inte visas i kartan."); }
    }

    void applySettings() {
        android.content.SharedPreferences prefs = plugin.getContext().getSharedPreferences("navigation_audio", 0);
        String theme = prefs.getString("theme", "auto");
        if (map != null) map.setForceNightMode(theme.equals("dark") ? ForceNightMode.FORCE_NIGHT : theme.equals("light") ? ForceNightMode.FORCE_DAY : ForceNightMode.AUTO);
        if (navigator != null) navigator.setAudioGuidance(prefs.getBoolean("muted", false) ? Navigator.AudioGuidance.SILENT : Navigator.AudioGuidance.VOICE_ALERTS_AND_GUIDANCE);
    }
    private int dp(int value) { return Math.round(value * plugin.getContext().getResources().getDisplayMetrics().density); }
    private android.media.AudioManager audioManager() {
        return (android.media.AudioManager) plugin.getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
    }
    private android.widget.Button soundButton(String title, Runnable action) {
        android.widget.Button button = new android.widget.Button(plugin.getActivity());
        button.setText(title); button.setTextSize(14); button.setAllCaps(false);
        button.setTextColor(0xff123b50);
        button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xffe8f3f7));
        button.setOnClickListener(v -> { action.run(); refreshNavigationDock(); });
        return button;
    }
    private void changeVolume(int direction) {
        try {
            android.media.AudioManager audio = audioManager();
            int current = audio.getStreamVolume(android.media.AudioManager.STREAM_MUSIC);
            int max = audio.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC);
            audio.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, Math.max(0, Math.min(max, current + direction)), 0);
        } catch (SecurityException error) {
            android.widget.Toast.makeText(plugin.getContext(), "Använd telefonens volymknappar", android.widget.Toast.LENGTH_SHORT).show();
        }
    }
    private void addNavigationDock() {
        if (navigationDock != null || container == null) return;
        navigationDock = new android.widget.LinearLayout(plugin.getActivity());
        navigationDock.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        navigationDock.setGravity(android.view.Gravity.CENTER_VERTICAL);
        navigationDock.setBackgroundColor(0xff07394e);
        navigationDock.setPadding(dp(8), dp(4), dp(8), dp(4));
        remainingTime = new android.widget.TextView(plugin.getActivity());
        remainingTime.setTextSize(20); remainingTime.setTextColor(0xffffdf38);
        remainingTime.setTypeface(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD);
        remainingDistance = new android.widget.TextView(plugin.getActivity());
        remainingDistance.setTextSize(11); remainingDistance.setTextColor(0xffffffff);
        remainingDistance.setTypeface(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD);
        android.widget.LinearLayout estimateColumn = new android.widget.LinearLayout(plugin.getActivity());
        estimateColumn.setOrientation(android.widget.LinearLayout.VERTICAL);
        estimateColumn.addView(remainingTime); estimateColumn.addView(remainingDistance);
        navigationDock.addView(estimateColumn, new android.widget.LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        android.widget.LinearLayout buttons = new android.widget.LinearLayout(plugin.getActivity());
        volumeDown = soundButton("−", () -> changeVolume(-1));
        volumeDown.setContentDescription("Sänk medievolymen");
        volumeUp = soundButton("+", () -> changeVolume(1));
        volumeUp.setContentDescription("Höj medievolymen");
        voiceButton = soundButton("Röst på", () -> {
            android.content.SharedPreferences prefs = plugin.getContext().getSharedPreferences("navigation_audio", 0);
            prefs.edit().putBoolean("muted", !prefs.getBoolean("muted", false)).apply();
            applySettings();
        });
        buttons.addView(volumeDown, new android.widget.LinearLayout.LayoutParams(dp(44), dp(44)));
        buttons.addView(voiceButton, new android.widget.LinearLayout.LayoutParams(dp(56), dp(44)));
        buttons.addView(volumeUp, new android.widget.LinearLayout.LayoutParams(dp(44), dp(44)));
        navigationDock.addView(buttons);
        container.addView(navigationDock, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, android.view.Gravity.BOTTOM));
        // Reserve space instead of covering the Google attribution or map controls.
        navigationDock.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob) -> {
            View mapView = map == null ? null : map.getView();
            if (mapView != null && mapView.getLayoutParams() instanceof FrameLayout.LayoutParams) {
                FrameLayout.LayoutParams params = (FrameLayout.LayoutParams)mapView.getLayoutParams();
                if (params.bottomMargin != b-t) { params.bottomMargin = b-t; mapView.setLayoutParams(params); }
            }
        });
        refreshNavigationDock(); dockHandler.removeCallbacks(dockTick); dockHandler.postDelayed(dockTick, 1000);
    }
    private void refreshNavigationDock() {
        if (navigationDock == null) return;
        TimeAndDistance estimate = navigator == null ? null : navigator.getCurrentTimeAndDistance();
        if (estimate == null) {
            remainingTime.setText("Beräknar restid…"); remainingDistance.setText("");
        } else {
            int seconds = Math.max(0, estimate.getSeconds());
            remainingTime.setText(Math.max(1, (seconds + 59) / 60) + " min kvar");
            java.text.SimpleDateFormat clock = new java.text.SimpleDateFormat("HH:mm", new java.util.Locale("sv", "SE"));
            clock.setTimeZone(java.util.TimeZone.getTimeZone("Europe/Stockholm"));
            remainingDistance.setText(String.format(new java.util.Locale("sv", "SE"), "%.1f km · Ankomst %s", estimate.getMeters()/1000.0, clock.format(new java.util.Date(System.currentTimeMillis()+seconds*1000L))));
        }
        android.media.AudioManager audio = audioManager();
        int volume = audio.getStreamVolume(android.media.AudioManager.STREAM_MUSIC);
        int max = Math.max(1, audio.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC));
        boolean muted = plugin.getContext().getSharedPreferences("navigation_audio", 0).getBoolean("muted", false);
        voiceButton.setText(muted ? "Av" : Math.round(volume*100f/max) + "%");
        voiceButton.setContentDescription(muted ? "Slå på navigationsrösten" : "Stäng av navigationsrösten");
        volumeDown.setEnabled(volume > 0); volumeUp.setEnabled(volume < max);
    }
    private android.widget.Button idleButton(String title, String action) {
        android.widget.Button button = new android.widget.Button(plugin.getActivity());
        button.setText(title); button.setTextSize(12); button.setAllCaps(false);
        button.setTextColor(android.graphics.Color.WHITE);
        button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xff006f91));
        button.setOnClickListener(v -> plugin.embeddedAction(action));
        idleControls.addView(button, new android.widget.LinearLayout.LayoutParams(0, android.view.ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        return button;
    }
    private void addIdleControls() {
        if (idleControls != null) return;
        idleControls = new android.widget.LinearLayout(plugin.getActivity());
        idleControls.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        earningsButton = idleButton("Inkört", "history");
        onlineButton = idleButton("Online", "online");
        idleButton("Blipp", "payments"); idleButton("Mer", "more");
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, android.view.Gravity.TOP);
        container.addView(idleControls, lp);
    }
    void bounds(PluginCall call) {
        visible = call.getBoolean("visible", false);
        if (onlineButton != null) onlineButton.setText(call.getBoolean("online", false) ? "Online" : "Gå online");
        if (earningsButton != null) earningsButton.setText(call.getString("earnings", "Inkört"));
        if (container != null) {
            // Web coordinates are CSS pixels relative to the WebView viewport.
            double viewport = call.getDouble("viewportWidth", 0.0);
            double x = call.getDouble("x", 0.0), y = call.getDouble("y", 0.0);
            double w = call.getDouble("width", 0.0), h = call.getDouble("height", 0.0);
            android.webkit.WebView web = plugin.getBridge().getWebView();
            double scale = viewport > 0 ? web.getWidth() / viewport : 0;
            if (!Double.isFinite(x+y+w+h+scale) || scale <= 0 || w < 1 || h < 1) visible = false;
            if (visible) {
                int[] webPos = new int[2], parentPos = new int[2];
                web.getLocationOnScreen(webPos);
                ((View)container.getParent()).getLocationOnScreen(parentPos);
                ViewGroup.LayoutParams lp = container.getLayoutParams();
                lp.width = Math.max(1, (int)Math.round(w * scale));
                lp.height = Math.max(1, (int)Math.round(h * scale));
                container.setLayoutParams(lp);
                container.setX(webPos[0] - parentPos[0] + (float)(x * scale));
                container.setY(webPos[1] - parentPos[1] + (float)(y * scale));
            }
            container.setVisibility(visible ? View.VISIBLE : View.GONE);
        }
        call.resolve();
    }
    void nextStop(PluginCall call) {
        if (navigator == null) { call.reject("Ingen aktiv navigation."); return; }
        navigator.continueToNextDestination(); navigator.startGuidance(); call.resolve();
    }
    void close() {
        ++generation; visible = false; guiding = false;
        dockHandler.removeCallbacks(dockTick);
        navigationDock = null; remainingTime = null; remainingDistance = null; voiceButton = null; volumeDown = null; volumeUp = null;
        if (navigator != null) {
            if (arrival != null) navigator.removeArrivalListener(arrival);
            navigator.stopGuidance(); navigator.clearDestinations();
            navigator.cleanup(); navigator = null; arrival = null;
        }
        if (container != null) {
            container.setVisibility(View.GONE);
            if (map != null) plugin.getActivity().getSupportFragmentManager().beginTransaction().remove(map).commitNowAllowingStateLoss();
            ((ViewGroup)container.getParent()).removeView(container);
            container = null; map = null; idleControls = null; onlineButton = null; earningsButton = null;
        }
    }
}
