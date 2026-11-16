# Inbyggd navigation i förarappen 1.6.1 (Android)

## Nytt: samma skärm

Navigationen monteras som SupportNavigationFragment i befintlig BridgeActivity.
Ingen ny Activity, webbsida eller flik öppnas automatiskt. Kartans skärmgränser
kommer från DriverEmbeddedNavigation; nedersta statusraden lämnas utanför.
Acceptans väljer hämtningen. Kund i bilen väljer destination inklusive sparat stopp.
Ändrad färdfas och Ångra senaste status byter mål. Vanliga statusknappar och
betalningsdialoger använder fortfarande det autentiserade webbflödet.
Körningsmeny, andra flikar och dialoger döljer navigationsytan.
Vid extra stopp visas Fortsätt från stopp ovanför statusraden.

Webben frågar capabilities() innan inbyggd navigation används. Äldre installerade
appar saknar metoden och behåller Leaflet-kartan. Den gamla start()-metoden
anropas aldrig automatiskt. Native-felen visar den vanliga kartan som reserv.

## Kräver ny Android-version

Webbpublicering uppdaterar INTE installerad Java-kod. Bygg och signera en ny AAB
från denna källkod och installera den via ett internt testspår före produktion.
Version code är 10, name 1.6.1; kontrollera att 10 inte redan har använts i Play.
Behåll befintlig signeringsnyckel och lokal AVENYN_NAVIGATION_API_KEY.
Denna ändring är webbbyggd men INTE Android-kompilerad eller telefonverifierad
här: miljön saknar Android SDK och Java 21.

## Måste testas i internt testspår

- Acceptera: inbyggd Google-karta med röst och följning mot hämtning.
- På väg/Framme: behåll kartan och rutten; Kund i bilen: byt till slutmål.
- Ångra Kund i bilen: återgå till hämtning, ingen separat Activity.
- Öppna Körning, Betalningar, inkommande appsamtal och slutfördialog:
  ingen native-karta ovanpå dialog/knappar; återgång visar rätt mål.
- Zoom/panorering och SDK:s centrera-knapp, rotation, bakgrund/återuppta.
- Extra stopp, nekad platsbehörighet, nekade Google-villkor och nätfel.
- Avslutad resa och utloggning stoppar navigationen och frigör fragmentet.

## Google Cloud

Navigation SDK måste vara aktiverat och projektet kopplat till fakturering.
Begränsa den separata navigationsnyckeln till **Navigation SDK** och
**Android apps** med paketnamnet ovan samt SHA-1 från appens signeringscertifikat.
För installation från Play används **App signing key certificate** från Play
Console, inte enbart uppladdningsnyckelns SHA-1. Lägg vid behov till den lokala
release-signeringens SHA-1 separat för sidoladdade APK-filer.

Nyckeln ligger inte i Git. Lägg lokalt till i `android/local.properties`:

```properties
AVENYN_NAVIGATION_API_KEY=DIN_BEGRANSADE_NYCKEL
```

Bygget läser även miljövariabeln med samma namn. Nyckeln paketeras i den nativa
Android-manifestfilen; paket- och certifikatbegränsningarna är därför viktiga.
Den ska inte läggas i webbmiljön eller i `google-services.json`.

## Bygg i Windows

1. Öppna terminalen i `mobile/driver` och kör `npm ci`.
2. Kör `npx cap sync android`.
3. Öppna `mobile/driver/android` i Android Studio med Java 21.
4. Lägg till nyckeln i `local.properties` enligt ovan och synkronisera Gradle.
5. Använd **Build → Generate Signed App Bundle / APK** och samma befintliga
   signeringsnyckel som tidigare. Versionen är code **10**, name **1.6.1**.



## Förarapp 1.6.2 – kartljud och tydlig restid

Inbyggd navigation har en panel under kartan med fet restid, avstånd och ankomsttid till nästa mål. Knapparna −/+ ändrar telefonens medievolym (även andra medieljud påverkas). Röst av/på tystar endast navigationsguidningen och sparas mellan körningar. Kartan får eget utrymme ovanför panelen så att Googles attribution förblir synlig.

Kräver ny Android-installation, inte endast omladdning av webbplatsen. Bygg och signera via BYGG-SIGNERAD-FORARAPP.cmd. Verifiera på telefon: starta körning, ändra volym, tysta/återaktivera röst, kontrollera restid vid omruttning och nästa stopp, samt stäng/öppna navigationen. Android SDK och signeringsnyckel krävs.
