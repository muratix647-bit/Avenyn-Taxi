package se.avenyntaxi.driver;

import android.app.Application;
import com.stripe.stripeterminal.TerminalApplicationDelegate;
import com.stripe.stripeterminal.taptopay.TapToPay;

public class AvenynApplication extends Application {
    @Override public void onCreate() {
        super.onCreate();
        if (TapToPay.isInTapToPayProcess()) return;
        TerminalApplicationDelegate.onCreate(this);
    }
}
