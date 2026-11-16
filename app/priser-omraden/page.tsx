import type {Metadata} from "next";
import Home from "../home-client";
export const metadata:Metadata={title:{absolute:"Taxipriser och områden – Landvetter | Avenyn Taxi"},description:"Sök aktuella fastpriser till Landvetter och planera taxi i Göteborg, Marstrand, Henån och Smögen.",alternates:{canonical:"https://www.avenyntaxi.se/priser-omraden"}};
export default function Page(){return <Home view="prices"/>;}
