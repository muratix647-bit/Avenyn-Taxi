import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "se.avenyntaxi.driver",
  appName: "Avenyn Taxi Förare",
  webDir: "www",
  backgroundColor: "#eef6fa",
  server: {
    url: "https://avenyntaxi.se/driver?native=driver",
    cleartext: false,
    allowNavigation: ["avenyntaxi.se", "www.avenyntaxi.se"],
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "AvenynTaxiDriver",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#eef6fa",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1400,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#0798df",
    },
    Keyboard: { resize: "body" },
    LocalNotifications: { smallIcon: "ic_stat_taxi" },
    PushNotifications: {
      presentationOptions: ["badge", "sound"],
    },
  },
};

export default config;
