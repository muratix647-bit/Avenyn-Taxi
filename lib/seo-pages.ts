export type SeoPage = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  eyebrow: string;
  intro: string;
  area: string;
  bookingText: string;
  ctaType?: "book" | "quote" | "service";
  relatedSlugs?: string[];
  sections: Array<{ heading: string; text: string }>;
  searches: string[];
};

export const seoPages: SeoPage[] = [
{"slug": "taxi-centrum", "title": "Taxi Göteborg Centrum – boka resa och Landvettertransfer", "description": "Boka taxi i Göteborg centrum med Avenyn Taxi. Hämtning vid hotell, Kungsportsplatsen och Nordstan. Se priset före bokning och förboka till Landvetter.", "h1": "Taxi i Göteborg centrum", "eyebrow": "GÖTEBORG CENTRUM · AVENYN TAXI", "intro": "Boka en resa från centrum till hemmet, jobbet, Centralstationen eller Landvetter. Ange gatuadress och entré, välj önskad tid och kontrollera priset innan du bekräftar. Avenyn Taxi hjälper privatpersoner och företag i Göteborg sedan 2003.", "area": "Göteborg centrum", "bookingText": "Boka taxi från centrum", "relatedSlugs": ["taxi-avenyn", "taxi-goteborg-central", "taxi-landvetter", "taxi-haga"], "sections": [{"heading": "Hämtning vid Nordstan och Brunnsparken", "text": "Ange en gatuadress där bilen kan stanna i stället för enbart köpcentrumets namn. Om du befinner dig inne i Nordstan, kontrollera vilken utgång du använder. Vid Brunnsparken är en tydlig mötesplats särskilt viktig eftersom området har mycket kollektivtrafik och gående."}, {"heading": "Hotell, kontor och möten i city", "text": "Skriv hotellets eller företagets namn tillsammans med gatuadress och gatunummer. Kontrollera att det är entrén där du väntar. Vid en tidsbestämd tjänsteresa kan du förboka hämtningen och lägga till referens och eventuella stopp i bokningen."}, {"heading": "Från Göteborg centrum till Landvetter", "text": "Välj Landvetter Airport som destination. Det aktuella priset beror på den fullständiga hämtadressen och dina val. Se de publicerade områdespriserna i Landvetterprislistan och kontrollera resans totalpris i bokningen. Planera hämtningen med marginal till flygets incheckning."}, {"heading": "Hemresa efter restaurang eller evenemang", "text": "Ange restaurangens gatuadress och välj Åk nu eller en senare hämtningstid. Ring om du behöver besked om aktuell väntetid. Föraren behöver ett nåbart mobilnummer och en plats där det går att stanna för upphämtning."}, {"heading": "När ni reser flera tillsammans", "text": "Ange antal passagerare och välj storbil om det behövs. Lägg till barnstol i formuläret och skriv om ni har barnvagn eller mycket bagage. Kontrollera tillvalen och priset före bekräftelse."}], "searches": ["taxi Göteborg centrum", "boka taxi centrum", "taxi centrum Landvetter"]},
{"slug": "taxi-avenyn", "title": "Taxi Avenyn Göteborg – boka från Kungsportsavenyn", "description": "Boka Avenyn Taxi från Kungsportsavenyn, Götaplatsen eller ditt hotell. Res inom Göteborg eller till Landvetter. Ange adress och se priset före bokning.", "h1": "Taxi på Avenyn i Göteborg", "eyebrow": "KUNGSPORTSAVENYN · GÖTAPLATSEN", "intro": "Ska du resa från Avenyn efter hotellvistelsen, restaurangbesöket eller en kväll på stan? Boka Avenyn Taxi med en tydlig hämtadress längs Kungsportsavenyn eller i närheten. Välj destination, tid och biltyp i samma formulär.", "area": "Kungsportsavenyn, Göteborg", "bookingText": "Boka taxi från Avenyn", "relatedSlugs": ["taxi-centrum", "taxi-goteborg-central", "taxi-landvetter", "taxi-johanneberg"], "sections": [{"heading": "Välj rätt entré längs Kungsportsavenyn", "text": "Avenyn har många hotell, restauranger och entréer. Skriv gatunummer och verksamhetens namn så att föraren kan skilja din hämtplats från andra adresser. Om du står på en sidogata ska den adressen användas i bokningen."}, {"heading": "Taxi från Götaplatsen och kulturbesök", "text": "Efter ett besök vid Götaplatsen, Konserthuset eller Stadsteatern anger du en tillgänglig mötesplats med gatuadress. Vid större evenemang kan många vilja resa samtidigt. Förboka gärna och håll telefonen tillgänglig om föraren behöver stämma av hämtningen."}, {"heading": "Avenyn till Landvetter flygplats", "text": "För en tidig flygresa väljer du datum och hämtningstid i förväg. Ange hotellets adress och Landvetter Airport som destination, och välj passagerare, biltyp och tillval. Bokningen kontrollerar den exakta adressen mot de aktiva fastprisområdena innan priset visas."}, {"heading": "Från Avenyn till Göteborg Centralstation", "text": "Välj Göteborg Centralstation som destination och planera marginal till tågets avgång. Ange önskad hämtning vid hotellets entré eller annan tydlig gatuadress. Restiden kan påverkas av trafik, evenemang och vägarbeten."}, {"heading": "Boka via mobil eller få hjälp per telefon", "text": "Webbokningen fungerar på mobil och dator. Du kan också använda Avenyn Taxis kundapp eller öppna Boka via chatt på startsidan. Ring 0700-315 315 om du behöver hjälp med mötesplats, bagage eller aktuell tillgänglighet."}], "searches": ["taxi Avenyn", "taxi Kungsportsavenyn", "taxi Götaplatsen", "taxi Avenyn Landvetter"]},
  {
    slug: "taxi-goteborg",
    title: "Taxi nära mig i Göteborg – boka Avenyn Taxi",
    description: "Söker du taxi nära dig i Göteborg? Ange hämtadress, se priset och boka Avenyn Taxi. Hämtning i centrum, på Hisingen och i Majorna. Ring 0700-315 315.",
    h1: "Taxi nära mig i Göteborg",
    eyebrow: "AVENYN TAXI · GÖTEBORG",
    intro: "Behöver du taxi i Göteborg? Hos Avenyn Taxi bokar du resan online från mobil eller dator. Fyll i hämtadress och destination, välj vanlig bil eller storbil och kontrollera uppgifterna innan du bekräftar.",
    area: "Göteborg",
    bookingText: "Boka taxi i Göteborg",
    sections: [
      {heading:"Så bokar du taxi nära dig",text:"Ange din fullständiga hämtadress och destination i bokningen. Du kan använda platsknappen om du tillåter platsåtkomst, men kontrollera alltid gatunummer och entré innan du går vidare. Välj Åk nu för en aktuell resa eller Förboka för ett senare datum. Kontrollera pris, biltyp och kontaktuppgifter före bekräftelse."},
      {heading:"Hur snart kan taxin hämta mig?",text:"Tillgänglighet och hämtningstid beror på var du är, trafikläget och vilka bilar som är lediga. Ring 0700-315 315 om du behöver veta aktuell väntetid. En sökning efter taxi nära mig visar inte i sig att en bil finns precis intill din plats."},
      {heading:"Vanliga upphämtningsplatser i Göteborg",text:"Boka från Göteborg Centralstation, Kungsportsavenyn, Järntorget, Linné, Majorna, Liseberg, Svenska Mässan, hotellområden, hamnen eller färjeterminalerna. Välj alltid fullständig adress och gatunummer för en tydlig upphämtning."},
      {heading:"Taxi kväll, natt och förbokning",text:"Välj datum och hämtningstid i förväg. Vid evenemang, tidiga tåg och flyg rekommenderas förbokning med tydlig mötesplats och ett mobilnummer som föraren kan nå."},
      {heading:"Centralstationen, hotell och Avenyn",text:"Vid Göteborg Centralstation anger du en tydlig mötesplats, till exempel hotellets entré eller en överenskommen gatuadress. Kungsportsavenyn, Drottningtorget och hotell runt centrum har olika möjligheter att stanna. Ange hotellets namn och gatunummer och håll telefonen tillgänglig vid hämtning."},
      {heading:"Järntorget, Linné och Majorna",text:"För hämtning efter ett restaurangbesök kring Järntorget, Linnégatan eller i Majorna väljer du en fullständig gatuadress. Vid uteserveringar och trafikerade korsningar hjälper en tydlig mötesplats föraren att hitta dig. Planera återresan i förväg när ni vet när kvällen slutar."},
      {heading:"Hisingen och älvförbindelserna",text:"Backa, Lindholmen, Eriksberg och Torslanda ligger på olika delar av Hisingen. Skriv därför stadsdel och exakt adress i bokningen. Resor över älven påverkas av trafik och vägarbeten; välj hämtningstid med marginal när du ska hinna till ett tåg, möte eller flyg."},
      {heading:"Liseberg och Svenska Mässan",text:"Vid evenemang kan många människor lämna området samtidigt. Förboka hämtningen och ange en tillgänglig gatuadress vid hotell eller entré. Om ni är ett större sällskap väljer ni storbil och anger antal passagerare samt bagage innan bokningen bekräftas."},
      {heading:"Hamnen och färjeterminalerna",text:"Kontrollera vilken terminal färjan använder och skriv terminalens namn och adress. Ange även färjans ankomsttid och ett nåbart mobilnummer. Planera marginal för avstigning och bagage innan taxins hämtningstid."},
      {heading:"Göteborg till Landvetter",text:"För flygplatsresor anger du Landvetter Airport som destination och kan lägga till flygnummer. Aktuella fastpriser visas endast när adressen matchar ett aktivt område i Avenyn Taxis centrala prislista."},
    ],
    searches:["taxi Göteborg","boka taxi Göteborg","taxi i Göteborg","Göteborg taxi","taxi Göteborg pris"],
  },
  {
    slug: "taxi-landvetter",
    title: "Taxi Landvetter – Fastpris Göteborg ↔ Landvetter",
    description: "Boka taxi till eller från Göteborg Landvetter Airport. Se aktiva fastpriser från Avenyn Taxis prislista, ange flygnummer och välj barnstol eller storbil.",
    h1: "Taxi Landvetter – fastpris till och från Göteborg",
    eyebrow: "FLYGPLATSTRANSFER · LANDVETTER",
    intro: "Sök din hämtadress, välj Landvetter Airport och se priset före bokning. Förboka resan till avgången eller hämtning efter landning med Avenyn Taxi. Ange datum, biltyp och flygnummer i samma formulär.",
    area: "Landvetter Airport",
    bookingText: "Boka taxi Landvetter",
    sections: [
      {heading:"Se priset från din adress",text:"Skriv din fullständiga hämtadress och välj rätt adressförslag. Välj Landvetter Airport som destination, eller byt riktning för hemresan. Bokningen visar priset för vald resa och tillval före bekräftelse. De aktiva Landvetter-fastpriserna kommer från samma centrala prislista som används vid bokning."},
      {heading:"Taxi till Landvetter",text:"Ange fullständig hämtadress och välj Göteborg Landvetter Airport som destination. Lägg till datum, tid, antal passagerare och gärna flygnummer. Planera marginal för trafik, incheckning och bagage."},
      {heading:"Taxi från Landvetter",text:"Välj flygplatsen som hämtplats och skriv din destination. Ange flygnummer så att resan kan följas när flyginformation finns. Bekräftelsen samlar mötesuppgifter, kontaktuppgifter och den personliga spårningslänken."},
      {heading:"Planera hämtning efter landning",text:"Boka flygplatsen som hämtplats och ange flygnummer, datum, antal passagerare och din destination. Räkna med tid för att lämna flygplanet, hämta bagage och ta dig till den överenskomna mötesplatsen. Kontrollera bokningsuppgifterna och kontakta oss om resans förutsättningar ändras."},
      {heading:"Enkel resa eller återresa",text:"Du kan boka både resan till flygplatsen och hämtningen efter hemkomsten. Kontrollera adresser, datum och hämtningstid för varje riktning. För återresan från Landvetter anger du det ankommande flygets nummer så att rätt ankomst kan följas."},
      {heading:"Bagage och biltyp före bokning",text:"Ange hur många som reser och välj vanlig bil eller storbil. Barnstol läggs till i bokningen. Har ni barnvagn, flera stora resväskor eller annat skrymmande bagage bör ni skriva det i meddelandet och kontakta oss vid osäkerhet om utrymmet."},
      {heading:"Officiella fastpriser",text:"Landvetter-priser hämtas från Avenyn Taxis centrala prismotor. Ett pris visas bara när den valda adressen kan kopplas till ett aktivt officiellt fastprisområde. Om inget pris kan verifieras ska du kontakta oss för pris."},
    ],
    searches:["Landvetter taxi","boka taxi Landvetter","taxi till Landvetter","taxi från Landvetter"],
  },
  {
    slug: "taxi-goteborg-central",
    relatedSlugs: ["taxi-centrum","taxi-avenyn","taxi-landvetter","taxi-goteborg"],
    title: "Taxi Göteborg Centralstation – Boka Taxi",
    description: "Boka taxi vid Göteborg Centralstation med Avenyn Taxi. Ange vidare destination, välj tid och bil och få tydlig bokningsbekräftelse.",
    h1: "Taxi Göteborg Centralstation",
    eyebrow: "GÖTEBORG CENTRAL · TAXI",
    intro: "Kommer du med tåg till Göteborg Central? Boka en taxi vidare till hotell, bostad, möte eller Landvetter och ange önskad hämtningstid i förväg.",
    area: "Göteborg Centralstation",
    bookingText: "Boka taxi vid Göteborg Central",
    sections: [
      {heading:"Tydlig upphämtning vid Centralen",text:"Göteborg Centralstation har flera utgångar. Ange vilken entré eller gatuadress du väntar vid, till exempel vid Drottningtorget, och kontrollera telefonnumret i bokningen. Om du kommer via Nils Ericson Terminalen ska du ange terminalen och en tydlig mötesplats. En förbokad bil behöver inte stå i den vanliga taxikön."},
      {heading:"Vidare genom Göteborg",text:"Res direkt till exempelvis Avenyn, Majorna, Hisingen, Mölndal eller andra adresser i Göteborgsområdet utan byte till lokaltrafik."},
      {heading:"Från Centralstationen till Landvetter",text:"Boka resan vidare till Landvetter Airport genom att välja flygplatsen som destination. Systemet visar tillgängligt pris före bekräftelse."},
    ],
    searches:["taxi Göteborg Centralstation","taxi Göteborg Central","boka taxi Centralstationen Göteborg"],
  },
  {
    slug: "taxi-frolunda",
    title: "Taxi Västra Frölunda – boka resa och Landvettertaxi",
    description: "Boka taxi i Västra Frölunda med Avenyn Taxi. Res inom Göteborg eller till och från Landvetter med adress och pris kontrollerade online.",
    h1: "Taxi Västra Frölunda och Landvetter",
    eyebrow: "VÄSTRA FRÖLUNDA · GÖTEBORG",
    intro: "Boka taxi från Västra Frölunda till en adress i Göteborg eller vidare till Landvetter Airport. Den fullständiga adressen används för att identifiera rätt resa och eventuellt fastprisområde.",
    area: "Västra Frölunda",
    bookingText: "Boka taxi från Västra Frölunda",
    sections: [
      {heading:"Taxi i Västra Frölunda",text:"Vi hämtar vid bostäder, arbetsplatser och andra valda adresser i Västra Frölunda. Välj adressförslaget med rätt gatunummer och postort."},
      {heading:"Taxi Västra Frölunda–Landvetter",text:"För flygplatsresan väljer du Landvetter Airport som destination. Ett publicerat fastpris används när den valda adressen kan verifieras mot rätt område."},
      {heading:"För familj eller större sällskap",text:"Ange passagerarantal och välj storbil om ni är fler. Barnstol kan bokas som tillval direkt i formuläret."},
    ],
    searches:["taxi Västra Frölunda","taxi Västra Frölunda Landvetter","boka taxi Frölunda"],
  },
  {
    slug: "taxi-molndal",
    title: "Taxi Mölndal – Boka Taxi & Landvetter Fastpris",
    description: "Boka taxi i Mölndal med Avenyn Taxi för resor lokalt, till Göteborg eller Landvetter. Välj exakt adress och få pris före bokning.",
    h1: "Taxi Mölndal",
    eyebrow: "MÖLNDAL · TAXI",
    intro: "Från Mölndal kan du boka Avenyn Taxi till Göteborg, Landvetter eller en annan destination. Adress, tid, passagerare och biltyp registreras tillsammans.",
    area: "Mölndal",
    bookingText: "Boka taxi i Mölndal",
    sections: [
      {heading:"Taxi i Mölndal och närliggande områden",text:"Boka från Mölndal centrum, Åby, Krokslätt, Sisjön eller en annan fullständig adress i kommunen. Välj adressförslaget med rätt gatunummer så att hämtningen och prisunderlaget blir korrekta."},
      {heading:"Mölndal till Landvetter",text:"Välj Landvetter Airport med flygplatsknappen. Om adressen hör till ett publicerat fastprisområde visas det priset före bekräftelse."},
      {heading:"Bekräftelse och spårning",text:"När bokningen har skapats får du bokningsuppgifterna via e-post och en länk som används för att följa taxin när resan hanteras."},
    ],
    searches:["taxi Mölndal","boka taxi Mölndal","taxi Mölndal Landvetter"],
  },
  {
    slug: "taxi-partille",
    title: "Taxi Partille – boka taxi till Göteborg och Landvetter",
    description: "Boka taxi i Partille online med Avenyn Taxi. Ange fullständig adress, välj bil och boka resa till Göteborg eller Landvetter.",
    h1: "Taxi Partille för lokala resor och flygtransfer",
    eyebrow: "PARTILLE · TAXI",
    intro: "Boka hämtning i Partille för resa till Göteborg, Landvetter eller annan vald destination. Du ser resans uppgifter samlade innan bokningen bekräftas.",
    area: "Partille",
    bookingText: "Boka taxi i Partille",
    sections: [
      {heading:"Från Partille till Göteborg",text:"Välj exakt hämtadress och den adress i Göteborg du vill till. Bokningen kan göras i förväg från både mobil och dator."},
      {heading:"Taxi Partille–Landvetter",text:"När Landvetter Airport ingår i resan kontrolleras adressen mot Avenyn Taxis befintliga fastprisområden. Rätt område prioriteras framför annan beräkning."},
      {heading:"Vanlig bil eller storbil",text:"Reser ni upp till fyra personer kan ni välja vanlig bil. För fem till sju passagerare väljer ni storbil i bokningen."},
    ],
    searches:["taxi Partille","boka taxi Partille","taxi Partille Landvetter"],
  },
  {
    slug: "taxi-hisingen",
    title: "Taxi Hisingen – Boka Taxi till Göteborg & Landvetter",
    description: "Boka taxi på Hisingen med Avenyn Taxi. Välj korrekt hämtadress för resa inom Göteborg eller till och från Landvetter Airport.",
    h1: "Taxi Hisingen",
    eyebrow: "HISINGEN · GÖTEBORG",
    intro: "Hisingen består av många områden, därför är den exakta gatuadressen viktig. Välj rätt adressförslag när du bokar taxi till Göteborg, Landvetter eller annan destination.",
    area: "Hisingen",
    bookingText: "Boka taxi på Hisingen",
    sections: [
      {heading:"Taxi från områden på Hisingen",text:"Boka från Backa, Lindholmen, Eriksberg, Torslanda, Bäckebol eller en annan adress på Hisingen. Fullständig gata, gatunummer och postort hjälper systemet att registrera rätt upphämtningsplats."},
      {heading:"Hisingen till Landvetter",text:"Välj Landvetter Airport som destination och den verkliga hämtadressen på Hisingen. Om adressen matchar ett publicerat område visas fastpriset direkt."},
      {heading:"Planera tid och bil",text:"Ange när taxin ska hämta, hur många som reser och om ni behöver storbil eller barnstol. Uppgifterna följer med i bokningen."},
    ],
    searches:["taxi Hisingen","boka taxi Hisingen","taxi Hisingen Landvetter"],
  },
  {
    slug: "taxi-majorna",
    title: "Taxi Majorna – boka taxi i Göteborg online",
    description: "Boka taxi i Majorna med Avenyn Taxi. Res inom Göteborg eller till Landvetter med exakt adress, val av bil och bekräftelse via e-post.",
    h1: "Taxi Majorna i Göteborg",
    eyebrow: "MAJORNA · GÖTEBORG",
    intro: "Boka taxi från Majorna till Göteborg Central, Landvetter eller en annan adress. Du väljer upphämtning, destination och tid direkt i Avenyn Taxis bokning.",
    area: "Majorna",
    bookingText: "Boka taxi i Majorna",
    sections: [
      {heading:"Boka från gata och gatunummer",text:"Välj den fullständiga adressen i sökresultatet så att föraren får rätt upphämtningsplats. Du kan även använda telefonens position för att hitta aktuell adress."},
      {heading:"Majorna till Göteborg Central",text:"För tågresan väljer du Göteborg Centralstation som destination. Kontrollera önskad tid och lämna gärna tåginformation i meddelandefältet."},
      {heading:"Majorna till Landvetter",text:"Flygplatsen kan väljas med en genväg i formuläret. Systemet använder befintliga fastprisregler när adressens område kan identifieras säkert."},
    ],
    searches:["taxi Majorna","boka taxi Majorna","taxi Majorna Landvetter"],
  },
  {
    slug: "taxi-kungalv",
    title: "Taxi Kungälv – boka till Göteborg och Landvetter",
    description: "Boka taxi i Kungälv med Avenyn Taxi. Ange adress och tid online för resa till Göteborg, Landvetter eller annan destination.",
    h1: "Taxi Kungälv med bokning online",
    eyebrow: "KUNGÄLV · VÄSTRA GÖTALAND",
    intro: "Förboka taxi från Kungälv till Göteborg, Landvetter Airport eller en adress du väljer. Den exakta hämtadressen används för att skapa en tydlig bokning.",
    area: "Kungälv",
    bookingText: "Boka taxi i Kungälv",
    sections: [
      {heading:"Kungälv till Göteborg",text:"Boka en sammanhängande resa till hotell, möte, Centralstationen eller annan adress i Göteborg. Du väljer datum och tid i formuläret."},
      {heading:"Kungälv till Landvetter",text:"Välj flygplatsen som destination och kontrollera priset som visas före bokningen. Publicerade fastprisområden används när adressen kan verifieras."},
      {heading:"Information som följer med",text:"Passagerarantal, biltyp, barnstol, flygnummer och meddelande kan samlas i samma beställning."},
    ],
    searches:["taxi Kungälv","boka taxi Kungälv","taxi Kungälv Landvetter"],
  },
  {
    slug: "taxi-lerum",
    title: "Taxi Lerum – boka till Göteborg och Landvetter",
    description: "Boka taxi i Lerum online med Avenyn Taxi för resor till Göteborg och Landvetter. Välj exakt adress, tid och biltyp.",
    h1: "Taxi Lerum för stad och flygplats",
    eyebrow: "LERUM · VÄSTRA GÖTALAND",
    intro: "Boka taxi från Lerum till Göteborg, Landvetter eller annan destination. Genom att välja en fullständig adress får bokningen rätt platsinformation.",
    area: "Lerum",
    bookingText: "Boka taxi i Lerum",
    sections: [
      {heading:"Förboka från Lerum",text:"Välj dag och tid som passar resan. Bekräftelsen visar hämtadress, destination, passagerare, biltyp och övriga val."},
      {heading:"Taxi Lerum–Landvetter",text:"Använd genvägen till Landvetter i formuläret. Om adressen hör till ett aktivt fastprisområde visas det gällande priset före bekräftelse."},
      {heading:"Kontakt när du behöver hjälp",text:"Om systemet inte säkert kan identifiera ett prisområde kan du ringa eller skriva till Avenyn Taxi för hjälp med resan."},
    ],
    searches:["taxi Lerum","boka taxi Lerum","taxi Lerum Landvetter"],
  },
  {
    slug: "taxi-alingsas",
    title: "Taxi Alingsås – boka resa till Landvetter",
    description: "Boka taxi mellan Alingsås och Landvetter eller Göteborg med Avenyn Taxi. Ange exakt adress, tid och bil online.",
    h1: "Taxi Alingsås till Göteborg och Landvetter",
    eyebrow: "ALINGSÅS · FLYGPLATSTRANSFER",
    intro: "Planera en taxiresa från Alingsås till Landvetter, Göteborg eller annan destination. Välj den verkliga adressen och kontrollera resans uppgifter före bekräftelse.",
    area: "Alingsås",
    bookingText: "Boka taxi från Alingsås",
    ctaType: "quote",
    sections: [
      {heading:"Alingsås till Landvetter",text:"Välj Landvetter Airport som destination, ange hämtningstid och lägg gärna till flygnummer. Systemet visar ett tillgängligt fastpris när adressen kan verifieras."},
      {heading:"Taxi till Göteborg",text:"Boka direkt till Göteborg Central, hotell, arbetsplats eller annan vald adress. Resan registreras med all kontakt- och platsinformation."},
      {heading:"Plats för sällskapet",text:"Välj mellan vanlig bil och storbil utifrån hur många som reser. Barnstol läggs till separat i bokningen."},
    ],
    searches:["taxi Alingsås","taxi Alingsås Landvetter","boka taxi Alingsås"],
  },
  {
    slug: "taxi-goteborg-tjorn",
    title: "Taxi Göteborg–Tjörn – boka resa online",
    description: "Boka taxi mellan Göteborg och Tjörn med Avenyn Taxi. Välj fullständig adress, önskad tid och biltyp i det befintliga bokningsflödet.",
    h1: "Taxi Göteborg–Tjörn",
    eyebrow: "GÖTEBORG ↔ TJÖRN",
    intro: "Boka en direkt taxiresa mellan Göteborg och Tjörn med upphämtning på den adress du väljer. För en Landvetterresa kontrollerar bokningen automatiskt om den valda adressen omfattas av Avenyn Taxis aktuella fastprislista.",
    area: "Tjörn",
    bookingText: "Boka taxi till eller från Tjörn",
    ctaType: "quote",
    sections: [
      {heading:"Taxi från Göteborg till Tjörn",text:"Välj en riktig hämtadress i Göteborg och den fullständiga destinationen på Tjörn. Det ger föraren tydliga platsuppgifter och gör resan enkel att planera i förväg."},
      {heading:"Taxi Tjörn–Landvetter",text:"Välj Landvetter Airport som destination och ange den exakta adressen på Tjörn. Om ingen aktiv fastpriszon finns visas inget påhittat belopp; kontakta då Avenyn Taxi för pris."},
      {heading:"Bil för resan",text:"Välj vanlig bil för upp till fyra personer eller storbil för fem till sju passagerare. Barnstol och flygnummer kan läggas till i bokningen."},
    ],
    searches:["taxi Tjörn","taxi Tjörn Landvetter","taxi Göteborg Tjörn","boka taxi Tjörn"],
  },
  {
    slug: "taxi-goteborg-smogen",
    title: "Taxi Smögen – Göteborg & Landvetter | Förboka",
    description: "Boka taxi mellan Göteborg och Smögen med Avenyn Taxi. Ange exakt adress, tid, passagerare och biltyp för en tydlig bokning.",
    h1: "Taxi Göteborg–Smögen",
    eyebrow: "GÖTEBORG ↔ SMÖGEN",
    intro: "Res direkt mellan Göteborg och Smögen utan byten. Bokningen samlar hämtadress, destination, tid och kontaktuppgifter och passar både enkel resa och planerad återresa.",
    relatedSlugs: ["taxi-vastkusten", "taxi-marstrand", "taxi-henan", "taxi-landvetter"],
    area: "Smögen",
    bookingText: "Boka taxi mellan Göteborg och Smögen",
    ctaType: "quote",
    sections: [
      {heading:"Taxi från Göteborg till Smögen",text:"Ange den adress i Göteborg där resan börjar och den fullständiga adressen på Smögen. För en längre resa är det bra att boka i god tid och kontrollera alla uppgifter före bekräftelse."},
      {heading:"Taxi Smögen–Göteborg",text:"Boka returresan till Göteborg Centralstation, hotell, bostad eller annan adress. Efter en bokning kan du enkelt vända resvägen och skapa en återresa."},
      {heading:"Taxi Smögen–Landvetter",text:"För flygplatsresan väljer du Landvetter Airport och fyller i önskad hämtningstid. Om orten saknar aktivt fastpris i prislistan ber systemet dig kontakta Avenyn Taxi för pris."},
    ],
    searches:["taxi Smögen","taxi Smögen Göteborg","taxi Smögen Landvetter","taxi Göteborg Smögen"],
  },
  {
    slug: "taxi-goteborg-stenungsund",
    title: "Taxi Göteborg–Stenungsund – boka online",
    description: "Boka taxi mellan Göteborg och Stenungsund med Avenyn Taxi. Välj rätt adress, tid och fordon för resan eller flygtransfern.",
    h1: "Taxi Göteborg–Stenungsund",
    eyebrow: "GÖTEBORG ↔ STENUNGSUND",
    intro: "Boka taxi mellan Göteborg och Stenungsund till bostad, arbetsplats, station eller annan vald adress. Du kan även boka vidare till Landvetter Airport från samma formulär.",
    area: "Stenungsund",
    bookingText: "Boka taxi till eller från Stenungsund",
    ctaType: "quote",
    sections: [
      {heading:"Taxi Göteborg–Stenungsund",text:"Välj fullständiga adresser i båda ändar av resan. Adressförslagen hjälper dig att få med gatunummer, postnummer och rätt ort i bokningen."},
      {heading:"Taxi Stenungsund–Landvetter",text:"Välj Landvetter Airport som destination och lägg gärna till flygnummer. Fastpris visas endast om en aktiv priszon kan identifieras i den befintliga prislistan."},
      {heading:"Boka för rätt antal resenärer",text:"Ange passagerarantal och välj storbil när ni är fem till sju personer. Barnstol kan bokas som separat tillval."},
    ],
    searches:["taxi Stenungsund","taxi Stenungsund Landvetter","taxi Göteborg Stenungsund","boka taxi Stenungsund"],
  },
  {
    slug: "taxi-goteborg-kungsbacka",
    title: "Taxi Göteborg–Kungsbacka – boka online",
    description: "Boka taxi mellan Göteborg och Kungsbacka med Avenyn Taxi. För Landvetterresor används Kungsbackas befintliga aktiva fastpris när adressen verifieras.",
    h1: "Taxi Göteborg–Kungsbacka",
    eyebrow: "GÖTEBORG ↔ KUNGSBACKA",
    intro: "Boka taxi mellan Göteborg och Kungsbacka eller vidare till Landvetter Airport. När en riktig Kungsbacka-adress väljs identifieras den mot den befintliga aktiva priszonen och aktuellt belopp hämtas från prislistan.",
    area: "Kungsbacka",
    bookingText: "Boka taxi i Kungsbacka",
    sections: [
      {heading:"Kungsbacka till Landvetter",text:"Ange exakt hämtadress och välj Landvetter Airport. Kungsbackas befintliga aktiva fastpris visas i bokningen när adressen har verifierats."},
      {heading:"Kungsbacka till Göteborg",text:"Boka vidare till Göteborg Centralstation, evenemang, hotell eller en privat adress. Datum, tid och kontaktuppgifter sparas tillsammans med resan."},
      {heading:"Rätt ort från den valda adressen",text:"Systemet känner även igen strukturerad ortsinformation som Kungsbacka kommun. Priset hämtas från den befintliga priszonen och skrivs inte in på SEO-sidan."},
    ],
    searches:["taxi Kungsbacka","taxi Kungsbacka Landvetter","taxi Göteborg Kungsbacka","boka taxi Kungsbacka"],
  },
  {
    slug: "taxi-goteborg-varberg",
    title: "Taxi Göteborg–Varberg – boka resa online",
    description: "Boka taxi mellan Göteborg och Varberg med Avenyn Taxi. Ange fullständig adress, datum, tid och biltyp för resan.",
    h1: "Taxi Göteborg–Varberg",
    eyebrow: "GÖTEBORG ↔ VARBERG",
    intro: "Boka en direkt taxiresa mellan Göteborg och Varberg med upphämtning på den adress du väljer. Resan kan planeras i förväg och bokas med vanlig bil eller storbil.",
    area: "Varberg",
    bookingText: "Boka taxi mellan Göteborg och Varberg",
    ctaType: "quote",
    sections: [
      {heading:"Taxi från Göteborg till Varberg",text:"Välj exakt hämtadress i Göteborg och destination i Varberg. Bokningen visar resans uppgifter samlat innan du bekräftar."},
      {heading:"Taxi Varberg–Landvetter",text:"Välj Landvetter Airport som destination och ange önskad hämtningstid. Ett fastpris visas bara om en aktiv zon finns i Avenyn Taxis nuvarande prislista."},
      {heading:"Planera återresan",text:"Efter en genomförd bokning kan du skapa en återresa med omvänd resväg. Kontrollera datum, passagerarantal och biltyp för varje resa."},
    ],
    searches:["taxi Varberg","taxi Varberg Landvetter","taxi Göteborg Varberg","boka taxi Varberg"],
  },
  {
    slug: "taxi-boras",
    title: "Taxi Borås – boka till Landvetter och Göteborg",
    description: "Boka taxi från Borås till Landvetter eller Göteborg med Avenyn Taxi. Välj exakt adress, tid, passagerare och bil online.",
    h1: "Taxi Borås till Landvetter och Göteborg",
    eyebrow: "BORÅS · VÄSTRA GÖTALAND",
    intro: "Boka en direkt taxiresa från Borås till Landvetter Airport, Göteborg eller en annan destination. Resan kan planeras i förväg med rätt adress och tid.",
    area: "Borås",
    bookingText: "Boka taxi från Borås",
    ctaType: "quote",
    sections: [
      {heading:"Borås till Landvetter",text:"Välj flygplatsen som destination och skriv den fullständiga hämtadressen i Borås. Tillgängligt fastpris visas när adressen kan knytas till rätt publicerat område."},
      {heading:"Borås till Göteborg",text:"Boka en direkt resa till exempelvis Göteborg Centralstation, hotell eller mötesadress. Lägg till ett meddelande om resan kräver extra information."},
      {heading:"Förbered flygresan",text:"Ange hämtningstid med marginal och lägg gärna till flightnummer. Välj storbil om sällskapet består av fem till sju personer."},
    ],
    searches:["taxi Borås","taxi Borås Landvetter","boka taxi Borås"],
  },
  {
    slug: "taxi-vastra-gotaland",
    title: "Taxi Västra Götaland – Göteborg, Landvetter och fler orter",
    description: "Boka taxi i Västra Götaland med Avenyn Taxi. Res till Göteborg, Landvetter och mellan orter med exakt adress, tid och rätt biltyp.",
    h1: "Taxi i Västra Götaland",
    eyebrow: "LOKAL TAXI · FLYGPLATSTRANSFER",
    intro: "Avenyn Taxi tar emot bokningar i Göteborgsområdet och för planerade resor från flera orter i Västra Götaland. Ange alltid fullständig hämtadress och destination så att vi kan bedöma resan och visa tillgängligt pris eller offertväg.",
    area: "Västra Götaland",
    bookingText: "Boka taxi i Västra Götaland",
    ctaType: "quote",
    relatedSlugs: ["taxi-goteborg", "taxi-landvetter", "taxi-boras", "taxi-trollhattan"],
    sections: [
      {heading:"Göteborg och kranskommunerna",text:"Boka resor från Göteborg, Mölndal, Partille, Härryda, Lerum, Kungälv, Ale och andra adresser i närområdet. Varje bokning utgår från den faktiska adress du väljer."},
      {heading:"Taxi till och från Landvetter",text:"Välj Göteborg Landvetter Airport som hämtplats eller destination. Publicerade fastprisområden används när adressen kan verifieras; annars kan du skicka en offertförfrågan."},
      {heading:"Längre resor i Västra Götaland",text:"För resor från exempelvis Borås, Trollhättan, Vänersborg, Uddevalla eller Skövde kan du skicka resans datum, tid och adresser för ett tydligt prisförslag."},
    ],
    searches:["taxi Västra Götaland","boka taxi Västra Götaland","taxi till Landvetter Västra Götaland"],
  },
  {
    slug: "taxi-ale",
    title: "Taxi Ale – boka till Göteborg och Landvetter",
    description: "Boka taxi i Ale för resa till Göteborg eller Landvetter. Ange exakt adress, datum, tid och biltyp hos Avenyn Taxi.",
    h1: "Taxi Ale till Göteborg och Landvetter",
    eyebrow: "ALE · VÄSTRA GÖTALAND",
    intro: "Planera en taxiresa från Ale kommun till Göteborg, Landvetter Airport eller en annan adress. Fullständig hämtadress gör att bokningen får rätt plats och prisunderlag.",
    area: "Ale",
    bookingText: "Boka taxi i Ale",
    ctaType: "quote",
    relatedSlugs: ["taxi-vastra-gotaland", "taxi-kungalv", "taxi-goteborg", "taxi-landvetter"],
    sections: [
      {heading:"Hämtning i Ale",text:"Ange gata, gatunummer och ort, exempelvis i Nödinge, Älvängen eller Surte. Vi använder den valda adressen i stället för att gissa område."},
      {heading:"Ale till Landvetter",text:"Välj Landvetter Airport som destination och lägg gärna till flygnummer. Om ingen aktiv priszon kan verifieras skickar du en offertförfrågan."},
      {heading:"Ale till Göteborg",text:"Boka till Göteborg Centralstation, hotell, arbetsplats eller annan exakt adress. Välj vanlig bil eller storbil utifrån sällskapets storlek."},
    ],
    searches:["taxi Ale","taxi Ale Landvetter","taxi Nödinge","taxi Älvängen"],
  },
  {
    slug: "taxi-harryda",
    title: "Taxi Härryda – boka nära Landvetter Airport",
    description: "Boka taxi i Härryda till Landvetter eller Göteborg med Avenyn Taxi. Välj fullständig adress, tid och rätt bil online.",
    h1: "Taxi Härryda och Landvetter",
    eyebrow: "HÄRRYDA · LANDVETTER",
    intro: "Boka taxi från en adress i Härryda kommun till Landvetter Airport, Göteborg eller annan destination. Välj rätt adressförslag för att skilja ort, kommun och flygplats åt.",
    area: "Härryda",
    bookingText: "Boka taxi i Härryda",
    relatedSlugs: ["taxi-landvetter", "taxi-goteborg", "taxi-lerum", "taxi-vastra-gotaland"],
    sections: [
      {heading:"Nära Göteborg Landvetter Airport",text:"För en resa till terminalen väljer du Landvetter Airport som destination. För hämtning efter flyget väljer du flygplatsen som startpunkt."},
      {heading:"Adresser i Härryda kommun",text:"Ange den fullständiga adressen i exempelvis Mölnlycke, Landvetter eller Hindås. Det minskar risken att flygplatsen och orten blandas ihop."},
      {heading:"Boka för rätt avgångstid",text:"Välj önskad hämtningstid och lägg till flightnummer. Bekräftelsen samlar adress, tid, passagerare och biltyp."},
    ],
    searches:["taxi Härryda","taxi Mölnlycke Landvetter","taxi Härryda Landvetter"],
  },
  {
    slug: "taxi-lilla-edet",
    title: "Taxi Lilla Edet – boka till Göteborg och Landvetter",
    description: "Boka taxi från Lilla Edet till Göteborg eller Landvetter. Skicka exakt adress, tid och bilbehov till Avenyn Taxi.",
    h1: "Taxi Lilla Edet till Göteborg och Landvetter",
    eyebrow: "LILLA EDET · VÄSTRA GÖTALAND",
    intro: "Förboka en taxiresa från Lilla Edet till Göteborg, Landvetter Airport eller en annan destination. Längre resor bedöms från de adresser och den tid du anger.",
    area: "Lilla Edet",
    bookingText: "Boka taxi från Lilla Edet",
    ctaType: "quote",
    relatedSlugs: ["taxi-trollhattan", "taxi-ale", "taxi-goteborg-stenungsund", "taxi-vastra-gotaland"],
    sections: [
      {heading:"Från Lilla Edet",text:"Välj fullständig hämtadress och destination. Uppgifterna används för att planera den faktiska resan och lämna rätt prisbesked."},
      {heading:"Lilla Edet till Landvetter",text:"Välj flygplatsen som destination, datum och önskad tid. Lägg gärna till flightnummer så att resans syfte framgår i bokningen."},
      {heading:"Bil efter sällskapets storlek",text:"Välj vanlig bil för upp till fyra resenärer eller storbil för fem till sju. Barnstol kan anges separat."},
    ],
    searches:["taxi Lilla Edet","taxi Lilla Edet Landvetter","boka taxi Lilla Edet"],
  },
  {
    slug: "taxi-uddevalla",
    title: "Taxi Uddevalla – boka till Göteborg och Landvetter",
    description: "Boka taxi från Uddevalla till Göteborg eller Landvetter med Avenyn Taxi. Ange adress och tid för offert och planerad resa.",
    h1: "Taxi Uddevalla till Göteborg och Landvetter",
    eyebrow: "UDDEVALLA · LÅNGRESA",
    intro: "Planera en direkt taxiresa från Uddevalla till Göteborg, Landvetter Airport eller annan destination. För den längre resan skickar du exakt adress, datum, tid och antal resenärer.",
    area: "Uddevalla",
    bookingText: "Boka taxi från Uddevalla",
    ctaType: "quote",
    relatedSlugs: ["taxi-trollhattan", "taxi-vanersborg", "taxi-goteborg-stenungsund", "taxi-vastra-gotaland"],
    sections: [
      {heading:"Uddevalla till Göteborg",text:"Boka till Centralstationen, ett hotell, en mötesadress eller annan destination i Göteborg. Adresserna kontrolleras före prisförslag."},
      {heading:"Uddevalla till Landvetter",text:"Välj Landvetter Airport som destination och ange den tid du vill bli hämtad. Förfrågan är inte bekräftad förrän du fått besked från Avenyn Taxi."},
      {heading:"Planera en längre resa",text:"Ange passagerarantal, bagagebehov och biltyp. Storbil kan väljas för fem till sju resenärer."},
    ],
    searches:["taxi Uddevalla","taxi Uddevalla Landvetter","taxi Uddevalla Göteborg"],
  },
  {
    slug: "taxi-trollhattan",
    title: "Taxi Trollhättan – boka till Landvetter och Göteborg",
    description: "Boka taxi från Trollhättan till Landvetter eller Göteborg. Ange fullständig adress, tid och biltyp för offert hos Avenyn Taxi.",
    h1: "Taxi Trollhättan till Landvetter och Göteborg",
    eyebrow: "TROLLHÄTTAN · FLYGPLATSTRANSFER",
    intro: "Förboka en direkt taxiresa från Trollhättan till Landvetter Airport, Göteborg eller en annan adress. Skicka resans detaljer för ett prisförslag innan bokningen bekräftas.",
    area: "Trollhättan",
    bookingText: "Boka taxi från Trollhättan",
    ctaType: "quote",
    relatedSlugs: ["taxi-vanersborg", "taxi-uddevalla", "taxi-lilla-edet", "taxi-vastra-gotaland"],
    sections: [
      {heading:"Trollhättan till Landvetter",text:"Välj flygplatsen som destination och ange hämtningstid med marginal. Lägg gärna till flightnummer i resans uppgifter."},
      {heading:"Trollhättan till Göteborg",text:"Res direkt till Centralstationen, hotell, evenemang eller annan adress. Offerten baseras på de exakta adresser du skickar."},
      {heading:"Förbokad långresa",text:"Datum, tid, passagerarantal och biltyp skickas tillsammans. Du får separat bekräftelse när resan har godkänts."},
    ],
    searches:["taxi Trollhättan","taxi Trollhättan Landvetter","taxi Trollhättan Göteborg","taxi Göteborg Trollhättan"],
  },
  {
    slug: "taxi-lysekil",
    title: "Taxi Lysekil – boka till Göteborg och Landvetter",
    description: "Boka taxi från Lysekil till Göteborg eller Landvetter med Avenyn Taxi. Skicka fullständig adress, datum och tid för prisförslag.",
    h1: "Taxi Lysekil till Göteborg och Landvetter",
    eyebrow: "LYSEKIL · PLANERAD LÅNGRESA",
    intro: "Planera en taxiresa från Lysekil till Göteborg, Landvetter Airport eller en annan destination. Ange fullständiga adresser, datum, tid och antal resenärer för ett tydligt prisförslag.",
    area: "Lysekil",
    bookingText: "Boka taxi från Lysekil",
    ctaType: "quote",
    relatedSlugs: ["taxi-uddevalla", "taxi-trollhattan", "taxi-goteborg", "taxi-landvetter"],
    sections: [
      {heading:"Lysekil till Göteborg",text:"Boka en direkt resa till Centralstationen, hotell, möte eller en annan adress i Göteborg. Priset bedöms utifrån de exakta adresserna du anger."},
      {heading:"Lysekil till Landvetter",text:"Välj Landvetter Airport som destination och ange önskad hämtningstid. Lägg gärna till flygnummer och information om bagage."},
      {heading:"Förboka en längre resa",text:"Välj vanlig bil eller storbil efter sällskapets storlek. Resan blir bekräftad när Avenyn Taxi har godkänt prisförslaget."},
    ],
    searches:["Lysekil taxi","taxi Lysekil","taxi Lysekil Göteborg","taxi Lysekil Landvetter"],
  },
  {
    slug: "taxi-vanersborg",
    title: "Taxi Vänersborg – boka till Göteborg och Landvetter",
    description: "Boka taxi från Vänersborg till Göteborg eller Landvetter. Skicka adress, datum och tid för offert hos Avenyn Taxi.",
    h1: "Taxi Vänersborg till Göteborg och Landvetter",
    eyebrow: "VÄNERSBORG · VÄSTRA GÖTALAND",
    intro: "Planera taxi från Vänersborg till Göteborg, Landvetter Airport eller en annan destination. För en längre körning skickar du fullständiga adresser och reseuppgifter för offert.",
    area: "Vänersborg",
    bookingText: "Boka taxi från Vänersborg",
    ctaType: "quote",
    relatedSlugs: ["taxi-trollhattan", "taxi-uddevalla", "taxi-lilla-edet", "taxi-vastra-gotaland"],
    sections: [
      {heading:"Vänersborg till Landvetter",text:"Välj Göteborg Landvetter Airport som destination och ange datum, tid och flightnummer. Du får besked innan resan räknas som bekräftad."},
      {heading:"Vänersborg till Göteborg",text:"Ange den exakta adressen i Göteborg, oavsett om du ska till station, hotell, arbete eller bostad."},
      {heading:"Vanlig bil eller storbil",text:"Välj bil efter antal passagerare och bagage. Barnstol kan anges som tillval i reseuppgifterna."},
    ],
    searches:["taxi Vänersborg","taxi Vänersborg Landvetter","taxi Vänersborg Göteborg"],
  },
  {
    slug: "taxi-skovde",
    title: "Taxi Skövde – boka långresa till Göteborg och Landvetter",
    description: "Boka taxi från Skövde till Göteborg eller Landvetter. Skicka exakta adresser och restid för offert hos Avenyn Taxi.",
    h1: "Taxi Skövde till Göteborg och Landvetter",
    eyebrow: "SKÖVDE · PLANERAD LÅNGRESA",
    intro: "Boka en planerad taxiresa från Skövde till Göteborg, Landvetter Airport eller annan destination. Förfrågan innehåller adresser, datum, tid och sällskapets storlek.",
    area: "Skövde",
    bookingText: "Boka taxi från Skövde",
    ctaType: "quote",
    relatedSlugs: ["taxi-vastra-gotaland", "taxi-boras", "taxi-alingsas", "taxi-landvetter"],
    sections: [
      {heading:"Skövde till Landvetter",text:"Välj flygplatsen som destination och ange önskad hämtningstid. Lägg gärna till flightnummer och information om bagage."},
      {heading:"Skövde till Göteborg",text:"Ange slutadressen i Göteborg så att resan kan bedömas korrekt. Offertförfrågan är inte en bokning förrän den har bekräftats."},
      {heading:"Res bekvämt hela vägen",text:"Välj vanlig bil eller storbil utifrån sällskapets storlek. Samtliga uppgifter följer med när prisförslaget skickas."},
    ],
    searches:["taxi Skövde","taxi Skövde Landvetter","taxi Skövde Göteborg"],
  },
  {
    slug: "taxi-ockero",
    title: "Taxi Öckerö – boka till Göteborg och Landvetter",
    description: "Boka taxi från Öckerö kommun till Göteborg eller Landvetter. Ange exakt adress, tid och biltyp hos Avenyn Taxi.",
    h1: "Taxi Öckerö till Göteborg och Landvetter",
    eyebrow: "ÖCKERÖ · GÖTEBORGS SKÄRGÅRD",
    intro: "Planera taxi från en tillgänglig adress i Öckerö kommun till Göteborg, Landvetter Airport eller annan destination. Ange rätt ö och fullständig adress så att resan kan bedömas korrekt.",
    area: "Öckerö",
    bookingText: "Boka taxi från Öckerö",
    ctaType: "quote",
    relatedSlugs: ["taxi-hisingen", "taxi-goteborg", "taxi-landvetter", "taxi-vastra-gotaland"],
    sections: [
      {heading:"Rätt ö och adress",text:"Skriv fullständig adress och ort. Tillgänglighet och färjeförbindelser kan påverka planeringen, därför bekräftas resan efter kontroll."},
      {heading:"Öckerö till Landvetter",text:"Välj flygplatsen som destination och ange en hämtningstid med marginal. Flightnummer och bagageinformation kan läggas till."},
      {heading:"Öckerö till Göteborg",text:"Boka vidare till Centralstationen, hotell eller annan adress i Göteborg. Skicka reseuppgifterna för ett tydligt prisförslag."},
    ],
    searches:["taxi Öckerö","taxi Öckerö Landvetter","taxi Öckerö Göteborg"],
  },
  {
  "slug": "bud-goteborg",
  "title": "Taxibud Göteborg – bud, expressbud & budtransport",
  "description": "Behöver du taxibud i Göteborg? Avenyn Taxi kör dokument, nycklar och mindre paket. Begär pris för budtransport och expressbud med hämtning och leverans.",
  "h1": "Taxibud och budtransport i Göteborg",
  "eyebrow": "TAXIBUD · DOKUMENT · MINDRE PAKET",
  "intro": "Skicka dokument, nycklar eller ett mindre paket med Avenyn Taxi. Vi tar emot budförfrågningar från privatpersoner och företag i Göteborg med omnejd. Ange hämtadress, leveransadress och när försändelsen behöver vara framme, så kontrollerar vi pris och tillgänglighet.",
  "area": "Göteborg",
  "bookingText": "Begär pris för taxibud",
  "ctaType": "service",
  "relatedSlugs": [
    "foretagstaxi-goteborg",
    "taxi-goteborg",
    "taxi-molndal",
    "taxi-partille"
  ],
  "sections": [
    {
      "heading": "Vad är taxibud?",
      "text": "Taxibud, ibland sökt som taxi bud, innebär att en försändelse hämtas och lämnas med taxi utan att avsändaren behöver följa med. Det kan exempelvis vara ett kuvert till ett kontor, nycklar till en mottagare eller ett mindre paket. Beskriv innehåll, mått och vikt så att vi kan avgöra om uppdraget passar våra bilar."
    },
    {
      "heading": "Dokument, nycklar och mindre paket",
      "text": "Ange vad som ska transporteras och hur det är förpackat. Lägg med namn och telefonnummer till både avsändare och mottagare samt eventuell portkod eller entré. Försändelsen ska vara klar att hämtas vid överenskommen tid. Kontrollera att mottagaren kan ta emot den."
    },
    {
      "heading": "Expressbud när leveransen är brådskande",
      "text": "Behöver försändelsen hämtas snart eller komma fram före en viss tid? Ring 0700 315 315 och ange båda adresserna och din tidsgräns. Vi kontrollerar tillgänglig bil och om tidsplanen går att genomföra. Hämtningstid och leveranstid måste bekräftas för det aktuella uppdraget."
    },
    {
      "heading": "Bud i Göteborg, Hisingen, Mölndal och Partille",
      "text": "Skicka en förfrågan för budtransport mellan exempelvis Göteborgs centrum, Majorna, Linné, Hisingen, Mölndal och Partille. Fullständig gatuadress är viktig vid kontor, industriområden och hotell med flera entréer. För transporter längre bort anger du hela sträckan så återkommer vi med besked."
    },
    {
      "heading": "Vad kostar bud med taxi?",
      "text": "Priset lämnas utifrån adresserna, önskad tid, försändelsen och uppdragets upplägg. Ange om körningen omfattar flera leveransställen, väntetid eller returhämtning. Vi lämnar pris före bekräftelse. Landvetters fastpriser för personresor ska inte användas som pris för ett buduppdrag."
    },
    {
      "heading": "Budtransport för företag",
      "text": "Behöver företaget skicka dokument eller mindre försändelser mellan kontor, kunder eller samarbetspartner? Ange företagets namn, kontaktperson och eventuell referens tillsammans med transportuppgifterna. För återkommande behov beskriver du önskade tider och sträckor. Upplägg och betalningsvillkor överenskoms före beställning."
    },
    {
      "heading": "Så beställer du budkörning",
      "text": "Öppna budförfrågan och välj Budkörning. Fyll i kontaktuppgifter, från- och tilladress, önskad tid och en beskrivning av försändelsen. Vi återkommer med pris och tillgänglighet. En inskickad förfrågan är inte en bekräftad beställning; invänta besked innan du räknar med hämtning."
    }
  ],
  "searches": [
    "taxibud Göteborg",
    "taxi bud Göteborg",
    "bud Göteborg",
    "budtransport Göteborg",
    "expressbud Göteborg",
    "budkörning Göteborg",
    "dokumentbud Göteborg",
    "företagsbud Göteborg"
  ]
},
  {
    slug: "forsakringsresor-goteborg",
    title: "Försäkringsresor Göteborg – skicka reseförfrågan",
    description: "Information om försäkringsresor, arbetsresor via Försäkringskassan och sjukresor i Göteborg. Skicka reseförfrågan när godkännande eller referens finns.",
    h1: "Försäkringsresor och godkända arbetsresor i Göteborg",
    eyebrow: "PLANERAD RESA · GÖTEBORG",
    intro: "En resa kan i vissa fall betalas av Försäkringskassan, regionen eller ett försäkringsbolag. Det är betalaren som beslutar om rätten till ersättning. När du har fått beslut, reseintyg eller betalningsgodkännande kan du skicka reseuppgifterna till Avenyn Taxi.",
    area: "Göteborg och Västra Götaland",
    bookingText: "Skicka reseförfrågan",
    ctaType: "service",
    relatedSlugs: ["taxi-goteborg", "taxi-vastra-gotaland", "bud-goteborg", "taxi-landvetter"],
    sections: [
      {heading:"Arbetsresor via Försäkringskassan",text:"Om du kan arbeta men inte resa till arbetet på vanligt sätt på grund av sjukdom eller skada kan Försäkringskassan i vissa fall ersätta arbetsresor. Kontakta Försäkringskassan före resan och be om ett beslut eller anvisningar."},
      {heading:"Sjukresor i Västra Götaland",text:"Vården bedömer om medicinska skäl ger rätt till sjukresetaxi och utfärdar vid behov reseintyg. Följ regionens instruktioner för bokning; en vanlig taxibokning innebär inte automatiskt rätt till ersättning."},
      {heading:"Resa via privat försäkringsbolag",text:"Kontakta försäkringsbolaget eller skaderegleraren och be om skriftligt godkännande, referensnummer och betalningssätt. Skicka därefter adresser, datum och tid till oss, men inga diagnoser eller känsliga medicinska uppgifter."},
    ],
    searches:["försäkringsresa Göteborg","arbetsresor Försäkringskassan taxi","sjukresa taxi Göteborg","försäkringsbolag taxi Göteborg"],
  },
];


seoPages.push({"slug": "taxi-marstrand", "title": "Taxi Marstrand – Göteborg & Landvetter | Förboka", "description": "Förboka taxi mellan Marstrand, Göteborg och Landvetter. Hämtning på Koön, vanlig bil eller storbil. Begär pris hos Avenyn Taxi.", "h1": "Taxi Marstrand till Göteborg och Landvetter", "eyebrow": "MARSTRAND · BOHUSLÄN", "intro": "Planera taxiresan till en helg på Marstrand, ett hotell eller en seglingsutflykt. Avenyn Taxi tar emot förfrågningar om förbokade resor mellan Marstrand, Göteborg och Landvetter. Ange datum, tid och exakta adresser så återkommer vi med pris och tillgänglighet.", "area": "Marstrand", "bookingText": "Begär pris för taxi Marstrand", "ctaType": "quote", "relatedSlugs": ["taxi-vastkusten", "taxi-marstrand", "taxi-henan", "taxi-goteborg-smogen"], "sections": [{"heading": "Hämtning vid färjeläget på Koön", "text": "Marstrandsön är bilfri. För en resa till ön anger du färjeläget på Koön som destination och fortsätter med färjan. Vid återresa väljer du en tydlig mötesplats på Koön och räknar med tid för färjeöverfarten. Taxiresan omfattar vägsträckan; färjeresan planeras separat."}, {"heading": "Marstrand till Göteborg och Landvetter", "text": "Ange adressen i Göteborg eller välj Landvetter Airport för flygtransfer. Lägg till flygnummer och önskad hämtningstid med marginal för trafik och incheckning. Skicka förfrågan i god tid, särskilt inför helger och evenemang."}, {"heading": "Sällskap, stopp och återresa", "text": "Välj vanlig bil för upp till fyra personer eller storbil för fem till sju. Lägg till barnstol och eventuella stopp i reseuppgifterna. Ange också mängden bagage och önskemål om återresa. Pris och tillgänglighet behöver bekräftas innan resan är bokad."}], "searches": ["taxi Marstrand", "taxi Marstrand Göteborg", "taxi Marstrand Landvetter"]},
{"slug": "taxi-henan", "title": "Taxi Henån & Orust – Göteborg och Landvetter", "description": "Planera taxi från Henån på Orust till Göteborg eller Landvetter. Begär pris, välj storbil och ange önskad hämtningstid hos Avenyn Taxi.", "h1": "Taxi Henån och Orust till Göteborg och Landvetter", "eyebrow": "HENÅN · ORUST", "intro": "Behöver du en planerad resa från Henån på Orust till Göteborg eller Landvetter? Skicka adresser, datum och tid till Avenyn Taxi för ett prisförslag. En förfrågan ger oss underlag att planera resan och kontrollera tillgänglig bil.", "area": "Henån, Orust", "bookingText": "Begär pris för taxi Henån", "ctaType": "quote", "relatedSlugs": ["taxi-vastkusten", "taxi-marstrand", "taxi-henan", "taxi-goteborg-smogen"], "sections": [{"heading": "Tydlig hämtning i Henån", "text": "Ange fullständig adress i Henån, exempelvis till boende, arbetsplats eller en bestämd mötesplats i centrum. För hämtning från andra delar av Orust skriver du både ort och gatuadress. Det hjälper oss att planera rätt väg och lämna ett pris för just din resa."}, {"heading": "Henån till Landvetter", "text": "Välj Landvetter Airport som destination och ange flygnummer om det finns. Planera hämtningen med marginal för vägtrafik, bagage och incheckning. Vid resa från flygplatsen till Henån anger du flygnummer, datum och destination i samma förfrågan."}, {"heading": "Resa till Göteborg med familj eller kollegor", "text": "Skicka en förfrågan för resa till Göteborg Centralstation, hotell, möte eller privat adress. Storbil kan väljas för fem till sju passagerare och barnstol som tillval. Ange extra stopp och bagage innan priset bekräftas."}], "searches": ["taxi Henån", "taxi Orust", "taxi Henån Landvetter", "taxi Henån Göteborg"]},
{"slug": "taxi-vastkusten", "title": "Taxi Västkusten – Marstrand, Henån & Smögen", "description": "Förbokade taxiresor mellan Göteborg, Landvetter och Västkusten. Planera Marstrand, Henån på Orust eller Smögen med Avenyn Taxi.", "h1": "Taxi till Västkusten från Göteborg och Landvetter", "eyebrow": "VÄSTKUSTEN · PLANERA DIN RESA", "intro": "Från Göteborg till kustens hotell, hamnar och semesterboenden. Hos Avenyn Taxi kan du skicka en förfrågan om planerad taxiresa till Marstrand, Henån på Orust, Smögen och andra adresser på Västkusten. Vi återkommer med pris och tillgänglighet för den vägsträcka du vill resa.", "area": "Västkusten", "bookingText": "Planera en resa till Västkusten", "ctaType": "quote", "relatedSlugs": ["taxi-vastkusten", "taxi-marstrand", "taxi-henan", "taxi-goteborg-smogen"], "sections": [{"heading": "Marstrand, Henån och Smögen – välj rätt destination", "text": "Marstrand har en bilfri ö, så en taxiresa till ön slutar vid färjeläget på Koön. För Henån anger du en exakt adress på Orust. Till Smögen anger du boendets adress eller en tillgänglig mötesplats nära bryggan. Rätt slutadress är viktig för både pris och upphämtning."}, {"heading": "Flygtransfer från Landvetter till kusten", "text": "Ange Landvetter Airport som hämtplats, ditt flygnummer och kustdestinationen. För återresan väljer du datum och hämtningstid med marginal till flyget. Längre resor prissätts efter resans uppgifter; inga generella fastpriser för hela Västkusten utlovas."}, {"heading": "Förboka enkel resa eller tur och retur", "text": "Planera datum, antal passagerare, biltyp, bagage och eventuella stopp. För fem till sju passagerare väljer du storbil. Barnstol kan läggas till. Förfrågan är inte en bekräftad bokning förrän pris och tillgänglighet har godkänts."}], "searches": ["taxi Västkusten", "taxi Bohuslän", "taxi Göteborg Västkusten", "Landvetter Västkusten"]});

seoPages.push(...[
  {
    "slug": "taxi-linne",
    "title": "Taxi Linné – boka i Göteborg och till Landvetter",
    "description": "Planera taxi från Linné med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi i Linné",
    "eyebrow": "LINNÉ · GÖTEBORG",
    "intro": "Restaurangbesök runt Linnégatan och resor vidare från Järntorget kan innebära en hämtplats på en annan gata än entrén. Ange restaurangens namn, gatuadress och vilken sida av kvarteret du väntar på.",
    "area": "Linné",
    "bookingText": "Boka taxi från Linné",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Linnégatan och Järntorget",
        "text": "Restaurangbesök runt Linnégatan och resor vidare från Järntorget kan innebära en hämtplats på en annan gata än entrén. Ange restaurangens namn, gatuadress och vilken sida av kvarteret du väntar på."
      },
      {
        "heading": "Linné till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Linné",
      "taxi Linné Landvetter",
      "taxi Linné Göteborg"
    ]
  },
  {
    "slug": "taxi-haga",
    "title": "Taxi Haga – boka i Göteborg och till Landvetter",
    "description": "Planera taxi från Haga med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi i Haga",
    "eyebrow": "HAGA · GÖTEBORG",
    "intro": "Haga har promenadstråk där en bil inte alltid kan stanna vid entrén. Ange adressen och kom överens om en tillgänglig hämtplats vid en gata med biltrafik. Lägg in extra tid om sällskapet behöver gå till bilen.",
    "area": "Haga",
    "bookingText": "Boka taxi från Haga",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Haga Nygata och omkringliggande gator",
        "text": "Haga har promenadstråk där en bil inte alltid kan stanna vid entrén. Ange adressen och kom överens om en tillgänglig hämtplats vid en gata med biltrafik. Lägg in extra tid om sällskapet behöver gå till bilen."
      },
      {
        "heading": "Haga till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Haga",
      "taxi Haga Landvetter",
      "taxi Haga Göteborg"
    ]
  },
  {
    "slug": "taxi-johanneberg",
    "title": "Taxi Johanneberg – boka i Göteborg och till Landvetter",
    "description": "Planera taxi från Johanneberg med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi i Johanneberg",
    "eyebrow": "JOHANNEBERG · GÖTEBORG",
    "intro": "Vid Chalmers och större campusbyggnader hjälper byggnadsnamn och rätt entré föraren att hitta. Ange gatuadress tillsammans med entré och önskad hämtningstid, särskilt efter konferenser eller kvällsevenemang.",
    "area": "Johanneberg",
    "bookingText": "Boka taxi från Johanneberg",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Chalmers och Johanneberg",
        "text": "Vid Chalmers och större campusbyggnader hjälper byggnadsnamn och rätt entré föraren att hitta. Ange gatuadress tillsammans med entré och önskad hämtningstid, särskilt efter konferenser eller kvällsevenemang."
      },
      {
        "heading": "Johanneberg till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Johanneberg",
      "taxi Johanneberg Landvetter",
      "taxi Johanneberg Göteborg"
    ]
  },
  {
    "slug": "taxi-orgryte",
    "title": "Taxi Örgryte – boka i Göteborg och till Landvetter",
    "description": "Planera taxi från Örgryte med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi i Örgryte",
    "eyebrow": "ÖRGRYTE · GÖTEBORG",
    "intro": "Vid resor från bostäder i Örgryte eller Skår anger du portnummer och eventuell grind. Ska du vidare till ett evenemang vid Korsvägen är det bra att ange rätt arena eller hotell, eftersom flera entréer ligger nära varandra.",
    "area": "Örgryte",
    "bookingText": "Boka taxi från Örgryte",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Örgryte, Skår och närheten till evenemangsområdet",
        "text": "Vid resor från bostäder i Örgryte eller Skår anger du portnummer och eventuell grind. Ska du vidare till ett evenemang vid Korsvägen är det bra att ange rätt arena eller hotell, eftersom flera entréer ligger nära varandra."
      },
      {
        "heading": "Örgryte till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Örgryte",
      "taxi Örgryte Landvetter",
      "taxi Örgryte Göteborg"
    ]
  },
  {
    "slug": "taxi-askim",
    "title": "Taxi Askim – boka i Göteborg och till Landvetter",
    "description": "Planera taxi från Askim med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi i Askim",
    "eyebrow": "ASKIM · GÖTEBORG",
    "intro": "För hämtning i villaområden anger du fullständig adress och om infarten är svår att hitta. Vid resor från kusten eller en badplats behövs en mötesplats som bilen kan nå, inte bara namnet på stranden.",
    "area": "Askim",
    "bookingText": "Boka taxi från Askim",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Askim, Hovås och Billdal",
        "text": "För hämtning i villaområden anger du fullständig adress och om infarten är svår att hitta. Vid resor från kusten eller en badplats behövs en mötesplats som bilen kan nå, inte bara namnet på stranden."
      },
      {
        "heading": "Askim till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Askim",
      "taxi Askim Landvetter",
      "taxi Askim Göteborg"
    ]
  },
  {
    "slug": "taxi-torslanda",
    "title": "Taxi Torslanda – boka i Göteborg och till Landvetter",
    "description": "Planera taxi från Torslanda med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi i Torslanda",
    "eyebrow": "TORSLANDA · GÖTEBORG",
    "intro": "Vid hämtning från större arbetsplatser behövs rätt grind eller besöksentré. Från Amhult eller bostadsområden anger du gatuadress. Planera flygresan efter startadressen och marginal för trafiken genom Göteborg.",
    "area": "Torslanda",
    "bookingText": "Boka taxi från Torslanda",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Torslanda, Amhult och arbetsplatser på västra Hisingen",
        "text": "Vid hämtning från större arbetsplatser behövs rätt grind eller besöksentré. Från Amhult eller bostadsområden anger du gatuadress. Planera flygresan efter startadressen och marginal för trafiken genom Göteborg."
      },
      {
        "heading": "Torslanda till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Torslanda",
      "taxi Torslanda Landvetter",
      "taxi Torslanda Göteborg"
    ]
  },
  {
    "slug": "taxi-angered",
    "title": "Taxi Angered – boka i Göteborg och till Landvetter",
    "description": "Planera taxi från Angered med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi i Angered",
    "eyebrow": "ANGERED · GÖTEBORG",
    "intro": "Ange om du väntar vid en bostadsadress, verksamhet eller vid Angered centrum. Vid mötesplatser nära kollektivtrafiken behöver föraren en tydlig plats där bilen kan stanna utan att använda hållplatsytan.",
    "area": "Angered",
    "bookingText": "Boka taxi från Angered",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Angered centrum och nordöstra Göteborg",
        "text": "Ange om du väntar vid en bostadsadress, verksamhet eller vid Angered centrum. Vid mötesplatser nära kollektivtrafiken behöver föraren en tydlig plats där bilen kan stanna utan att använda hållplatsytan."
      },
      {
        "heading": "Angered till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Angered",
      "taxi Angered Landvetter",
      "taxi Angered Göteborg"
    ]
  },
  {
    "slug": "taxi-gamlestaden",
    "title": "Taxi Gamlestaden – boka i Göteborg och till Landvetter",
    "description": "Planera taxi från Gamlestaden med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi i Gamlestaden",
    "eyebrow": "GAMLESTADEN · GÖTEBORG",
    "intro": "Vid Gamlestads torg finns flera anslutningar och gångstråk. Ange en gatuadress och vilken sida du väntar på. För hämtning vid företag eller hotell kompletterar du med verksamhetens namn och entré.",
    "area": "Gamlestaden",
    "bookingText": "Boka taxi från Gamlestaden",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Gamlestaden och Gamlestads torg",
        "text": "Vid Gamlestads torg finns flera anslutningar och gångstråk. Ange en gatuadress och vilken sida du väntar på. För hämtning vid företag eller hotell kompletterar du med verksamhetens namn och entré."
      },
      {
        "heading": "Gamlestaden till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Gamlestaden",
      "taxi Gamlestaden Landvetter",
      "taxi Gamlestaden Göteborg"
    ]
  },
  {
    "slug": "taxi-ulricehamn",
    "title": "Taxi Ulricehamn – transfer till Göteborg och Landvetter",
    "description": "Planera taxi från Ulricehamn med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi Ulricehamn till Göteborg och Landvetter",
    "eyebrow": "ULRICEHAMN · SJUHÄRAD",
    "intro": "Vid resa från Ulricehamn anger du om hämtningen är i centrum, vid ett boende eller vid en anläggning utanför tätorten. Planera transfern med fullständig adress och flygets avgångstid; restiden beror på resans startpunkt och trafik.",
    "area": "Ulricehamn",
    "bookingText": "Boka taxi från Ulricehamn",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Ulricehamn till Göteborg och Landvetter",
        "text": "Vid resa från Ulricehamn anger du om hämtningen är i centrum, vid ett boende eller vid en anläggning utanför tätorten. Planera transfern med fullständig adress och flygets avgångstid; restiden beror på resans startpunkt och trafik."
      },
      {
        "heading": "Ulricehamn till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Ulricehamn",
      "taxi Ulricehamn Landvetter",
      "taxi Ulricehamn Göteborg"
    ]
  },
  {
    "slug": "taxi-falkenberg",
    "title": "Taxi Falkenberg – transfer till Göteborg och Landvetter",
    "description": "Planera taxi från Falkenberg med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi Falkenberg till Göteborg och Landvetter",
    "eyebrow": "FALKENBERG · HALLAND",
    "intro": "För resor från boende i Skrea eller centrala Falkenberg anger du hotellets eller bostadens adress. Ska sällskapet vidare till Göteborg eller Landvetter behöver vi även datum, antal resenärer och bagage för att bedöma biltyp och pris.",
    "area": "Falkenberg",
    "bookingText": "Boka taxi från Falkenberg",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Falkenberg, Skrea och resor till Göteborg",
        "text": "För resor från boende i Skrea eller centrala Falkenberg anger du hotellets eller bostadens adress. Ska sällskapet vidare till Göteborg eller Landvetter behöver vi även datum, antal resenärer och bagage för att bedöma biltyp och pris."
      },
      {
        "heading": "Falkenberg till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Falkenberg",
      "taxi Falkenberg Landvetter",
      "taxi Falkenberg Göteborg"
    ]
  },
  {
    "slug": "taxi-halmstad",
    "title": "Taxi Halmstad – transfer till Göteborg och Landvetter",
    "description": "Planera taxi från Halmstad med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi Halmstad till Göteborg och Landvetter",
    "eyebrow": "HALMSTAD · HALLAND",
    "intro": "Hämtning i centrala Halmstad och från boende i Tylösand har olika startadresser. Ange boendets namn och adress. En längre resa till Göteborg eller Landvetter planeras i förväg med prisförslag och kontroll av tillgänglig bil.",
    "area": "Halmstad",
    "bookingText": "Boka taxi från Halmstad",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Halmstad, Tylösand och långväga transfer",
        "text": "Hämtning i centrala Halmstad och från boende i Tylösand har olika startadresser. Ange boendets namn och adress. En längre resa till Göteborg eller Landvetter planeras i förväg med prisförslag och kontroll av tillgänglig bil."
      },
      {
        "heading": "Halmstad till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Halmstad",
      "taxi Halmstad Landvetter",
      "taxi Halmstad Göteborg"
    ]
  },
  {
    "slug": "taxi-lidkoping",
    "title": "Taxi Lidköping – transfer till Göteborg och Landvetter",
    "description": "Planera taxi från Lidköping med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi Lidköping till Göteborg och Landvetter",
    "eyebrow": "LIDKÖPING · SKARABORG",
    "intro": "För en resa från Lidköping till Göteborg anger du exakt adress, önskad ankomsttid och eventuella stopp. Ska du hämtas vid ett boende utanför staden behöver vi även ort och adress, så att förfrågan gäller rätt sträcka.",
    "area": "Lidköping",
    "bookingText": "Boka taxi från Lidköping",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Lidköping och resor från södra Vänern",
        "text": "För en resa från Lidköping till Göteborg anger du exakt adress, önskad ankomsttid och eventuella stopp. Ska du hämtas vid ett boende utanför staden behöver vi även ort och adress, så att förfrågan gäller rätt sträcka."
      },
      {
        "heading": "Lidköping till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Lidköping",
      "taxi Lidköping Landvetter",
      "taxi Lidköping Göteborg"
    ]
  },
  {
    "slug": "taxi-skara",
    "title": "Taxi Skara – transfer till Göteborg och Landvetter",
    "description": "Planera taxi från Skara med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi Skara till Göteborg och Landvetter",
    "eyebrow": "SKARA · SKARABORG",
    "intro": "Ange om hämtningen sker i centrala Skara eller vid en besöksanläggning utanför centrum. För ett större sällskap behövs passagerarantal och information om bagage. Vid en tidsbestämd anslutning anger du när ni behöver vara framme.",
    "area": "Skara",
    "bookingText": "Boka taxi från Skara",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Skara och planerad resa till Göteborg",
        "text": "Ange om hämtningen sker i centrala Skara eller vid en besöksanläggning utanför centrum. För ett större sällskap behövs passagerarantal och information om bagage. Vid en tidsbestämd anslutning anger du när ni behöver vara framme."
      },
      {
        "heading": "Skara till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Skara",
      "taxi Skara Landvetter",
      "taxi Skara Göteborg"
    ]
  },
  {
    "slug": "taxi-falkoping",
    "title": "Taxi Falköping – transfer till Göteborg och Landvetter",
    "description": "Planera taxi från Falköping med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi Falköping till Göteborg och Landvetter",
    "eyebrow": "FALKÖPING · SKARABORG",
    "intro": "Vid upphämtning nära Falköpings resecentrum anger du tågets ankomst och en överenskommen mötesplats. För resan till Landvetter anges flygets avgång och hämtadress. En tågförsening kan påverka planeringen, så håll telefonen tillgänglig.",
    "area": "Falköping",
    "bookingText": "Boka taxi från Falköping",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Falköping och anslutning till tåg eller flyg",
        "text": "Vid upphämtning nära Falköpings resecentrum anger du tågets ankomst och en överenskommen mötesplats. För resan till Landvetter anges flygets avgång och hämtadress. En tågförsening kan påverka planeringen, så håll telefonen tillgänglig."
      },
      {
        "heading": "Falköping till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Falköping",
      "taxi Falköping Landvetter",
      "taxi Falköping Göteborg"
    ]
  },
  {
    "slug": "taxi-stromstad",
    "title": "Taxi Strömstad – transfer till Göteborg och Landvetter",
    "description": "Planera taxi från Strömstad med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi Strömstad till Göteborg och Landvetter",
    "eyebrow": "STRÖMSTAD · BOHUSLÄN",
    "intro": "Vid hämtning efter en färjeresa i Strömstad anger du färjans ankomst och mötesplats på fastlandet. Från hotell eller boende behövs en fullständig adress. Resor vidare till Göteborg och Landvetter bedöms utifrån tid, biltyp och sträcka.",
    "area": "Strömstad",
    "bookingText": "Boka taxi från Strömstad",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Strömstad och förbokad kusttransfer",
        "text": "Vid hämtning efter en färjeresa i Strömstad anger du färjans ankomst och mötesplats på fastlandet. Från hotell eller boende behövs en fullständig adress. Resor vidare till Göteborg och Landvetter bedöms utifrån tid, biltyp och sträcka."
      },
      {
        "heading": "Strömstad till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Strömstad",
      "taxi Strömstad Landvetter",
      "taxi Strömstad Göteborg"
    ]
  },
  {
    "slug": "taxi-kungshamn",
    "title": "Taxi Kungshamn – transfer till Göteborg och Landvetter",
    "description": "Planera taxi från Kungshamn med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi Kungshamn till Göteborg och Landvetter",
    "eyebrow": "KUNGSHAMN · BOHUSLÄN",
    "intro": "Ange om ditt boende ligger i Kungshamn eller på Smögen, eftersom hämtadressen styr resan. Vid hamnområden behöver vi en tillgänglig gata eller mötesplats. För återresa till Landvetter väljer du tid med marginal till flyget.",
    "area": "Kungshamn",
    "bookingText": "Boka taxi från Kungshamn",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Kungshamn, Smögen och boenden vid kusten",
        "text": "Ange om ditt boende ligger i Kungshamn eller på Smögen, eftersom hämtadressen styr resan. Vid hamnområden behöver vi en tillgänglig gata eller mötesplats. För återresa till Landvetter väljer du tid med marginal till flyget."
      },
      {
        "heading": "Kungshamn till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Kungshamn",
      "taxi Kungshamn Landvetter",
      "taxi Kungshamn Göteborg"
    ]
  },
  {
    "slug": "taxi-hunnebostrand",
    "title": "Taxi Hunnebostrand – transfer till Göteborg och Landvetter",
    "description": "Planera taxi från Hunnebostrand med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi Hunnebostrand till Göteborg och Landvetter",
    "eyebrow": "HUNNEBOSTRAND · BOHUSLÄN",
    "intro": "Hämtning vid boende, restaurang eller hamn i Hunnebostrand behöver en adress som bilen når. Under besök och större evenemang kan en mötesplats en bit från entrén behövas. Ange om du vill planera både utresa och återresa.",
    "area": "Hunnebostrand",
    "bookingText": "Boka taxi från Hunnebostrand",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Hunnebostrand och sommarresor vid kusten",
        "text": "Hämtning vid boende, restaurang eller hamn i Hunnebostrand behöver en adress som bilen når. Under besök och större evenemang kan en mötesplats en bit från entrén behövas. Ange om du vill planera både utresa och återresa."
      },
      {
        "heading": "Hunnebostrand till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Hunnebostrand",
      "taxi Hunnebostrand Landvetter",
      "taxi Hunnebostrand Göteborg"
    ]
  },
  {
    "slug": "taxi-jonkoping",
    "title": "Taxi Jönköping – transfer till Göteborg och Landvetter",
    "description": "Planera taxi från Jönköping med Avenyn Taxi. Information om hämtplats, förbokning och resa till Landvetter. Skicka adresser för pris och tillgänglighet.",
    "h1": "Taxi Jönköping till Göteborg och Landvetter",
    "eyebrow": "JÖNKÖPING · SMÅLAND",
    "intro": "Vid förbokad resa från Jönköping anger du hotell, företag eller fullständig bostadsadress. För besök vid Elmia behövs också rätt entré eller mötesplats. Pris och tillgänglighet för resan till Göteborg eller Landvetter bekräftas före bokning.",
    "area": "Jönköping",
    "bookingText": "Boka taxi från Jönköping",
    "ctaType": "quote",
    "relatedSlugs": [
      "taxi-goteborg",
      "taxi-landvetter",
      "taxi-vastra-gotaland"
    ],
    "sections": [
      {
        "heading": "Jönköping och transfer till Göteborg",
        "text": "Vid förbokad resa från Jönköping anger du hotell, företag eller fullständig bostadsadress. För besök vid Elmia behövs också rätt entré eller mötesplats. Pris och tillgänglighet för resan till Göteborg eller Landvetter bekräftas före bokning."
      },
      {
        "heading": "Jönköping till Landvetter Airport",
        "text": "Ange fullständig hämtadress, datum, önskad tid och flygnummer om det finns. Planera med marginal till incheckning. För returresan anger du ankomstflyg och destination; mötesplatsen bekräftas för den aktuella resan."
      },
      {
        "heading": "Pris, biltyp och bekräftelse",
        "text": "Skicka startadress, destination, antal passagerare, bagage och eventuella stopp. Barnstol och storbil anges i förfrågan. Pris och tillgänglighet kontrolleras för just din resa. En offertförfrågan är inte en bekräftad bokning."
      }
    ],
    "searches": [
      "taxi Jönköping",
      "taxi Jönköping Landvetter",
      "taxi Jönköping Göteborg"
    ]
  }
]);

seoPages.push({"slug": "foretagstaxi-goteborg", "title": "Företagstaxi Göteborg – tjänsteresor & flygtransfer", "description": "Planera företagstaxi i Göteborg med Avenyn Taxi. Resor till möten, hotell och Landvetter, flera stopp och grupper. Begär offert för företagets resor.", "h1": "Företagstaxi i Göteborg", "eyebrow": "TJÄNSTERESOR · MÖTEN · FLYGTRANSFER", "intro": "Samla företagets resor till möten, hotell, Göteborg Centralstation och Landvetter i en tydlig resplan. Avenyn Taxi hjälper till med förbokade tjänsteresor och transport av gäster i Göteborg med omnejd. Skicka adresser, tider och antal resenärer för pris och tillgänglighet.", "area": "Göteborg", "bookingText": "Begär offert för företagsresor", "ctaType": "service", "relatedSlugs": ["taxi-landvetter", "taxi-goteborg-central", "taxi-goteborg", "taxi-molndal"], "sections": [{"heading": "Flygtransfer för medarbetare och gäster", "text": "Ange ankomstflyg, datum, destination och ett mobilnummer som går att nå. För resan till Landvetter anger du hämtningstid med marginal för trafik och incheckning. Mötesplats och eventuella särskilda önskemål behöver bekräftas för varje uppdrag."}, {"heading": "Möten, hotell och konferenser i Göteborg", "text": "Vid resor till Svenska Mässan, hotell i centrum, Lindholmen eller företag i Mölndal behöver vi fullständig gatuadress och rätt entré. Skicka en tidplan om dagen innehåller flera möten. Ange hur länge ett stopp ska vara och om bilen behöver vänta."}, {"heading": "Grupper, bagage och flera bilar", "text": "Ange antal resenärer och mängden bagage i förfrågan. Storbil kan bokas för upp till sju passagerare. För större grupper kan du fråga om flera bilar; antal bilar och tillgänglighet bekräftas innan uppdraget bokas."}, {"heading": "Så begär du en offert", "text": "Skicka företagets namn, kontaktperson, telefonnummer, datum, hämtadress, destination och eventuella stopp. Lägg till önskad återresa och särskilda behov. Vi återkommer med pris och tillgänglighet. En skickad förfrågan är inte en bekräftad bokning."}, {"heading": "Betalning och underlag", "text": "Ange faktureringsuppgifter och önskad referens redan i förfrågan om företaget behöver särskilt betalningsunderlag. Betalningssätt och villkor behöver överenskommas för uppdraget. Vid en vanlig onlinebokning visas de tillgängliga betalningsalternativen i bokningsflödet."}], "searches": ["företagstaxi Göteborg", "tjänsteresor Göteborg", "flygtransfer företag Landvetter"]});

export const seoPageMap = new Map(seoPages.map((page) => [page.slug, page]));
