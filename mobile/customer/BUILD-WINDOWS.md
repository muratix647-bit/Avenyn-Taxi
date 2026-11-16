# Bygg kundappen i Android Studio

Appnamn: **Avenyn Taxi**  
Paketnamn: **se.avenyntaxi.app**  
Version: **1.0 (1)**

1. Packa upp projektet och öppna mappen `android` i Android Studio.
2. Vänta tills Gradle-synkroniseringen är klar.
3. Välj **Build > Generate Signed App Bundle or APK**.
4. Välj **Android App Bundle** och klicka **Next**.
5. Välj den befintliga nyckeln:
   `C:\Users\murat\OneDrive\Documents\avenyn-taxi-driver-release.jks`
6. Key alias: `avenyn-taxi-driver`.
7. Välj **release** och skapa filen.

Den signerade filen skapas normalt här:

`android\app\release\app-release.aab`

Ladda sedan upp filen i Google Play Console för kundappen med paketnamnet
`se.avenyntaxi.app`.

Lägg aldrig `.jks`-filen eller lösenordet i projektmappen.
