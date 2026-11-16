# Aktivera Google-kartorna för Avenyn Taxi

Kod för kundens livekarta och dispatch använder Google Maps när en separat
webbnyckel är konfigurerad. Utan den används OpenStreetMap. Det är inte
Consumer SDK/Fleet Engine; den integrationen återstår.

## Google Maps på webben

I projektet `avenyn-taxi`:

1. Aktivera **Maps JavaScript API**. Fakturering är redan kopplad enligt tidigare kontroll.
2. Skapa en separat API-nyckel, exempelvis `Avenyn webbkartor`.
3. Välj **Websites** och tillåt:
   - `https://avenyntaxi.se/*`
   - `https://www.avenyntaxi.se/*`
   - `https://avenyn-taxi-goteborg.muratix647.chatgpt.site/*`
4. API-begränsning: **Maps JavaScript API**.
5. Lägg den i webbplatsens runtime-inställning `GOOGLE_MAPS_BROWSER_KEY` och
   publicera en version för att tillämpa inställningen.

Webbnyckeln är avsiktligt synlig i webbläsaren. Domän/API-begränsningarna ska
vara på plats först. Återanvänd inte Navigation SDK-nyckeln eller en servernyckel.
`/api/maps/config` lämnar endast ut den uttryckliga webbnyckeln.

Google-kartan har trafikknapp, och dispatch även satellitvy. Bilpositioner,
förarval, följning och efterfrågeområden kommer från befintligt system.
Färdvägen till hämtning och ETA använder fortfarande befintlig OSRM-beräkning;
den är ungefärlig och inte trafikberäknad. En synlig trafiklayer ändrar inte ETA.
Ingen simulerad bilrörelse eller påhittad position används.

## Consumer SDK / Fleet Engine

Detta kräver separat Google Cloud-konfiguration och backendintegration:

- Fleet Engine aktiverat för on-demand-resor i rätt projekt.
- Separata servicekonton och minsta IAM-behörigheter för Fleet Engine.
- Servergenererade, kortlivade JWT:er med rätt resa/fordon som åtkomstgräns.
- Synkronisering av verkliga fordon, resor och statusar från dispatch.
- Driver SDK som skickar fordonspositioner och Consumer SDK som följer resan.

Firebase-adminkontot används inte automatiskt som Fleet Engine-konto.
Inga servicekontonycklar ska skickas i chatten eller läggas i frontend.
Google Cloud behöver verifieras innan denna del kan färdigställas och testas.

## Kontroll efter aktivering

Testa kundlänk och inloggad dispatch på mobil: markörer, följ bil, zoom,
förarval, GPS-ålder, trafik, satellit, efterfrågeområden och färdväg till hämtning.
Verifiera i Google Cloud att endast de tillåtna webbplatserna kan använda nyckeln.
Om Google nekar åtkomst visas ett fel; liveuppgifterna finns kvar i övriga vyer.

## Android 1.4.1

Se `mobile/driver/NAVIGATION.md`. Kod 6 innehåller hastighetsvisning, nattläge,
Avenyn-färger och ruttöversikt utöver 1.4.0. Metoderna har kontrollerats mot
Navigation SDK 7.9.0. Version 1.4.0 kompilerades tidigare; 1.4.1 behöver ett nytt
Android-bygge och test på riktig telefon samt signering med befintlig nyckel.

Källor:
https://developers.google.com/maps/documentation/javascript/get-api-key
https://developers.google.com/maps/documentation/mobility/fleet-engine/essentials/set-up-fleet
https://developers.google.com/maps/documentation/navigation/android-sdk/controls
