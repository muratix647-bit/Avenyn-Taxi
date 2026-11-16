# App-to-app voice: activation and release gates

Implemented: booking-scoped Twilio Voice web client on customer tracking and driver trip cards; explicit microphone consent; accept/reject/mute/end; server tokens and signed TwiML routing. No PSTN destination, recording or customer phone number is passed to Twilio. Tracking links are customer bearer capabilities and must remain private. An active approved assigned driver must authenticate. Assignment is checked again at call setup. Token lifetime: 10 minutes. Calls capped at 30 minutes.

OFF until all server settings exist:
- TWILIO_VOICE_API_KEY_SID (Standard API key in the same Twilio account/region)
- TWILIO_VOICE_API_KEY_SECRET (secret, never in client/source)
- TWILIO_VOICE_APP_SID (TwiML app)
- existing TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
- VOICE_CALLS_ENABLED=true only for a controlled test after configuration

TwiML app Voice request URL, method POST:
https://avenyntaxi.se/api/voice/connect

Use secure Site environment settings to enter values. No phone-number purchase is required by this app-to-app routing. Confirm account Voice availability and usage charges before enabling. Do not change the SMS configuration. No database schema changes.

Current web mode requires BOTH participants to activate calls and keep the trip page open. It is not a background calling implementation. Production native enablement still requires Android/iOS Voice SDK bridges, runtime microphone permissions, FCM/APNs VoIP registration, system call UI/audio focus handling and foreground/background lifecycle handling. Existing installed apps have not been updated. Do not advertise lock-screen incoming calls.

Release checks: two physical devices, both directions, wifi/mobile data, answer/reject/cancel/no-answer/mute/hangup; denied microphone permission; disconnect/reconnect; expired auth; unrelated driver denied; revoked driver/changed assignment/closed booking denied; webhook tampering rejected; no PSTN dialing. Then sign, publish and test new native app versions. Keep feature disabled if these checks fail.

## Microphone permission patch (2026-10-05)

Both Android manifests now declare RECORD_AUDIO and MODIFY_AUDIO_SETTINGS, with the microphone marked optional for installation. Capacitor handles the permission request triggered by getUserMedia; no unconditional WebView grant or startup recording is added. Both iOS targets now include NSMicrophoneUsageDescription. The web UI explains permission denial in Swedish.

These source changes do not update installed binaries. Build and sign each app with its existing authorized signing setup, choose a versionCode greater than the highest one uploaded to Play, and install the update. Android SDK, mobile dependencies and release signing credentials are not present in this workspace; no APK/AAB was built or native microphone test performed here. The driver build additionally requires its existing navigation API key. Do not replace signing keys or uninstall the production app to force a debug update.

On updated devices: activate calls, accept microphone consent, verify audio both directions, then verify denial/retry behavior. Both trip pages must stay open. This is the foreground WebView permission patch, not native background Voice SDK support.
