package se.avenyntaxi.driver;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AvenynMicrophonePlugin.class);
        registerPlugin(AvenynNavigationPlugin.class);
        registerPlugin(AvenynTapToPayPlugin.class);
        super.onCreate(savedInstanceState);
        // Stable container exists before FragmentManager restores a navigation fragment.
        android.widget.FrameLayout navigation = new android.widget.FrameLayout(this);
        navigation.setId(EmbeddedTripNavigation.CONTAINER_ID);
        navigation.setVisibility(android.view.View.GONE);
        addContentView(navigation, new android.view.ViewGroup.LayoutParams(1, 1));
    }
}
