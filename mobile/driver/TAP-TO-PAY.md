# Tap to Pay – Avenyn Taxi, Android 1.5.0 (versionCode 7)

## Status

Server/API, databaskolumner, förargränssnitt och native-plugin är implementerade.
Webbtester täcker bland annat ägarskap, belopp, återupptagning efter databasfel och avbrutna betalningar.
Android-koden har kompilerats med Gradle 8.14.3, JDK 21, Android SDK 36 och Stripe Terminal 6.0.0 den 8 oktober 2026: `:app:compileDebugJavaWithJavac` lyckades (186 uppgifter). Kompileringskontrollen undantog `verifyNavigationKey`, eftersom den privata navigationsnyckeln inte finns här. Ingen installationsfil skapades av denna kontroll; den ordinarie nyckelkontrollen finns kvar i releasebygget.
Ingen riktig kortbetalning har gjorts och ingen signerad APK/AAB har byggts. Den befintliga signeringsnyckeln och navigationsnyckeln måste användas lokalt innan en release kan skapas.
Genomför bygg- och telefonkontrollen nedan innan versionen delas med förare.

## Öppna det färdiga projektet i Windows

Packa upp hela projektpaketet i en ny mapp och dubbelklicka på `OPPNA-FORARAPPEN.cmd`. Startfilen installerar de låsta npm-beroendena, synkroniserar Android-projektet och öppnar Android Studio. Node.js med npm och Android Studio behöver redan vara installerade. Behåll det gamla projektet och din keystore. Kopiera den befintliga `AVENYN_NAVIGATION_API_KEY` från det gamla projektets `android/local.properties` till samma fil i det nya projektet (eller använd den befintliga miljövariabeln). Lösenord och privata signeringsnycklar ska inte läggas i projektpaketet.

## Stripe

- Betalningarna använder sajtens befintliga `STRIPE_SECRET_KEY`. Ingen Connect-överföring eller förarutbetalning görs.
- Kontrollera i Stripe att nyckeln tillhör Avenyn Taxi och att kontot är aktiverat för Terminal i Sverige.
- Konfigurera en svensk Terminal-plats i Stripe Dashboard med företagets korrekta uppgifter.
- Sätt `STRIPE_TERMINAL_LOCATION_ID` till platsens `tml_…` i sajtens runtime-miljö och publicera en version för att tillämpa ändringen. Om exakt en svensk plats finns väljs den automatiskt; annars stoppas betalningsstart med ett tydligt fel.
- Kontrollera vilka avgifter och villkor som gäller för kontot. Implementationen accepterar inga nya avtal åt företaget.
- Använd aldrig Stripe-hemligheter i mobilappen. En inloggad, aktiv och godkänd förare får en kortlivad anslutningstoken från servern.

## Bygg Android

På Windows kan du dubbelklicka på `BYGG-SIGNERAD-FORARAPP.cmd`. Den frågar efter din befintliga keystore, alias och två lösenord (dolda vid inmatning), synkroniserar projektet och bygger signerad APK och AAB. Signeringsuppgifterna skickas till Gradle via processens miljö och skrivs inte till projektfiler. Gradle körs utan kvarvarande daemon. Navigationsnyckeln måste finnas i `android/local.properties` eller miljön enligt ovan. Skriptet laddar inte upp något till Google Play.

1. Hämta aktuell källkod och öppna `mobile/driver`.
2. Kör `npm ci`, sedan `npx cap sync android`.
3. Öppna `mobile/driver/android` i Android Studio. Använd JDK 21 och installera Android SDK 36 samt de byggverktyg Gradle begär.
4. Behåll appens befintliga Firebase-konfiguration och lägg den befintliga navigationsnyckeln i `android/local.properties` som `AVENYN_NAVIGATION_API_KEY=…`.
5. Kör `./gradlew :app:compileDebugJavaWithJavac` och därefter en **signerad release** via Android Studios Generate Signed App Bundle/APK. Använd den befintliga förarappens keystore och alias; skapa inte en ny signeringsidentitet.
6. Kontrollera paketnamn `se.avenyntaxi.driver`, versionCode **7**, versionName **1.5.0** och att det valda versionsnumret fortfarande är ledigt i Play Console.
7. Testa release-APK på en fysisk kompatibel telefon innan publicering. Ändra inte den tidigare inskickade Play-versionen utan att först kontrollera dess granskningsstatus.

Stripe Terminal 6.0.0 kräver minSdk 26, därför kräver hela denna appversion Android 8 eller senare. Själva Tap to Pay kräver Android 13+, NFC och en enhet som Stripe godkänner. Debugversion, emulator, root eller upplåst bootloader stöds inte för riktiga blippbetalningar. Ingen iPhone-integration ingår.

## Kontroll på fysisk telefon

- Logga in som godkänd förare. Öppna **Ta betalt · utan bokning → Blippa på telefonen**.
- Bekräfta att äldre appversioner och telefoner utan NFC visar ett begripligt hinder.
- Starta med belopp och valfri taxameter-/resereferens. Följ Stripes inbyggda anvisningar.
- Gör en överenskommen riktig testbetalning med kortinnehavaren närvarande; verifiera en lyckad betalning i Stripe, samma belopp i förarlistan och i Dispatch, rätt förare och betalningskvitto. Hantera eventuell återbetalning i Stripe som en separat åtgärd.
- Avbryt innan kortet läses och kontrollera att försöket inte markeras betalt. Återuppta samma försök eller avbryt det på servern före en ny betalning.
- Testa tappad anslutning och omstart: återuppta det sparade försöket och kontrollera att samma PaymentIntent används, även om Stripe hann ta betalt före avbrottet.
- Kontrollera GPS, bokningsnotiser och Google-navigation efter uppdateringen.

En SDK-framgång i telefonen räcker aldrig för “Betald”. Servern kontrollerar live-läge, `card_present`, PaymentIntent-ID, förare, betalningsreferens, SEK-belopp, mottaget belopp och lyckad Stripe-debitering. Status uppdateras vid kontroll/öppning och var 15:e sekund när betalningslistan är synlig. Det finns ingen separat webhook för dessa betalningar ännu. Referensen är fritext; ingen bokning markeras automatiskt betald.

## Källor

- https://docs.stripe.com/terminal/payments/setup-reader/tap-to-pay?platform=android
- https://docs.stripe.com/terminal/payments/connect-reader?reader-type=tap-to-pay&terminal-sdk-platform=android
- https://docs.stripe.com/terminal/payments/collect-card-payment?terminal-sdk-platform=android
