package se.avenyntaxi.driver;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.content.res.ColorStateList;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.libraries.navigation.NavigationApi;
import com.google.android.libraries.navigation.ForceNightMode;
import com.google.android.libraries.navigation.StylingOptions;
import com.google.android.libraries.navigation.Navigator;
import com.google.android.libraries.navigation.RoutingOptions;
import com.google.android.libraries.navigation.SupportNavigationFragment;
import com.google.android.libraries.navigation.Waypoint;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/** Native navigation. Trip changes are returned to the authenticated web flow. */
public class TaxiNavigationActivity extends AppCompatActivity {
    private Navigator navigator;
    private SupportNavigationFragment map;
    private TextView message;
    private Button nextStop;
    private int stopIndex;
    private int pointCount;
    private boolean starting;
    private Navigator.ArrivalListener arrivalListener;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        stopIndex = state == null ? 0 : state.getInt("stopIndex", 0);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(9, 35, 61));
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            androidx.core.graphics.Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
        setContentView(root);
        TextView title = new TextView(this);
        title.setText(getIntent().getStringExtra("title"));
        title.setTextColor(Color.WHITE);
        title.setTextSize(18);
        title.setPadding(16, 8, 16, 4);
        root.addView(title);
        message = new TextView(this);
        message.setText("Öppnar navigation…");
        message.setTextColor(Color.WHITE);
        message.setPadding(16, 4, 16, 8);
        root.addView(message);
        FrameLayout container = new FrameLayout(this);
        container.setId(0x00a7e001);
        root.addView(container, new LinearLayout.LayoutParams(-1, 0, 1));
        map = (SupportNavigationFragment) getSupportFragmentManager().findFragmentByTag("navigation");
        if (map == null) {
            map = SupportNavigationFragment.newInstance();
            getSupportFragmentManager().beginTransaction().replace(container.getId(), map, "navigation").commitNow();
        }
        LinearLayout actions = new LinearLayout(this);
        root.addView(actions);
        addButton(actions, "Till körningen", () -> finish());
        addButton(actions, "Ring kund", () -> {
            String phone = getIntent().getStringExtra("phone");
            if (phone != null && !phone.isBlank()) {
                try { startActivity(new Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", phone, null))); }
                catch (Exception e) { message.setText("Telefonappen kunde inte öppnas."); }
            }
        });
        LinearLayout tripActions = new LinearLayout(this);
        root.addView(tripActions);
        boolean destination = "destination".equals(getIntent().getStringExtra("phase"));
        if (destination) addButton(tripActions, "Slutför resa", () -> returnAction("complete"));
        else if ("arrived".equals(getIntent().getStringExtra("status")))
            addButton(tripActions, "Kund i bilen", () -> returnAction("onboard"));
        else if ("en_route".equals(getIntent().getStringExtra("status")))
            addButton(tripActions, "Framme", () -> returnAction("arrived"));
        else if ("accepted".equals(getIntent().getStringExtra("status")))
            addButton(tripActions, "På väg", () -> returnAction("en_route"));
        else addButton(tripActions, "Acceptera körning", () -> returnAction("accept"));
        nextStop = addButton(tripActions, "Fortsätt från stopp", () -> {
            if (navigator != null && stopIndex < pointCount - 1) {
                navigator.continueToNextDestination();
                stopIndex++;
                navigator.startGuidance();
                nextStop.setVisibility(View.GONE);
                message.setText("Navigerar till nästa stopp");
            }
        });
        nextStop.setVisibility(View.GONE);
        LinearLayout secondary = new LinearLayout(this);
        root.addView(secondary);
        addButton(secondary, "Ruttöversikt", () -> map.showRouteOverview());
        addButton(secondary, "Kartval", () -> new AlertDialog.Builder(this)
            .setTitle("Navigation")
            .setItems(new String[]{"Automatiskt dag-/nattläge", "Nattläge", "Dagläge", "Försök igen", "Licenser"}, (dialog, which) -> {
                if (which < 3) {
                    int mode = which == 1 ? ForceNightMode.FORCE_NIGHT : which == 2 ? ForceNightMode.FORCE_DAY : ForceNightMode.AUTO;
                    getSharedPreferences("navigation_audio", 0).edit().putString("theme", which == 1 ? "dark" : which == 2 ? "light" : "auto").apply();
                    map.setForceNightMode(mode);
                } else if (which == 3) initialize();
                else {
                    WebView licenses = new WebView(this);
                    licenses.getSettings().setJavaScriptEnabled(false);
                    licenses.loadUrl("file:///android_asset/navigation-licenses.txt");
                    AlertDialog licenseDialog = new AlertDialog.Builder(this).setTitle("Google Navigation – licenser")
                        .setView(licenses).setPositiveButton("Stäng", null).create();
                    licenseDialog.setOnDismissListener(d -> licenses.destroy());
                    licenseDialog.show();
                }
            }).show());
        initialize();
    }

    private Button addButton(LinearLayout row, String label, Runnable action) {
        Button b = new Button(this);
        b.setText(label);
        b.setTextSize(14);
        b.setAllCaps(false);
        b.setBackgroundTintList(ColorStateList.valueOf(Color.rgb(255, 207, 54)));
        b.setTextColor(Color.rgb(9, 35, 61));
        b.setMinHeight((int)(52 * getResources().getDisplayMetrics().density));
        row.addView(b, new LinearLayout.LayoutParams(0, -2, 1));
        b.setOnClickListener(v -> action.run());
        return b;
    }

    private void initialize() {
        if (starting || isFinishing() || isDestroyed()) return;
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 41);
            return;
        }
        starting = true;
        message.setText("Hämtar färdväg…");
        NavigationApi.getNavigator(this, new NavigationApi.NavigatorListener() {
            @Override public void onNavigatorReady(Navigator ready) {
                starting = false;
                if (isFinishing() || isDestroyed()) return;
                navigator = ready;
                if (arrivalListener != null) navigator.removeArrivalListener(arrivalListener);
                arrivalListener = event -> runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    message.setText(event.isFinalDestination() ? "Du är framme. Bekräfta resans status med knappen nedan." : "Framme vid extra stopp.");
                    nextStop.setVisibility(event.isFinalDestination() ? View.GONE : View.VISIBLE);
                });
                navigator.addArrivalListener(arrivalListener);
                navigator.setTaskRemovedBehavior(Navigator.TaskRemovedBehavior.QUIT_SERVICE);
                map.getMapAsync(googleMap -> {
                    if (isFinishing() || isDestroyed()) return;
                    map.setSpeedometerEnabled(true);
                    map.setSpeedLimitIconEnabled(true);
                    map.setEtaCardEnabled(true);
                    map.setRecenterButtonEnabled(true);
                    String theme = getSharedPreferences("navigation_audio", 0).getString("theme", "auto");
                    map.setForceNightMode(theme.equals("dark") ? ForceNightMode.FORCE_NIGHT : theme.equals("light") ? ForceNightMode.FORCE_DAY : ForceNightMode.AUTO);
                    map.setStylingOptions(new StylingOptions()
                        .primaryDayModeThemeColor(Color.rgb(9, 35, 61))
                        .secondaryDayModeThemeColor(Color.rgb(8, 93, 143))
                        .primaryNightModeThemeColor(Color.rgb(5, 19, 32))
                        .secondaryNightModeThemeColor(Color.rgb(9, 35, 61)));
                    googleMap.setTrafficEnabled(true);
                    googleMap.followMyLocation(GoogleMap.CameraPerspective.TILTED);
                });
                route();
            }
            @Override public void onError(int code) {
                starting = false;
                if (isFinishing() || isDestroyed()) return;
                message.setText(code == NavigationApi.ErrorCode.NOT_AUTHORIZED
                    ? "Navigationen saknar behörighet. Kontrollera API-nyckel, paketnamn och SHA-1 i Google Cloud."
                    : code == NavigationApi.ErrorCode.TERMS_NOT_ACCEPTED
                    ? "Googles navigationsvillkor behöver godkännas för att starta."
                    : "Navigationen kunde inte starta (" + code + "). Kontrollera internet och platsbehörighet och försök igen.");
            }
        });
    }

    private void route() {
        try {
            JSONArray raw = new JSONArray(getIntent().getStringExtra("waypoints"));
            pointCount = raw.length();
            List<Waypoint> points = new ArrayList<>();
            for (int i = stopIndex; i < raw.length(); i++) {
                JSONObject p = raw.getJSONObject(i);
                points.add(Waypoint.builder().setLatLng(p.getDouble("lat"), p.getDouble("lng"))
                    .setTitle(p.optString("title", "Destination")).setVehicleStopover(true).build());
            }
            navigator.stopGuidance();
            navigator.setDestinations(points, new RoutingOptions().travelMode(RoutingOptions.TravelMode.DRIVING))
                .setOnResultListener(result -> runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    if (result == Navigator.RouteStatus.OK) {
                        navigator.setAudioGuidance(getSharedPreferences("navigation_audio", 0).getBoolean("muted", false) ? Navigator.AudioGuidance.SILENT : Navigator.AudioGuidance.VOICE_ALERTS_AND_GUIDANCE);
                        navigator.startGuidance();
                        message.setText("Följ vägledningen · " + (pointCount - stopIndex) + " mål kvar");
                    } else message.setText("Färdvägen kunde inte hämtas (" + result + "). Försök igen.");
                }));
        } catch (Exception e) { message.setText("Resan saknar giltig färdväg. Gå tillbaka till körningen."); }
    }

    private void returnAction(String action) {
        setResult(RESULT_OK, new Intent().putExtra("action", action));
        finish();
    }

    @Override public void onRequestPermissionsResult(int code, @NonNull String[] permissions, @NonNull int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == 41) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) initialize();
            else message.setText("Tillåt exakt plats i appens inställningar för navigation.");
        }
    }
    @Override protected void onSaveInstanceState(@NonNull Bundle state) {
        state.putInt("stopIndex", stopIndex);
        super.onSaveInstanceState(state);
    }
    @Override protected void onDestroy() {
        if (navigator != null) {
            if (arrivalListener != null) navigator.removeArrivalListener(arrivalListener);
            if (isFinishing()) { navigator.stopGuidance(); navigator.clearDestinations(); navigator.cleanup(); }
        }
        super.onDestroy();
    }
}
