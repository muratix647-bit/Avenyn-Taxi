import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: {canonical: "https://www.avenyntaxi.se/integritet"},
  title: "Integritetspolicy",
  description: "Så behandlar Avenyn Taxi personuppgifter i webbplatsen, kundappen och förarappen.",
};

export default function PrivacyPage() {
  return (
    <main className="legalPage">
      <article>
        <Link className="legalBack" href="/">← Till Avenyn Taxi</Link>
        <small>AVENYN TAXI · SENAST UPPDATERAD 3 OKTOBER 2026</small>
        <h1>Integritetspolicy</h1>
        <p>
          Avenyn Taxi drivs av Citra Trans och Bilservice AB, org.nr
          556597-4796. Vi är personuppgiftsansvariga för de uppgifter som
          behandlas när du bokar, använder kundappen eller arbetar i
          förarappen.
        </p>

        <h2>Uppgifter som behandlas</h2>
        <ul>
          <li>Namn, telefonnummer och e-postadress.</li>
          <li>Hämtplats, destination, bokningstid och reseinformation.</li>
          <li>Betalningsstatus. Kortuppgifter hanteras av betalningsleverantören och lagras inte av Avenyn Taxi.</li>
          <li>Kontouppgifter och tekniska säkerhetsuppgifter för inloggning.</li>
          <li>En teknisk enhetstoken för att skicka bokningsnotiser till förarappen.</li>
          <li>Position när kunden väljer GPS samt förarens exakta position under aktiv arbetstid och liveföljning.</li>
          <li>Flygnummer när det lämnas för bevakning av ankomstinformation.</li>
        </ul>

        <h2>Varför uppgifterna används</h2>
        <p>
          Uppgifterna används för att beräkna pris, ta emot och genomföra
          bokningar, tilldela förare, visa resan live, skicka bekräftelser,
          hantera betalning, ge kundsupport och uppfylla rättsliga krav.
          Behandlingen grundas på avtal, rättslig förpliktelse och berättigat
          intresse. Position används bara när funktionen behövs och efter att
          enheten har gett behörighet.
        </p>

        <h2>Bakgrundsposition i förarappen</h2>
        <p>
          När en godkänd förare själv väljer att gå online kan förarappen
          samla in exakt position även när appen inte visas eller telefonens
          skärm är låst. Det behövs för trafikledning, tilldelning av körningar
          och kundens liveföljning av den tilldelade taxin. Insamlingen stoppas
          när föraren går offline eller loggar ut. Behörigheten kan även stängas
          av i telefonens inställningar.
        </p>

        <h2>Mottagare och tjänsteleverantörer</h2>
        <p>
          Nödvändiga uppgifter kan behandlas av leverantörer för datalagring
          och inloggning, kartor och adressökning, betalning, SMS/e-post och
          flyginformation. Endast uppgifter som behövs för respektive tjänst
          delas. Uppgifter säljs inte.
        </p>

        <h2>Ansökan om åkerisamarbete</h2>
        <p>Vid en partneransökan behandlar vi företagsuppgifter, kontaktuppgifter, trafiktillståndsnummer, antal bilar, verksamhetsområde och meddelande för att bedöma samarbetet och kontakta dig. Endast behörig administration kan läsa ansökningarna. En daglig hash av nätverksadressen används för att begränsa missbruk av formuläret. Uppgifterna används inte för automatisk anslutning och raderas eller anonymiseras när de inte längre behövs för ansökan eller ett efterföljande samarbete.</p>

        <h2>Lagring</h2>
        <p>
          Kontouppgifter sparas medan kontot är aktivt. Boknings- och
          betalningsunderlag kan behöva sparas efter en kontoradering för
          bokföring, reklamationer och andra rättsliga skyldigheter. När
          uppgifterna inte längre behövs raderas eller anonymiseras de.
        </p>

        <h2>Dina rättigheter</h2>
        <p>
          Du kan begära tillgång, rättelse, radering eller begränsning och i
          vissa fall invända mot behandlingen. Konto kan raderas direkt i
          kundappen eller förarappen. Läs mer på sidan om
          <Link href="/radera-konto"> kontoradering</Link>. Du har även rätt
          att lämna klagomål till Integritetsskyddsmyndigheten.
        </p>

        <h2>Kontakt</h2>
        <p>
          Avenyn Taxi · Kungsportsavenyn 1, Göteborg<br />
          <a href="mailto:info@avenyntaxi.se">info@avenyntaxi.se</a> ·
          <a href="tel:+46700315315"> +46 700 315 315</a>
        </p>
      </article>
    </main>
  );
}
