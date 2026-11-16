'use client';

import {AppText} from "@/components/app-language";
import {useCallback,useEffect,useRef,useState} from 'react';
import {hasNativeTap,nativeTap} from '@/lib/native-tap-to-pay';
import {amountOre} from '@/lib/street-payment-validation';
type Attempt={id:string;amount:string;reference:string};
const money=(ore:number)=>(ore/100).toLocaleString('sv-SE',{style:'currency',currency:'SEK'});
function storageKey(token:string){try{return 'avenyn-tap-'+JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub}catch{return 'avenyn-tap-current'}}
export default function TapToPay({accessToken,rows,onChange,onLock,onBusy,active=false}:{active?:boolean;accessToken:string;rows:any[];onChange:()=>Promise<void>;onLock:(locked:boolean)=>void;onBusy:(busy:boolean)=>void}){
 const [amount,setAmount]=useState(''),[reference,setReference]=useState(''),[attempt,setAttempt]=useState<Attempt|null>(null),[payment,setPayment]=useState<any>(null),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[capability,setCapability]=useState('Kontrollerar telefonen…'),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{onBusy(busy);return()=>onBusy(false)},[busy,onBusy]);
 const lock=useRef(false);const key=storageKey(accessToken);
 const call=useCallback(async(init:RequestInit={},id?:string)=>{const r=await fetch('/api/payments/terminal'+(id?'?id='+encodeURIComponent(id):''),{...init,headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},cache:'no-store'});const j:any=await r.json();if(!r.ok)throw new Error(j.error||'Kunde inte kontrollera betalningen.');return j},[accessToken]);
 useEffect(()=>{let alive=true;try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.id&&saved?.amount){setAttempt(saved);setAmount(saved.amount);setReference(saved.reference||'');onLock(true)}}catch{}setReady(true);
  if(!hasNativeTap()){setCapability('Blippbetalning kräver den uppdaterade Android-förarappen (version 1.5.0 eller senare).');return;}
  nativeTap.availability().then(r=>{if(alive)setCapability(r.available?'':r.reason||'Telefonen stöds inte.')}).catch(()=>{if(alive)setCapability('Kunde inte kontrollera telefonen. Öppna förarappen igen.')});return()=>{alive=false};
 },[key,onLock]);
 // Prepare merchant configuration without creating or charging a payment.
 useEffect(()=>{if(!active||!hasNativeTap())return;const controller=new AbortController();void call({signal:controller.signal}).catch(()=>{});return()=>controller.abort();},[active,call]);
 function save(next:Attempt){localStorage.setItem(key,JSON.stringify(next));setAttempt(next);onLock(true)}
 function accept(row:any){setPayment(row);if(row.status==='paid')setMessage('Betalningen är bekräftad av Stripe.');else if(row.status==='expired')setMessage('Betalningen är avbruten.');else setMessage('Betalningen är inte bekräftad. Kontrollera status eller återuppta samma betalning.');}
 async function check(){if(!attempt||lock.current)return;lock.current=true;setBusy(true);setError('');try{accept((await call({},attempt.id)).payment);await onChange()}catch(e:any){setError(e.message)}finally{lock.current=false;setBusy(false)}}
 async function start(e:React.FormEvent){e.preventDefault();if(!ready||lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('Förbereder blippbetalning…');let current=attempt;
  try{
   if(!hasNativeTap())throw new Error(capability||'Öppna den uppdaterade Android-förarappen.');
   const availability=await nativeTap.availability();if(!availability.available)throw new Error(availability.reason||'Telefonen stöds inte.');
   amountOre(amount);if(!current){current={id:crypto.randomUUID(),amount,reference:reference.trim()};save(current)}
   const result=await call({method:'POST',body:JSON.stringify({action:'create',...current})});accept(result.payment);
   if(result.clientSecret){setMessage('Ansluter Stripes säkra kortläsare… Vänta på blipprutan på telefonen.');let nativeError='';try{await nativeTap.pay({accessToken,clientSecret:result.clientSecret,locationId:result.locationId})}catch(e:any){nativeError=e.message||'Blippningen avbröts.'}
    setMessage('Kontrollerar betalningen hos Stripe…');const verified=(await call({},current.id)).payment;accept(verified);if(verified.status!=='paid'&&nativeError)setError(nativeError);
   }
   await onChange();
  }catch(e:any){setError(e.message);setMessage(current?'Försök inte debitera kunden på nytt innan status för detta försök har kontrollerats.':'')}
  finally{lock.current=false;setBusy(false)}
 }
 async function cancel(){if(!attempt||lock.current)return;lock.current=true;setBusy(true);setError('');try{accept((await call({method:'DELETE',body:JSON.stringify({id:attempt.id})})).payment);await onChange()}catch(e:any){setError(e.message)}finally{lock.current=false;setBusy(false)}}
 function reset(){if(busy||!['paid','expired'].includes(payment?.status))return;localStorage.removeItem(key);setAttempt(null);setPayment(null);setAmount('');setReference('');setMessage('');setError('');onLock(false)}
 function resume(row:any){if(busy||attempt)return;const next={id:row.id,amount:String(row.amount_ore/100),reference:row.reference||''};try{save(next);setAmount(next.amount);setReference(next.reference);setPayment(row)}catch{setError('Betalningsförsöket kunde inte sparas i telefonen.')}}
 const done=['paid','expired'].includes(payment?.status);
 return <div className="streetTap"><p><AppText text={"Kunden blippar kort, Apple Pay eller Google Pay mot förarens telefon. Betalningen går till Avenyn Taxis Stripe-konto."} /></p>{capability&&<p role="status">{<AppText text={capability} />}</p>}
 <form onSubmit={start}><label><AppText text={"Belopp (kr)"} /><input required inputMode="decimal" value={amount} placeholder="350" disabled={busy||!!attempt} onChange={e=>setAmount(e.target.value)}/></label><label><AppText text={"Referens (valfritt)"} /><input maxLength={120} value={reference} disabled={busy||!!attempt} onChange={e=>setReference(e.target.value)} placeholder="T.ex. taxameternummer"/></label>
 {!done&&<button className="streetPrimary" disabled={!ready||busy||!!capability}>{<AppText text={busy?'Betalning pågår…':attempt?'Återuppta samma blippbetalning':'Ta betalt med blipp'} />}</button>}</form>
 {message&&<p role="status" className={payment?.status==='paid'?'streetPaid':''}>{<AppText text={message} />}</p>}{error&&<p role="alert" className="streetError">{<AppText text={error} />}</p>}
 {attempt&&<><small><AppText text={"Betalningsreferens:"} />{<AppText text={attempt.id.slice(0,8)} />}</small>{!done&&<div className="streetTapActions"><button disabled={busy} onClick={()=>void check()}><AppText text={"Kontrollera status"} /></button><button disabled={busy} onClick={()=>void cancel()}><AppText text={"Avbryt betalningen"} /></button></div>}{done&&<><strong>{<AppText text={money(payment.amount_ore)} />} · {<AppText text={payment.status==='paid'?'Betald':'Avbruten'} />}</strong>{payment.status==='paid'&&payment.receipt_url&&<a href={payment.receipt_url} target="_blank" rel="noopener noreferrer"><AppText text={"Visa betalningskvitto"} /></a>}<button disabled={busy} onClick={reset}><AppText text={"Ny betalning"} /></button></>}</>}
 {!attempt&&rows.filter(r=>r.payment_channel==='tap_to_pay'&&['creating','pending'].includes(r.status)).map(r=><button key={r.id} disabled={busy} onClick={()=>resume(r)}><AppText text={"Kontrollera tidigare försök ·"} />{<AppText text={money(r.amount_ore)} />} · {<AppText text={r.id.slice(0,8)} />}</button>)}
 <small><AppText text={"Internetanslutning och en kompatibel Android-telefon med NFC krävs."} /></small></div>
}
