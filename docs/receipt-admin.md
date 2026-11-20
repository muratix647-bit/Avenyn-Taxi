# Ekonomi – kvitton och avdragsgill moms

## Läge
- Supabase Edge Function finance-receipts-admin är driftsatt med verify_jwt=true.
- Supabase-databasen har kvittofält för vat_suggestion, vat_suggestion_at, file_sha256, bankkandidater och spärr för ändring av bokfört kvitto.
- Gränssnittet ligger på /admin/ekonomi/kvitton när denna GitHub-gren har slagits ihop och webbappen har driftsatts.
- Separat administratörskonsol är publicerad på https://ksmxrxqidnrvgubivhzy.supabase.co/functions/v1/finance-receipts-console och kräver Supabase-inloggning samt aktivt dispatch_admins-konto. API-endpointen kräver JWT; konsolen innehåller inga företagsdata före inloggning.
- Den befintliga publika webbplatsens driftsättningskoppling har inte verifierats. Att grenen finns i GitHub betyder inte att ändringen syns i dagens trafikledningsmeny.

## Administratör
Samma Supabase Auth-session som den befintliga Next.js-appen kan användas. API:et kräver ett aktivt dispatch_admins-konto med role=admin, kontrollerat på servern. Endast Edge Function använder service-role-nyckeln. Ingen sådan nyckel får förekomma i klienten eller GitHub.

## Konfiguration
1. Next.js: NEXT_PUBLIC_SUPABASE_URL och NEXT_PUBLIC_SUPABASE_ANON_KEY.
2. Supabase: Privat Storage-bucket economy-receipts är redan skapad.
3. OCR för JPG/PNG: valfritt. Sätt GOOGLE_CLOUD_VISION_API_KEY som en hemlighet i Supabase Edge Functions efter godkännande av eventuell extern kostnad och personuppgiftshantering. Bilder skickas till Google Cloud Vision endast när en administratör trycker på Läs av kvittot.
4. OCR för PDF är inte implementerad. PDF-uppladdning och manuell registrering fungerar.
5. Ändra inte SQL-reglerna för bankmatchning och huvudbok utan redovisningsmässig genomgång.

## Flöde
1. Välj kvittobild/PDF. För JPG/PNG och konfigurerad Vision-nyckel kan text föreslås, annars fylls uppgifter i manuellt.
2. Ange leverantör, datum, kategori, totalt, kvittots moms och avdragsgill moms. Kontrollera moms, blandade inköp, privat användning samt avdragsrätt.
3. Spara granskat kvitto. Filen lagras privat, SHA-256 används för dubblettspärr. Ingen bokföring utförs.
4. Matcha rätt banktransaktion (exakt belopp, inom 7 dagar) från importerat Swedbank-underlag. Om den saknas kan inte bokföringen godkännas.
5. Granska BAS-konto (för närvarande 5611, 5613 eller 5460), avdragsgill moms och kontoutdrag.
6. Godkänn explicit. API:et skapar bokföringsutkast med befintlig bokföringsfunktion och bokför sedan via finance_post_ledger_draft. Utkast som inte postats kan återupptas. Bokförda kvitton är låsta.

## Avgränsningar
- Ingen automatisk deklaration eller Skatteverket-inlämning.
- Ingen automatisk avläsning av PDF.
- Ingen automatisk bokföring utan kontroll.
- Utgifter med specialregler, icke-avdragsgill moms, blandad moms, leasing och andra konton än 5611/5613/5460 kräver manuell redovisningsgranskning.
- Resultatet är inte ett färdigtestat ersättningssystem för redovisningsbyrån.

## Testat 2026-11-20
- VAT-förslag för 1000 kr diesel: 800 kr kostnad + 200 kr moms, konto 5611.
- Simulerad verksamhetsandel 50 % ger 100 kr preliminärt avdrag.
- Okända kategorier ger inget automatiskt avdragsbesked.
- Kvitto-trigger körd i rollback-test: ingen testpost finns kvar.
- Service-only rättigheter till momsfunktioner, RLS på befintliga tabeller.
- Privata PDF-, PNG- och JPEG-filer tillåts, max 10 MB.
- Återstår: inloggad end-to-end-kontroll i rätt admininstallation samt faktisk OCR med konfigurerad leverantör.

## Säkerhet
Banktransaktioner visas bara efter kontroll av aktiv admin. API:et verifierar Supabase access token med Auth-servern och kontrollerar separat dispatch_admins. Arkiverade kvitton exponeras inte. Alla bokföringsändringar använder befintliga bekräftelsekrävande RPC:er och bokföringsspärrar. Service-role-nycklar exponeras aldrig i klienten.
