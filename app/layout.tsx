import type { Metadata,Viewport } from "next";
import "./globals.css";
import "./website-brand.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.avenyntaxi.se"),
  title: {default:"Taxi Göteborg – Boka Taxi & Fastpris Landvetter | Avenyn Taxi",template:"%s | Avenyn Taxi"},
  description: "Boka taxi i Göteborg och fastpris till Landvetter. Se priset före bokning, välj barnstol eller storbil och följ din taxi. Lokal service sedan 2003.",
  applicationName: "Avenyn Taxi",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{url: "/icon-192.png", type: "image/png", sizes: "192x192"}],
    shortcut: "/icon-192.png",
    apple: [{url: "/icon-192.png", sizes: "192x192", type: "image/png"}],
  },
  robots:{index:true,follow:true,googleBot:{index:true,follow:true,"max-image-preview":"large","max-snippet":-1,"max-video-preview":-1}},
  openGraph:{images:[{url:"/avenyn-taxi-hero-premium.webp",width:1672,height:941,alt:"Avenyn Taxi – taxi i Göteborg och till Landvetter"}],type:"website",locale:"sv_SE",siteName:"Avenyn Taxi",url:"/",title:"Taxi Göteborg – Boka Taxi & Fastpris Landvetter | Avenyn Taxi",description:"Boka taxi Göteborg online och boka resa till eller från Landvetter med pris före bekräftelse."},
  twitter:{card:"summary_large_image",images:["/avenyn-taxi-hero-premium.webp"],title:"Taxi Göteborg & Landvetter – Avenyn Taxi",description:"Boka taxi Göteborg och flygplatstransfer till Landvetter med pris före bokning."},
};

export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#071d31"};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{const root=location.pathname==="/";const portal=/^\\/(dispatch|customer)(\\/|$)/.test(location.pathname);const key=root?"avenyn-customer-assets-v164":portal?"avenyn-portal-cache-v4":"";if(!key||localStorage.getItem(key)==="1")return;localStorage.setItem(key,"1");const clear="caches"in window?caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key)))):Promise.resolve();const update="serviceWorker"in navigator?navigator.serviceWorker.getRegistrations().then(regs=>Promise.all(regs.map(reg=>reg.update()))):Promise.resolve();Promise.allSettled([clear,update]).finally(()=>location.reload());}catch{}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({"@context":"https://schema.org","@graph":[{"@type":["TaxiService","LocalBusiness"],"@id":"https://www.avenyntaxi.se/#taxi",name:"Avenyn Taxi",legalName:"Citra Trans och Bilservice Aktiebolag",sameAs:["https://www.google.com/maps/search/?api=1&query=Avenyn+Taxi&query_place_id=ChIJGYLFXz0ACU0RzrygDAzVbUA"],url:"https://www.avenyntaxi.se/",logo:"https://www.avenyntaxi.se/avenyn-logo-optimized.webp",image:"https://www.avenyntaxi.se/avenyn-taxi-hero-premium.webp",telephone:"+46700315315",email:"info@avenyntaxi.se",identifier:{"@type":"PropertyValue",name:"Organisationsnummer",value:"556597-4796"},address:{"@type":"PostalAddress",streetAddress:"Kungsportsavenyn 1",addressLocality:"Göteborg",addressCountry:"SE"},priceRange:"$$",openingHoursSpecification:{"@type":"OpeningHoursSpecification",dayOfWeek:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],opens:"00:00",closes:"23:59"},areaServed:[{"@type":"City",name:"Göteborg"},{"@type":"AdministrativeArea",name:"Västra Götaland"},{"@type":"AdministrativeArea",name:"Halland"}],serviceType:["Taxi i Göteborg","Taxi i Västra Götaland","Flygplatstransfer till och från Landvetter"],hasOfferCatalog:{"@type":"OfferCatalog",name:"Taxitjänster",itemListElement:[{"@type":"Offer",itemOffered:{"@type":"Service",name:"Taxi Göteborg"}},{"@type":"Offer",itemOffered:{"@type":"Service",name:"Taxi till och från Landvetter"}},{"@type":"Offer",itemOffered:{"@type":"Service",name:"Storbil för upp till sju passagerare"}},{"@type":"Offer",itemOffered:{"@type":"Service",name:"Taxibud och budtransport i Göteborg",url:"https://www.avenyntaxi.se/bud-goteborg"}}]},availableLanguage:["sv","en"],contactPoint:{"@type":"ContactPoint",telephone:"+46700315315",email:"info@avenyntaxi.se",contactType:"customer service",availableLanguage:["Swedish","English"]}},{"@type":"WebSite","@id":"https://www.avenyntaxi.se/#website",url:"https://www.avenyntaxi.se/",name:"Avenyn Taxi",inLanguage:"sv-SE",publisher:{"@id":"https://www.avenyntaxi.se/#taxi"}}]})}}/>
        {children}
      </body>
    </html>
  );
}
