# Bygg kundappen i Android Studio

Appnamn: **Avenyn Taxi**  
Paketnamn: **se.avenyntaxi.app**  
Version: **1.0 (2)**

## Vad appen gör
Kundappen öppnar Avenyn Taxis bokning direkt på:
`https://avenyntaxi.se/?native=customer#booking`

Det betyder att kunden använder samma bokningsflöde och priser som på hemsidan.

## Bygg en signerad AAB
1. Packa upp projektet.
2. Öppna mappen `customer\android` i Android Studio med **Open** (inte New Project).
3. Vänta tills Gradle-synkroniseringen är klar.
4. Kontrollera i `build.gradle (Module :app)` att det står:
   - `applicationId "se.avenyntaxi.app"`
   - `versionCode 2`
   - `versionName "1.0"`
5. Välj **Build > Generate Signed App Bundle or APK**.
6. Välj **Android App Bundle** och klicka **Next**.
7. Välj kundappens befintliga nyckel:
   `C:\Users\murat\OneDrive\Documents\avenyn-taxi-customer-release-.jks`
8. Key alias: `avenyn-taxi-customer`.
9. Ange lösenorden lokalt i Android Studio. Lägg dem aldrig i projektet eller i en chatt.
10. Välj **release** och skapa filen.

Den signerade AAB-filen skapas normalt under:
`android\app\release\` eller `android\app\build\outputs\bundle\release\`

Ladda upp AAB-filen i Google Play Console för kundappen `se.avenyntaxi.app`.

## Viktigt
Använd inte förarappens keystore eller alias för kundappen.
