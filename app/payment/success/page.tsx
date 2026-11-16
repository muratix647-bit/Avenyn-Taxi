"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, XCircle } from "lucide-react";

export default function PaymentSuccessPage() {
  const [state,setState]=useState<"loading"|"paid"|"failed">("loading"),[message,setMessage]=useState("Kontrollerar betalningen…");
  useEffect(()=>{const sessionId=new URLSearchParams(location.search).get("session_id");if(!sessionId){setState("failed");setMessage("Betalningen saknas.");return}fetch(`/api/payments/checkout?session_id=${encodeURIComponent(sessionId)}`,{cache:"no-store"}).then(async r=>({ok:r.ok,data:await r.json()})).then(({ok,data})=>{if(ok&&data.paid){setState("paid");setMessage("Betalningen är klar. Tack!")}else{setState("failed");setMessage(data.error||"Betalningen är inte genomförd.")}}).catch(()=>{setState("failed");setMessage("Betalningen kunde inte kontrolleras.")})},[]);
  return <main className="paymentPage"><section className="paymentCard"><img src="/avenyn-logo-optimized.webp" width="92" height="92" alt="Avenyn Taxi"/>{state==="loading"?<LoaderCircle className="paymentSpinner"/>:state==="paid"?<Check className="paymentDone"/>:<XCircle className="paymentFailed"/>}<h1>{message}</h1><p>{state==="paid"?"Bokningen är nu markerad som betald hos Avenyn Taxi.":"Inga pengar registreras som betalda förrän Stripe har bekräftat betalningen."}</p><Link href="/">Till Avenyn Taxi</Link></section></main>;
}
