import type {Metadata} from "next";
import Home from "../home-client";
export const metadata:Metadata={title:{absolute:"Om Avenyn Taxi – Kontakt och service sedan 2003"},description:"Avenyn Taxi drivs av Citra Trans och Bilservice Aktiebolag, org.nr 556597-4796. Företagsuppgifter, kontakt och taxitjänster i Göteborg.",alternates:{canonical:"https://www.avenyntaxi.se/om-avenyn-taxi"}};
export default function Page(){return <Home view="about"/>;}
