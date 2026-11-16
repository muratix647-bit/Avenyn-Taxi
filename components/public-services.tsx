import SocialLinks from "@/components/social-links";
import type {Metadata} from "next";
import Image from "next/image";

const origin = "https://www.avenyntaxi.se";
const paths = {sv: "/taxitjanster-goteborg", en: "/en/services"};
const content = {
  sv: {
    title: "Taxitjänster Göteborg – flygtaxi, företagstaxi & bud | Avenyn Taxi",
    description: "Hitta rätt taxitjänst i Göteborg: resor till Landvetter, företagstaxi, storbil och taxibud. Se priser, boka en resa eller skicka en transportförfrågan.",
    h1: "Taxitjänster i Göteborg", intro: "Välj tjänsten som passar din resa eller transport. Här hittar du bokning, prisinformation och kontaktvägar för Göteborg med omnejd.",
    book: "Boka taxi", call: "Ring oss", language: "English", other: paths.en,
    stepsTitle: "Så bokar du din resa", steps: ["Ange fullständig hämtadress, destination och önskad tid.", "Välj biltyp och eventuella tillval. Kontrollera pris och reseuppgifter.", "Slutför bokningen och kontrollera din bekräftelse."],
    cards: [
      {title: "Taxi i Göteborg", text: "Boka resor mellan bostaden, hotellet, arbetsplatsen och Göteborg Centralstation. Ange en exakt adress och eventuell entré så att föraren hittar rätt mötesplats.", href: "/taxi-goteborg", link: "Taxi Göteborg och bokning"},
      {title: "Taxi till och från Landvetter", text: "Planera flygresan med hämtadress, tid och rätt bilstorlek. På vår Landvettersida finns aktuella områdespriser. Kontrollera resans slutliga pris i bokningen och välj hämtningstid med marginal till flyget.", href: "/taxi-landvetter", link: "Se Landvetterpriser och reseinformation"},
      {title: "Företagstaxi", text: "Behöver företaget ordna resor för medarbetare eller besökare? Beskriv adresser, tider och återkommande behov. Kontakta oss om upplägg och betalning innan resorna beställs.", href: "/foretagstaxi-goteborg", link: "Läs om företagstaxi"},
      {title: "Taxibud och budtransport", text: "Skicka en förfrågan om transport av dokument, nycklar eller mindre paket. Ange adresser, önskad tid, kontaktperson och försändelsens storlek. Vi återkommer om pris och tillgänglighet; förfrågan är inte en bekräftad bokning.", href: "/bud-goteborg", link: "Taxibud och expressbud i Göteborg"},
      {title: "Storbil och barnstol", text: "Välj bil efter antal resenärer och hur mycket bagage ni har. Ange önskemål om barnstol i bokningen. Kontakta oss om du är osäker på vilken bil eller vilket tillval som passar.", href: "/?booking=1#booking-form", link: "Välj bil och tillval i bokningen"},
      {title: "Resor i Göteborg med omnejd", text: "Hitta information om bland annat Hisingen, Mölndal, Partille och Kungälv. Ange alltid den fullständiga adressen för pris och bokning, även när du har valt en ort.", href: "/taxi-omraden", link: "Se orter och områden"},
    ],
    contactTitle: "Frågor om din resa eller transport?", contact: "Kontakta Avenyn Taxi via telefon, WhatsApp eller kontaktformuläret. För transportuppdrag som kräver planering behöver vi bekräfta pris och tillgänglighet.", contactLink: "Kontakt och transportförfrågan", price: "Priser och områden", terms: "Bokningsvillkor", privacy: "Integritet",
  },
  en: {
    title: "Taxi in Gothenburg – airport transfers & courier | Avenyn Taxi",
    description: "Book a taxi in Gothenburg, plan your Landvetter Airport transfer or enquire about business travel and courier services. Booking and contact options from Avenyn Taxi.",
    h1: "Taxi services in Gothenburg", intro: "Choose the service that fits your journey or delivery. Find booking options, airport fare information and ways to contact Avenyn Taxi in Gothenburg and the surrounding area.",
    book: "Book a taxi", call: "Call us", language: "Svenska", other: paths.sv,
    stepsTitle: "How to book your journey", steps: ["Enter your complete pickup address, destination and preferred time.", "Choose a vehicle and any extras. Check the fare and journey details.", "Complete your booking and check your confirmation."],
    cards: [
      {title: "Taxi in Gothenburg", text: "Book a journey between your home, hotel, workplace and Gothenburg Central Station. Use a complete street address and add any entrance or meeting-point details to help your driver find you.", href: "/?lang=en-US#booking-form", link: "Open taxi booking in English"},
      {title: "Landvetter Airport transfers", text: "Plan your trip to or from Gothenburg Landvetter Airport with your pickup address, time and vehicle requirements. Our airport page lists current fares for selected areas. Check your final fare when booking and allow enough time before your flight.", href: "/taxi-landvetter", link: "Airport fares and travel information (Swedish)"},
      {title: "Business travel", text: "Arrange journeys for colleagues and visitors. Tell us your addresses, travel times and any recurring transport needs. Contact us to discuss the arrangement and payment before ordering journeys.", href: "/foretagstaxi-goteborg", link: "Business taxi information (Swedish)"},
      {title: "Courier and small-package deliveries", text: "Enquire about transporting documents, keys or small packages. Include pickup and delivery addresses, preferred time, a contact person and package size. We will respond about price and availability; an enquiry is not a confirmed booking.", href: "/bud-goteborg", link: "Courier service information (Swedish)"},
      {title: "Larger vehicles and child seats", text: "Choose a vehicle for your passenger count and luggage. Add your child-seat request when booking. Contact us if you need help choosing a suitable vehicle or extra.", href: "/?lang=en-US#booking-form", link: "Choose a vehicle and extras"},
      {title: "Gothenburg and surrounding areas", text: "Find travel information for areas including Hisingen, Mölndal, Partille and Kungälv. Always enter a complete pickup and destination address to obtain a fare and make your booking.", href: "/taxi-omraden", link: "Browse towns and areas (Swedish)"},
    ],
    contactTitle: "Questions about a journey or delivery?", contact: "Contact Avenyn Taxi by phone, WhatsApp or the contact form. For transport requests that need planning, we need to confirm the price and availability.", contactLink: "Contact and transport enquiries", price: "Prices and areas", terms: "Booking terms (Swedish)", privacy: "Privacy (Swedish)",
  },
};

export function servicesMetadata(language: "sv" | "en"): Metadata {
  const copy = content[language];
  return {
    title: {absolute: copy.title}, description: copy.description,
    alternates: {canonical: origin + paths[language], languages: {sv: origin + paths.sv, en: origin + paths.en, "x-default": origin + paths.sv}},
    openGraph: {title: copy.title, description: copy.description, url: origin + paths[language], type: "website", siteName: "Avenyn Taxi", locale: language === "en" ? "en_US" : "sv_SE", images: [{url: "/avenyn-taxi-hero-premium.webp", width: 1672, height: 941, alt: "Avenyn Taxi"}]},
  };
}

export default function PublicServices({language}: {language: "sv" | "en"}) {
  const c = content[language];
  const booking = language === "en" ? "/?lang=en-US#booking-form" : "/#booking-form";
  const contact = language === "en" ? "/om-avenyn-taxi?lang=en-US#service-request" : "/om-avenyn-taxi#service-request";
  const schema = {"@context": "https://schema.org", "@type": "CollectionPage", "@id": origin + paths[language] + "#page", url: origin + paths[language], name: c.h1, description: c.description, inLanguage: language, about: {"@id": origin + "/#taxi"}};
  return <main className="seoLanding" lang={language}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}}/>
    <header className="seoHeader"><a className="seoBrand" href="/"><Image src="/avenyn-logo-optimized.webp" width={56} height={56} alt="Avenyn Taxi"/><b>Avenyn Taxi</b></a><nav aria-label={language === "en" ? "Main navigation" : "Huvudmeny"}><a href={booking}>{c.book}</a><a href={c.other} hrefLang={language === "en" ? "sv" : "en"}>{c.language}</a></nav><a className="seoPhone" href="tel:+46700315315">+46 700 315 315</a></header>
    <nav className="seoBreadcrumb" aria-label={language === "en" ? "Breadcrumb" : "Brödsmulor"}><a href="/">Avenyn Taxi</a><span> / </span><span aria-current="page">{c.h1}</span></nav>
    <section className="seoHero"><div><small>AVENYN TAXI · GÖTEBORG</small><h1>{c.h1}</h1><p>{c.intro}</p><div className="seoActions"><a className="seoPrimary" href={booking}>{c.book}</a><a href="tel:+46700315315">{c.call}</a></div></div><aside><h2>{c.stepsTitle}</h2><ol>{c.steps.map(step => <li key={step}>{step}</li>)}</ol></aside></section>
    <section className="seoContent">{c.cards.map(card => <article key={card.title}><h2>{card.title}</h2><p>{card.text}</p><a href={card.href}>{card.link} →</a></article>)}</section>
    <section className="seoFinal"><h2>{c.contactTitle}</h2><p>{c.contact}</p><a href={contact}>{c.contactLink}</a><p><a href="https://wa.me/46700315315">WhatsApp</a></p></section>
    <footer className="seoFooter"><a href="/">Avenyn Taxi</a><a href="tel:+46700315315">+46 700 315 315</a><a href="mailto:info@avenyntaxi.se">info@avenyntaxi.se</a><a href="/integritet">{c.privacy}</a><a href="/bokningsvillkor">{c.terms}</a><a href={c.other} hrefLang={language === "en" ? "sv" : "en"}>{c.language}</a><SocialLinks /></footer>
  </main>;
}
