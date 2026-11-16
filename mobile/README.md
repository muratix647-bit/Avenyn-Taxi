# Avenyn Taxi – butiksklara mobilappar

Två separata Capacitor 8-projekt använder den publicerade tjänsten på
`https://avenyntaxi.se`:

| App | Paket-ID | Startsida |
| --- | --- | --- |
| Avenyn Taxi | `se.avenyntaxi.app` | Kundbokning |
| Avenyn Taxi Förare | `se.avenyntaxi.driver` | Förarapp |

## Bygg Android

Kör i respektive appmapp:

```sh
npm install
npm run native:add
npm run native:sync
npm run build:aab
```

Releasefilen skapas under `android/app/build/outputs/bundle/release/`.
Signeringsnyckeln ska skapas och förvaras av Avenyn Taxi och får inte läggas i
Git.

## Bygg iPhone

Kör `npm install`, `npm run native:add` och `npm run native:sync` i respektive
appmapp. Öppna sedan projektet med `npm run open:ios` på en Mac med Xcode.
Välj Avenyn Taxis Apple Developer-team och ladda upp arkivet till App Store
Connect/TestFlight.

## Publicering

Butikstexter finns i `store-listing/`. Integritetspolicyn finns på
`https://avenyntaxi.se/integritet` och sidan för kontoradering på
`https://avenyntaxi.se/radera-konto`.

Pushnotiser behöver APNs- och Firebase-nycklar från Avenyn Taxis egna
utvecklarkonton. Lägg aldrig dessa nycklar i källkoden.

## Mikrofonuppdatering för båda Android-apparna

Förarappen: versionCode 8, versionName 1.6.0.
Kundappen: versionCode 2, versionName 1.1.0. Om Play Console redan har ett högre
versionCode måste nästa lediga nummer användas före uppladdning.

Båda projekten registrerar `AvenynMicrophonePlugin`. När användaren trycker
Aktivera appsamtal begär pluginen RECORD_AUDIO, varefter WebView begär
mikrofonåtkomst för samtalet. Nekad behörighet kan hanteras med Öppna
mikrofoninställningar. Mikrofonen spelas inte in i bakgrunden.

För befintliga Android-projekt: kör `npm install` och `npm run native:sync`
i respektive mobilmapp; kör inte `native:add` igen. Öppna Android Studio
med `npm run open:android`, välj Build → Generate Signed App Bundle / APK
och signera med respektive apps befintliga nyckel. Behåll förarappens
befintliga Google Navigation-nyckel i android/local.properties. Installera
uppdateringen eller ladda upp till respektive Play Console-app.

En webbpublicering uppdaterar menyer och karta men installerar inte dessa
Android-ändringar på telefonen. Om Mikrofon saknas i en äldre apps
behörighetslista måste Android-appen uppdateras.
