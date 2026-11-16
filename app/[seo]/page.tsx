import SocialLinks from "@/components/social-links";
import type {Metadata} from "next";
import Image from "next/image";
import {notFound} from "next/navigation";
import {ArrowRight,Check,Mail,MapPin,Phone} from "lucide-react";
import {seoPageMap,seoPages} from "@/lib/seo-pages";
import {seoDetails} from "@/lib/seo-details";
import {publicSupabase} from "@/lib/supabase-server";

const origin="https://www.avenyntaxi.se";
export const dynamic="force-dynamic";

type PopularPrice={code:string;locality:string;region:string;price:number};
const popularAreas=["Avenyn","Göteborg Central","Göteborg Centralstation","Mölndal","Partille","Backa","Majorna","Hisingen"];

async function getPopularPrices():Promise<PopularPrice[]>{
  try{
    const {data,error}=await publicSupabase().from("price_zones").select("code,name,region,fixed_price").eq("active",true).in("name",popularAreas);
    if(error)throw error;
    return (data??[]).map(row=>({code:row.code,locality:row.name,region:row.region,price:Number(row.fixed_price)})).sort((a,b)=>popularAreas.indexOf(a.locality)-popularAreas.indexOf(b.locality));
  }catch{return[];}
}

export function generateStaticParams(){return seoPages.map(({slug})=>({seo:slug}));}

export async function generateMetadata({params}:{params:Promise<{seo:string}>}):Promise<Metadata>{
  const {seo}=await params,page=seoPageMap.get(seo);
  if(!page)return{robots:{index:false,follow:false}};
  return{
    title:page.title,
    description:page.description,
    alternates:{canonical:`${origin}/${page.slug}`},
    openGraph:{images:[{url:"/avenyn-taxi-hero-premium.webp",width:1672,height:941,alt:"Avenyn Taxi"}],type:"website",locale:"sv_SE",siteName:"Avenyn Taxi",url:`/${page.slug}`,title:page.title,description:page.description},
    twitter:{card:"summary_large_image",images:["/avenyn-taxi-hero-premium.webp"],title:page.title,description:page.description},
  };
}

export default async function SeoLanding({params}:{params:Promise<{seo:string}>}){
  const {seo}=await params,page=seoPageMap.get(seo);
  if(!page)notFound();
  const detail=seoDetails[page.slug];
  const popularPrices=page.slug==="taxi-landvetter"?await getPopularPrices():[];
  const bookingQuery=new URLSearchParams();
  if(page.slug==="taxi-landvetter")bookingQuery.set("booking","to-landvetter");
  else if(page.slug==="taxi-goteborg-central")bookingQuery.set("pickup","Göteborg Centralstation");
  else bookingQuery.set("pickup",page.area);
  const bookingHref=`/?${bookingQuery.toString()}#booking-form`;
  const quoteQuery=new URLSearchParams({quote:"1",pickup:page.area,dropoff:"Landvetter Airport"});
  const isQuote=page.ctaType==="quote",isService=page.ctaType==="service",ctaHref=isService?"/om-avenyn-taxi#service-request":isQuote?`/?${quoteQuery.toString()}#quote-form`:bookingHref;
  const ctaText=isService?"Skicka förfrågan":isQuote?"Begär offert":page.bookingText;
  const fallbackRelated=["taxi-vastra-gotaland","taxi-goteborg","taxi-landvetter","taxi-goteborg-central"];
  const related=(page.relatedSlugs??fallbackRelated).filter(slug=>slug!==page.slug).map(slug=>seoPageMap.get(slug)).filter((item):item is NonNullable<typeof item>=>Boolean(item)).slice(0,4);
  const schemas=[
    {"@context":"https://schema.org","@type":"Service","@id":`${origin}/${page.slug}#service`,name:page.h1,serviceType:isService?page.h1:"Taxitjänst",provider:{"@id":`${origin}/#taxi`},areaServed:{"@type":"Place",name:page.area},url:`${origin}/${page.slug}`},
    {"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Avenyn Taxi",item:origin},{"@type":"ListItem",position:2,name:page.h1,item:`${origin}/${page.slug}`}]},
    ...(detail?.faq?.length?[{"@context":"https://schema.org","@type":"FAQPage",mainEntity:detail.faq.map(item=>({"@type":"Question",name:item.question,acceptedAnswer:{"@type":"Answer",text:item.answer}}))}]:[]),
  ];
  return <main className="seoLanding">
    {schemas.map((schema,index)=><script key={index} type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>)}
    <header className="seoHeader">
      <a href="/" className="seoBrand"><Image src="/avenyn-logo-optimized.webp" width="56" height="56" alt="Avenyn Taxi"/><b>Avenyn Taxi</b></a>
      <nav aria-label="Huvudmeny"><a href="/taxi-goteborg">Göteborg</a><a href="/taxi-landvetter">Landvetter</a><a href="/taxi-omraden">Alla områden</a><a href="/priser-omraden#priser">Priser</a></nav>
      <a className="seoPhone" href="tel:+46700315315"><Phone/>+46 700 315 315</a>
    </header>
    <nav className="seoBreadcrumb" aria-label="Brödsmulor"><a href="/">Avenyn Taxi</a><span aria-hidden="true"> / </span><span aria-current="page">{page.h1}</span></nav>
    <section className="seoHero">
      <div>
        <small>{page.eyebrow}</small>
        <h1>{page.h1}</h1>
        <p>{page.intro}</p>
        <div className="seoActions"><a className="seoPrimary" href={ctaHref}>{ctaText}<ArrowRight/></a><a href="tel:+46700315315"><Phone/>Ring Avenyn Taxi</a></div>
      </div>
      <aside aria-label={isService?"Så fungerar förfrågan":"Så fungerar bokningen"}>
        <MapPin/>
        <h2>{isService?"Skicka rätt uppgifter":"Boka med rätt adress"}</h2>
        {isService?<ol><li><Check/>Välj typ av uppdrag</li><li><Check/>Ange adresser och önskad tid</li><li><Check/>Vi återkommer med bekräftelse</li></ol>:<ol><li><Check/>Välj fullständig hämtadress</li><li><Check/>Ange destination och tid</li><li><Check/>Kontrollera pris och biltyp</li></ol>}
        <a href={ctaHref}>{isService?"Öppna förfrågan":isQuote?"Öppna offertformuläret":"Öppna bokningen"} <ArrowRight/></a>
      </aside>
    </section>
    {page.slug==="taxi-landvetter"&&popularPrices.length>0&&<section className="seoPrices" aria-labelledby="popular-prices-title">
      <div><small>AKTIVA PRISER FRÅN PRISMOTORN</small><h2 id="popular-prices-title">Populära fastpriser till Landvetter</h2><p>Priserna hämtas direkt från Avenyn Taxis centrala prislista. Endast aktiva officiella områden visas.</p></div>
      <div className="seoPriceGrid">{popularPrices.map(row=><a key={row.code} href={`/?booking=to-landvetter&pickup=${encodeURIComponent(row.locality)}#booking-form`}><span><b>{row.locality}</b><small>{row.region}</small></span><strong>{row.price} kr</strong><em>Boka taxi till Landvetter</em></a>)}</div>
    </section>}
    <section className="seoContent" aria-label={`Taxi i ${page.area}`}>
      {page.sections.map((section)=><article key={section.heading}><h2>{section.heading}</h2><p>{section.text}</p></article>)}
    </section>
    {page.slug==="taxi-landvetter"&&<section className="seoContent seoLandvetterContent" aria-label="Planera resan till Landvetter">
      <article><h2>Flygnummer och försenat flyg</h2><p>Lägg gärna till flygnummer i bokningen. När aktuell flyginformation finns kan den hjälpa trafikledningen och föraren att följa ankomsten. Håll telefonen tillgänglig om flyget blir försenat.</p></article>
      <article><h2>Var möter föraren kunden?</h2><p>Den exakta mötesplatsen bekräftas för den aktuella resan. Kontrollera bokningsinformationen efter landning och använd det mobilnummer som angavs vid bokningen.</p></article>
      <article><h2>Barnstol, storbil och bagage</h2><p>Välj barnstol som tillval och storbil för större sällskap. Ange passagerarantal och skriv en kommentar om ni har mycket eller skrymmande bagage.</p></article>
      <article><h2>Restid och förbokning</h2><p>Restiden varierar med startadress, trafik och tid på dygnet. Förboka med marginal till incheckning och säkerhetskontroll. Välj önskat datum och hämtningstid i bokningen. Kontakta oss om du behöver hjälp att planera en nära förestående resa.</p></article>
      <article><h2>Betalning och bekräftelse</h2><p>Tillgängliga betalningsalternativ visas i betalningsflödet. Efter bokning får du en bekräftelse med resans uppgifter och en personlig länk för liveföljning när förare har tilldelats.</p></article>
    </section>}
    {detail?.localHeading&&<section className="seoLocalGuide"><div><small>LOKAL INFORMATION</small><h2>{detail.localHeading}</h2><p>{detail.localText}</p></div>{detail.links?.length?<nav aria-label="Relaterade taxiresor">{detail.links.map(link=><a key={link.href} href={link.href}>{link.label}<ArrowRight/></a>)}</nav>:null}</section>}
    {['taxi-centrum','taxi-avenyn','taxi-goteborg-central','taxi-landvetter'].includes(page.slug)&&<section className="seoLocalGuide"><div><small>BOKA PÅ DITT SÄTT</small><h2>Webb, app, chatt eller telefon</h2><p>Fyll i resan online eller använd kundappen. På startsidan finns också Boka via chatt. Behöver du hjälp med mötesplats eller tillgänglighet kan du kontakta oss på telefon eller WhatsApp.</p></div><nav aria-label="Bokningsalternativ"><a href={bookingHref}>Boka online<ArrowRight/></a><a href="https://play.google.com/store/apps/details?id=se.avenyntaxi.app">Kundappen på Google Play<ArrowRight/></a><a href="https://wa.me/46700315315">Kontakta oss på WhatsApp<ArrowRight/></a><a href="/priser-omraden#priser">Hela Landvetterprislistan<ArrowRight/></a></nav></section>}
    <section className="seoTrust">
      <div><small>AVENYN TAXI</small><h2>En tydlig bokning från start till mål</h2><p>Du ser resans uppgifter före bekräftelse. När bokningen är skapad får du information via e-post och kan använda spårningslänken för just din resa.</p></div>
      <ul><li><Check/>Vanlig bil eller storbil</li><li><Check/>Barnstol kan väljas</li><li><Check/>Telefon och WhatsApp</li></ul>
    </section>
    <section className="seoRelated"><h2>Fler orter och resor</h2><p><a href="/taxi-omraden">Se stadsdelar i Göteborg och orter inom cirka 20 mil</a></p><div>{related.map(item=><a key={item.slug} href={`/${item.slug}`}><span>{item.h1}</span><ArrowRight/></a>)}</div></section>
    {detail?.faq?.length?<section className="seoFaq" aria-labelledby="seo-faq-title"><h2 id="seo-faq-title">Vanliga frågor</h2>{detail.faq.map(item=><details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>:null}
    <section className="seoFinal"><h2>{isService?"Vill du skicka en förfrågan?":isQuote?"Vill du få ett prisförslag?":"Redo att boka?"}</h2><p>{isService?"Skicka uppdragets grunduppgifter. Vi återkommer med pris, tillgänglighet och besked om vad som behövs.":isQuote?"Skicka resans uppgifter till Avenyn Taxi. Förfrågan är inte en bekräftad bokning.":"Välj hämtadress, destination och önskad tid i Avenyn Taxis bokning."}</p><a href={ctaHref}>{isService?"Skicka förfrågan":isQuote?"Begär offert":"Boka taxi online"} <ArrowRight/></a></section>
    <footer className="seoFooter"><a href="/">Avenyn Taxi</a><a href="tel:+46700315315"><Phone/>+46 700 315 315</a><a href="mailto:info@avenyntaxi.se"><Mail/>info@avenyntaxi.se</a><span>Kungsportsavenyn 1, Göteborg</span><span>Org.nr 556597-4796</span><span>Göteborg · sedan 2003</span><SocialLinks /></footer>
  </main>;
}
