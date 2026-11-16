import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {canonical: "https://www.avenyntaxi.se/bokningsvillkor"},
  title: "Bokningsvillkor",
  description:
    "Villkor för bokningar och förbokningar hos Avenyn Taxi i Göteborg.",
};

export default function BookingTermsPage() {
  return (
    <main className="legalPage">
      <article>
        <a className="legalBack" href="/">← Till Avenyn Taxi</a>
        <small>AVENYN TAXI · SENAST UPPDATERAD 2 OKTOBER 2026</small>
        <h1>Bokningsvillkor</h1>
        <p>
          Dessa villkor gäller när du bokar eller förbokar en resa med Avenyn
          Taxi, som drivs av Citra Trans och Bilservice AB, org.nr 556597-4796.
          Villkoren kompletterar dina rättigheter enligt tvingande svensk
          konsumentlagstiftning.
        </p>

        <h2>När bokningen är bekräftad</h2>
        <p>
          En bokningsförfrågan är mottagen när den har skickats från webbplatsen
          eller chatten. Bokningen är bekräftad när du får en bekräftelse på
          skärmen, via e-post eller SMS med bokningsreferens. Kontrollera alltid
          uppgifterna i bekräftelsen och kontakta oss direkt om något är fel.
        </p>

        <h2>Bokning och förbokning</h2>
        <p>
          En förbokning betyder att vi planerar hämtning till vald tid. Den är
          inte en garanti för att bilen anländer på sekunden. Trafik, olyckor,
          väder, vägarbeten, vägavstängningar, myndighetsbeslut, tekniska fel
          eller andra omständigheter utanför vår rimliga kontroll kan påverka
          hämtningstiden. Vi försöker då informera dig och ordna en rimlig
          alternativ lösning.
        </p>
        <p>
          Planera alltid en skälig tidsmarginal till flyg, tåg, vårdbesök,
          möten och andra tidskritiska anslutningar.
        </p>

        <h2>Ditt ansvar som kund</h2>
        <ul>
          <li>Ange korrekt och fullständig hämtadress, destination, datum och tid.</li>
          <li>Ange ett telefonnummer och en e-postadress där du kan nås.</li>
          <li>Var på avtalad hämtplats i tid och håll telefonen tillgänglig.</li>
          <li>Kontrollera antal passagerare, biltyp, barnstol, bagage och flygnummer.</li>
          <li>Meddela ändringar så snart som möjligt.</li>
        </ul>

        <h2>Ändring och avbokning · 24 timmar</h2>
        <p>Du kan själv ändra datum och hämtningstid i kundappen eller via din reselänk innan föraren har påbörjat hämtningen. Det går även under de sista 24 timmarna före resan. Den nya tiden visas för kunden, trafikledningen och föraren.</p>
        <p>Vid avbokning inom 24 timmar före hämtning eller om du inte kommer till den bokade resan debiteras 100 procent av det bekräftade priset. En spärrad eller nekad tidsändring avbokar inte resan och skapar ingen extra avgift. Kontakta oss för avbokning när hämtningen är mindre än 24 timmar bort.</p>
        <p>24-timmarsregeln om full betalning gäller bokningar där kunden har godkänt denna version av villkoren. För äldre bokningar gäller de villkor som avtalades när bokningen gjordes. Om Avenyn Taxi ställer in resan tas ingen avbokningsavgift ut. Tvingande konsumenträttigheter gäller alltid.</p>

        <h2>Pris och betalning</h2>
        <p>
          Det pris som visas och bekräftas gäller för de adresser, stopp och
          tillval som valts. Om du ändrar rutten, lägger till väntetid, stopp
          eller andra tillval räknas ett nytt totalpris fram och ska godkännas
          innan ändringen genomförs. Kortuppgifter hanteras av vår
          betalningsleverantör och lagras inte av Avenyn Taxi.
        </p>

        <h2>Försening, inställd resa och ansvar</h2>
        <p>
          Avenyn Taxi ansvarar inte för försening eller utebliven transport som
          beror på omständigheter utanför vår rimliga kontroll, i den
          utsträckning lagen tillåter. Bedömningen görs utifrån omständigheterna
          i det enskilda fallet. Om vi ställer in en förbetald resa återbetalas
          den del av betalningen som avser den transport som inte utförts.
        </p>
        <p>
          Vi ersätter inte indirekta följdskador, exempelvis en missad
          anslutning eller ett missat möte, när kunden inte har lämnat en
          rimlig tidsmarginal. Inget i villkoren begränsar ansvar eller
          konsumenträttigheter som enligt lag inte får avtalas bort.
        </p>

        <h2>Reklamation</h2>
        <p>
          Kontakta oss skriftligen så snart som möjligt och ange
          bokningsreferens, vad som inträffade och eventuella kvitton. Om vi
          inte kommer överens kan du vända dig till Allmänna
          reklamationsnämnden (ARN) för prövning.
        </p>

        <h2>Kontakt</h2>
        <p>
          Citra Trans och Bilservice AB · org.nr 556597-4796<br />
          Telefon: <a href="tel:+46700315315">+46 700 315 315</a><br />
          E-post: <a href="mailto:info@avenyntaxi.se">info@avenyntaxi.se</a>
        </p>
      </article>
    </main>
  );
}
