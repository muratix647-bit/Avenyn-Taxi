"use client";
import {useEffect, useState} from "react";
import {isCustomerAppBrowser} from "@/lib/customer-app-mode";
export default function CustomerAppEntry({children}:{children:React.ReactNode}) {
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    if(isCustomerAppBrowser() && new URLSearchParams(window.location.search).get("portal")!=="1") {
      window.location.replace("/?native=customer");
    } else setReady(true);
  },[]);
  return ready ? children : <p role="status" style={{padding:20}}>Öppnar…</p>;
}
