'use client';
import {useEffect,useState} from 'react';
export default function StreetPaymentResult(){
 const [message,setMessage]=useState('Kontrollerar betalningen…');
 useEffect(()=>{let alive=true;const params=new URLSearchParams(location.search);const id=params.get('session_id');if(!id){setMessage('Betalningen avbröts. Du kan öppna samma betallänk igen.');return;}const check=()=>fetch('/api/payments/street?session_id='+encodeURIComponent(id),{cache:'no-store'}).then(async r=>{const j=await r.json();if(alive)setMessage(r.ok?(j.paid?`Tack! ${j.amount.toLocaleString('sv-SE')} kr är betalt.`:'Betalningen är ännu inte bekräftad.'):j.error);}).catch(()=>{if(alive)setMessage('Kunde inte kontrollera betalningen. Föraren kan kontrollera status.');});void check();const timer=setInterval(check,5000);return()=>{alive=false;clearInterval(timer)}},[]);
 return <main className="paymentPage"><section className="paymentCard"><img src="/avenyn-logo-optimized.webp" alt="Avenyn Taxi" width="80" height="80"/><h1>{message}</h1><p>Visa bekräftelsen för föraren.</p></section></main>;
}
