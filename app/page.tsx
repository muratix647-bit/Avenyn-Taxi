import {headers} from "next/headers";
import {isCustomerAppUserAgent} from "@/lib/customer-app-mode";
import type {Metadata} from "next";
import Home from "./home-client";


export const dynamic = "force-dynamic";
export const metadata:Metadata = {title:{absolute:"Taxi Göteborg – Boka Taxi & Fastpris Landvetter | Avenyn Taxi"},description:"Boka taxi i Göteborg och fastpris till Landvetter. Se priset före bokning, välj barnstol eller storbil och följ din taxi. Lokal service sedan 2003.",alternates:{canonical:"https://www.avenyntaxi.se/"},openGraph:{images:[{url:"/avenyn-taxi-hero-premium.webp",width:1672,height:941,alt:"Avenyn Taxi i Göteborg"}],title:"Taxi Göteborg – Välkommen till Avenyn Taxi",description:"Förboka taxi i Göteborg och till Landvetter. Personlig service sedan 2003, pris före bokning och liveföljning.",url:"https://www.avenyntaxi.se/"}};
const homePageSchema={"@context":"https://schema.org","@type":"WebPage","@id":"https://www.avenyntaxi.se/#webpage",url:"https://www.avenyntaxi.se/",name:"Taxi Göteborg – Fastpris Landvetter och bokning online",description:"Förboka taxi i Göteborg med Avenyn Taxi. Pris före bokning, storbil, barnstol och flygplatstransfer.",inLanguage:"sv-SE",isPartOf:{"@id":"https://www.avenyntaxi.se/#website"},about:{"@id":"https://www.avenyntaxi.se/#taxi"}};

export default async function Page({ searchParams }: { searchParams: Promise<{ native?: string }> }) {
  const appMode = (await searchParams).native === "customer" || isCustomerAppUserAgent((await headers()).get("user-agent") || "");
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(homePageSchema)}}/><Home bookingOnly={appMode} /></>;
}
