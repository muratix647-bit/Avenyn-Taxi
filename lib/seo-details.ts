export type SeoDetail = {
  localHeading?: string;
  localText?: string;
  links?: Array<{ href: string; label: string }>;
  faq?: Array<{ question: string; answer: string }>;
};

export const seoDetails: Record<string, SeoDetail> = {
"taxi-centrum":{"localHeading": "Planera din resa från Göteborg centrum", "localText": "Kontrollera hämtadress, gatunummer och tid innan bokningen bekräftas. För resan till flygplatsen kan du jämföra områden i vår aktuella Landvetterprislista.", "links": [{"href": "/priser-omraden#priser", "label": "Se alla fastpriser till Landvetter"}, {"href": "/taxi-landvetter", "label": "Hämtning och resor från Landvetter"}], "faq": [{"question": "Vad kostar taxi från Göteborg centrum till Landvetter?", "answer": "Välj din fullständiga hämtadress och Landvetter Airport i bokningen. Aktuellt pris och valda tillval visas före bekräftelse. Om inget pris kan verifieras kontaktar du oss för besked."}, {"question": "Kan jag förboka från mitt hotell?", "answer": "Ja. Ange hotellets namn, gatuadress, önskat datum och hämtningstid. Kontrollera entré och bagagebehov innan du bekräftar."}, {"question": "Kan jag få hjälp att välja mötesplats?", "answer": "Ja, ring 0700-315 315 eller kontakta oss via WhatsApp. Ange var du befinner dig så kan mötesplatsen stämmas av."}]},
"taxi-avenyn":{"localHeading": "Planera din resa från Avenyn", "localText": "Kontrollera hämtadress, gatunummer och tid innan bokningen bekräftas. För resan till flygplatsen kan du jämföra områden i vår aktuella Landvetterprislista.", "links": [{"href": "/priser-omraden#priser", "label": "Se alla fastpriser till Landvetter"}, {"href": "/taxi-landvetter", "label": "Hämtning och resor från Landvetter"}], "faq": [{"question": "Vad kostar taxi från Avenyn till Landvetter?", "answer": "Välj din fullständiga hämtadress och Landvetter Airport i bokningen. Aktuellt pris och valda tillval visas före bekräftelse. Om inget pris kan verifieras kontaktar du oss för besked."}, {"question": "Kan jag förboka från mitt hotell?", "answer": "Ja. Ange hotellets namn, gatuadress, önskat datum och hämtningstid. Kontrollera entré och bagagebehov innan du bekräftar."}, {"question": "Kan jag få hjälp att välja mötesplats?", "answer": "Ja, ring 0700-315 315 eller kontakta oss via WhatsApp. Ange var du befinner dig så kan mötesplatsen stämmas av."}]},
"bud-goteborg": {
  "localHeading": "Förbered hämtning och leverans",
  "localText": "Ha adresser, kontaktpersoner, telefonnummer, mått och vikt till hands när du kontaktar oss. Vid brådskande bud anger du den senaste tid som leveransen behöver vara framme.",
  "links": [
    {
      "href": "/foretagstaxi-goteborg",
      "label": "Företagstaxi och planerade företagsresor"
    },
    {
      "href": "/om-avenyn-taxi#service-request",
      "label": "Skicka budförfrågan"
    },
    {
      "href": "/taxi-omraden",
      "label": "Göteborgs stadsdelar och orter runt omkring"
    }
  ],
  "faq": [
    {
      "question": "Kan jag skicka ett paket utan att själv åka med?",
      "answer": "Ja, en budförfrågan kan gälla transport av en försändelse utan medföljande resenär. Beskriv paketets innehåll, mått och vikt så bekräftar vi om uppdraget kan utföras."
    },
    {
      "question": "Går det att beställa expressbud i Göteborg?",
      "answer": "Ring 0700 315 315 vid brådskande leverans. Ange adresserna och när försändelsen behöver vara framme. Vi behöver kontrollera bil och tidsplan innan vi bekräftar uppdraget."
    },
    {
      "question": "Får jag priset innan budkörningen beställs?",
      "answer": "Ja, vi återkommer med pris och tillgänglighet utifrån transportuppgifterna. En budförfrågan är inte en bekräftad beställning."
    },
    {
      "question": "Vilka uppgifter behöver ni för budtransport?",
      "answer": "Vi behöver hämtadress, leveransadress, önskad tid, innehåll, mått och vikt samt namn och telefonnummer till avsändare och mottagare. Ange också eventuella stopp, portkoder och referenser."
    },
    {
      "question": "Kan företag fråga om återkommande budkörningar?",
      "answer": "Ja. Beskriv vilka sträckor, försändelser och tider det gäller, så återkommer vi om upplägg, pris och tillgänglighet."
    }
  ]
},
  "taxi-goteborg": {
    faq: [
      {question:"Hur bokar jag taxi nära mig i Göteborg?",answer:"Skriv din hämtadress och destination i bokningen, välj tid och biltyp och kontrollera priset före bekräftelse. Om du använder platsknappen behöver du tillåta platsåtkomst och kontrollera att adressen stämmer."},
      {question:"Kan jag boka utan att dela min position?",answer:"Ja. Skriv in gatuadress och gatunummer manuellt och välj rätt adressförslag. Ange gärna entré eller mötesplats så att föraren kan hitta dig."},
      {question:"Hur får jag veta väntetiden?",answer:"Ring Avenyn Taxi på 0700-315 315 för aktuell tillgänglighet och väntetid. Tiden varierar med hämtplats, trafik och lediga bilar."},
    ],
    localHeading: "En lokal taxiguide för Göteborg",
    localText: "Göteborg har olika trafikflöden kring centrum, evenemangsområden, hamnen och älvförbindelserna. Ange därför en tydlig mötesplats vid Centralstationen, Kungsportsavenyn, Järntorget, Liseberg, Svenska Mässan eller färjeterminalerna. Vid hotellhämtning är hotellets namn och gatuadress bra att kontrollera före bokning.",
    links: [
      { href: "/foretagstaxi-goteborg", label: "Företagstaxi och tjänsteresor i Göteborg" },
      { href: "/taxi-goteborg-central", label: "Boka taxi från Göteborg Centralstation" },
      { href: "/taxi-landvetter", label: "Taxi Göteborg till Landvetter" },
      { href: "/taxi-majorna", label: "Boka taxi i Majorna" },
      { href: "/taxi-hisingen", label: "Boka taxi på Hisingen" },
    ],
  },
  "taxi-landvetter": {
    localHeading: "Hämtning, flyginformation och mötesplats",
    localText: "Vid hämtning från Landvetter anger du flygnummer och ett mobilnummer som går att nå efter landning. Om flyget är försenat kan aktuell flyginformation hjälpa trafikledningen och föraren att följa ankomsten. Exakt mötesplats bekräftas för den aktuella resan. Ange hur många som reser och hur mycket bagage ni har, och välj storbil eller barnstol när det behövs.",
    links: [
      { href: "/taxi-molndal", label: "Taxi Mölndal till Landvetter" },
      { href: "/taxi-partille", label: "Taxi Partille till Landvetter" },
      { href: "/taxi-hisingen", label: "Taxi Hisingen till Landvetter" },
      { href: "/taxi-majorna", label: "Taxi Majorna till Landvetter" },
      { href: "/taxi-goteborg", label: "Taxi från Linné och Göteborg till Landvetter" },
      { href: "/taxi-goteborg-central", label: "Taxi Centralstationen till Landvetter" },
      { href: "/taxi-goteborg-kungsbacka", label: "Taxi Kungsbacka till Landvetter" },
      { href: "/taxi-boras", label: "Taxi Borås till Landvetter" },
      { href: "/taxi-alingsas", label: "Taxi Alingsås till Landvetter" },
    ],
    faq: [
      { question: "Vad kostar taxi till Landvetter?", answer: "Priset beror på hämtadressen. Aktiva officiella fastpriser hämtas direkt från Avenyn Taxis centrala prislista och visas bara när området kan verifieras." },
      { question: "Kan jag ange flygnummer?", answer: "Ja. Lägg gärna in flygnumret i bokningen så att resan kan kopplas till aktuell flyginformation när den finns." },
      { question: "Vad händer om flyget är försenat?", answer: "Aktuell flyginformation kan användas för att följa ankomsten. Håll även telefonen tillgänglig för information om din hämtning." },
      { question: "Var möter föraren mig på flygplatsen?", answer: "Mötesplatsen bekräftas för den aktuella resan. Kontrollera bokningsinformationen och håll telefonen tillgänglig efter landning." },
      { question: "Kan jag boka taxi från Landvetter till Göteborg?", answer: "Ja. Välj Landvetter Airport som hämtplats och skriv den fullständiga adressen i Göteborg som destination." },
      { question: "Kan jag boka storbil eller barnstol?", answer: "Ja. Välj storbil för större sällskap och lägg till barnstol i bokningen när det behövs." },
    ],
  },
  "taxi-goteborg-central": {
    faq: [
      {question:"Var möter jag min förbokade taxi vid Centralen?",answer:"Ange entré och mötesplats i bokningen och kontrollera uppgifterna i bekräftelsen. En förbokad bil behöver inte stå i den vanliga taxikön. Ring om du är osäker på var du ska vänta."},
      {question:"Kan jag boka från Nils Ericson Terminalen?",answer:"Ja. Ange terminalen som hämtplats och komplettera med tydlig entré eller gatuadress. Välj destination och önskad hämtningstid i formuläret."},
      {question:"Vad gör jag om mitt tåg är försenat?",answer:"Kontakta Avenyn Taxi så snart du vet att din ankomst ändras. Ange bokningsnummer och ny beräknad ankomsttid så att hämtningen kan stämmas av."},
    ],

    localHeading: "Tydlig hämtning vid Göteborg Central",
    localText: "Centralstationen ligger nära Nils Ericson Terminalen, Drottningtorget och flera hotell. Ange en tydlig mötesplats och gärna tågnummer eller ankomsttid. Härifrån kan du boka direkt till Avenyn, Linné, Majorna, Hisingen, Svenska Mässan eller Landvetter.",
  },
  "taxi-molndal": {
    localHeading: "Mölndal centrum, Åby, Krokslätt och Sisjön",
    localText: "För resor i Mölndal är den exakta adressen viktig eftersom kommunen omfattar både centrala lägen och handels- och bostadsområden. Boka till Göteborg centrum, Centralstationen eller Landvetter från Mölndal centrum, Åby, Krokslätt, Sisjön och närliggande adresser.",
  },
  "taxi-partille": {
    localHeading: "Partille centrum, Sävedalen och Jonsered",
    localText: "Boka från Partille centrum, Sävedalen, Jonsered eller en annan fullständig adress. För resor mot Göteborg eller Landvetter anger du önskad tid, passagerarantal och biltyp i samma bokning.",
  },
  "taxi-hisingen": {
    localHeading: "Backa, Lindholmen, Eriksberg, Torslanda och Bäckebol",
    localText: "Hisingen är stort och restiden varierar mellan områdena. Ange rätt gatuadress i Backa, Lindholmen, Eriksberg, Torslanda, Bäckebol eller annan del av Hisingen. För en flygresa väljer du Landvetter som destination och det officiella priset visas endast när området finns aktivt i prislistan.",
  },
  "taxi-majorna": {
    localHeading: "Majorna, Stigberget och närliggande Linné",
    localText: "Boka från bostäder, restauranger och mötesplatser i Majorna och Stigberget eller vidare mot Linné. För hämtning på en trafikerad gata är ett tydligt gatunummer och ett nåbart mobilnummer särskilt viktigt.",
  },
  "taxi-goteborg-kungsbacka": {
    localHeading: "Kungsbacka centrum, Hede och Onsala",
    localText: "Res mellan Göteborg och Kungsbacka centrum, Hede, Onsala eller annan vald adress. För Landvetterresor används endast ett aktivt pris från den centrala prislistan; annars skickar du en prisförfrågan.",
  },
  "taxi-boras": {
    localHeading: "Borås centrum, Knalleland och Viared",
    localText: "Boka en planerad resa från Borås centrum, Knalleland, Viared eller en annan fullständig adress till Göteborg, Landvetter eller vald destination. Ange tid och flygnummer i god tid för en flygplatsresa.",
  },
  "taxi-alingsas": {
    localHeading: "Alingsås centrum och stationen",
    localText: "Boka från Alingsås centrum, stationen eller en bostadsadress till Göteborg eller Landvetter. För längre resor är det bra att ange önskad hämtningstid, passagerare, bagage och flygnummer i förväg.",
  },
  "taxi-lerum": {
    localHeading: "Lerum centrum, Floda och Stenkullen",
    localText: "Boka från Lerum centrum, Floda, Stenkullen eller en annan adress i kommunen. Den fullständiga adressen avgör rätt upphämtning och om ett aktivt Landvetter-fastpris kan användas.",
  },
  "taxi-goteborg-varberg": {
    localHeading: "Göteborg–Varberg med planerad hämtning",
    localText: "Boka mellan Göteborg och Varberg centrum, stationen, hotell eller annan vald adress. För en längre resa bör datum, tid, antal resenärer och bagage anges tydligt i prisförfrågan.",
  },
  "taxi-uddevalla": {
    localHeading: "Uddevalla centrum, Torp och stationen",
    localText: "Boka från Uddevalla centrum, Torp, stationen eller annan fullständig adress. Resan kan planeras till Göteborg, Landvetter eller en annan destination med biltyp och kontaktuppgifter samlade i förfrågan.",
  },
  "taxi-trollhattan": {
    localHeading: "Trollhättan centrum, stationen och Innovatum",
    localText: "Boka från Trollhättan centrum, resecentrum, Innovatum eller en annan adress. För resor till Landvetter eller Göteborg bör hämtningstid och eventuell flyginformation anges i förväg.",
  },
  "taxi-vanersborg": {
    localHeading: "Vänersborg centrum och resecentrum",
    localText: "Boka från Vänersborg centrum, resecentrum eller en fullständig bostads- eller företagsadress. Längre resor till Göteborg och Landvetter planeras bäst med tydlig tid och kontaktinformation.",
  },
  "taxi-goteborg-stenungsund": {
    localHeading: "Stenungsund centrum och stationen",
    localText: "Res mellan Göteborg och Stenungsund centrum, stationen, arbetsplatser eller bostadsområden. Ange båda adresserna och önskad tid för en korrekt planerad resa.",
  },
  "taxi-goteborg-tjorn": {
    localHeading: "Skärhamn, Rönnäng, Kållekärr och Myggenäs",
    localText: "På Tjörn är fullständig adress viktig eftersom avstånden mellan Skärhamn, Rönnäng, Kållekärr, Myggenäs och andra områden påverkar resan. Skicka en prisförfrågan för längre resor som saknar aktivt fastpris.",
  },
  "taxi-goteborg-smogen": {
    localHeading: "Smögenbryggan, Kungshamn och närområdet",
    localText: "Planera en resa till boende, hamnen eller en tillgänglig mötesplats nära Smögenbryggan. Ange en exakt adress och kontrollera var bilen kan stanna; en gångbrygga är inte en upphämtningsadress. För resa från Kungshamn anger du orten och gatuadressen separat. Skicka önskad tid, sällskapets storlek och bagage för ett prisförslag.",
    links: [{href:"/taxi-vastkusten",label:"Planera taxi till Västkusten"},{href:"/taxi-marstrand",label:"Taxi Marstrand"},{href:"/taxi-henan",label:"Taxi Henån och Orust"}],
    faq: [{question:"Kan jag boka taxi från Smögen till Landvetter?",answer:"Skicka en prisförfrågan med fullständig hämtadress, datum, tid och flygnummer. Pris och tillgänglighet bekräftas för den aktuella resan."},{question:"Kan ni hämta vid Smögenbryggan?",answer:"Ange en tillgänglig mötesplats med gatuadress nära bryggan. Kontrollera med oss var bilen kan stanna innan hämtningen bekräftas."}],
  },
};
