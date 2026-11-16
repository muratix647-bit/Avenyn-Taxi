import type {Metadata} from "next";
import InstallApp from "@/components/install-app";
export const metadata:Metadata={title:"Förarapp",manifest:"/driver.webmanifest",robots:{index:false,follow:false,nocache:true}};
export default function DriverLayout({children}:{children:React.ReactNode}){return <>{children}<InstallApp kind="driver"/></>;}
