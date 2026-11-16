import type {MetadataRoute} from "next";
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:"*",allow:"/",disallow:["/api/","/bokning/","/customer","/dispatch","/driver","/forarapp","/forare/","/payment","/radera-konto","/track/","/r/","/k/","/akeri"]},sitemap:"https://www.avenyntaxi.se/sitemap.xml",host:"https://www.avenyntaxi.se"}}
