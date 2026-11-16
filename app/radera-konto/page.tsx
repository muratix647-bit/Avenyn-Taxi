import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Radera konto",
  description: "Så raderar du ditt konto i Avenyn Taxi Kundapp eller Förarapp.",
};

export default function DeleteAccountPage() {
  return (
    <main className="legalPage">
      <article>
        <Link className="legalBack" href="/">← Till Avenyn Taxi</Link>
        <small>KONTO OCH PERSONUPPGIFTER</small>
        <h1>Radera ditt konto</h1>
        <p>
          Du kan själv starta kontoraderingen när du är inloggad. Åtgärden
          avslutar inloggningen och kan inte ångras.
        </p>

        <h2>Kundkonto</h2>
        <ol>
          <li>Öppna Avenyn Taxi Kundapp och logga in.</li>
          <li>Gå till <b>Konto och integritet</b>.</li>
          <li>Tryck på <b>Radera konto</b> och bekräfta.</li>
        </ol>

        <h2>Förarkonto</h2>
        <ol>
          <li>Öppna Avenyn Taxi Förarapp och logga in.</li>
          <li>Gå till <b>Konto och integritet</b>.</li>
          <li>Tryck på <b>Radera konto</b> och bekräfta.</li>
        </ol>
        <p>
          En förare med en aktiv körning måste först avsluta körningen eller
          kontakta dispatch. Förarprofilen arkiveras så att tidigare utförda
          körningar fortfarande kan redovisas korrekt.
        </p>

        <h2>Om du inte kan logga in</h2>
        <p>
          Skicka begäran från kontots registrerade e-postadress till
          <a href="mailto:info@avenyntaxi.se?subject=Begäran%20om%20kontoradering"> info@avenyntaxi.se</a>.
          Ange om det gäller kundappen eller förarappen. Vi kan behöva
          kontrollera din identitet innan kontot raderas.
        </p>

        <h2>Vad som kan behållas</h2>
        <p>
          Inloggningskontot tas bort. Boknings-, betalnings- och
          redovisningsunderlag kan sparas under den tid som krävs enligt lag
          eller för att hantera reklamationer och rättsliga anspråk.
        </p>

        <Link className="legalPrimary" href="/integritet">Läs integritetspolicyn</Link>
      </article>
    </main>
  );
}
