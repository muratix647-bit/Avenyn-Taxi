"use client";
import {useEffect,useRef,useState} from 'react';
import {useBookingAlarm} from '@/lib/use-booking-alarm';
import {pickupAt,prebookingRisk} from '@/lib/prebooking-watch';
export default function PrebookingWatch({bookings,onEdit,owner}:{owner:string;bookings:any[];onEdit:(b:any)=>void}) {
 const [now,setNow]=useState(Date.now()); const {wanted,ready:enabled,audio,activate,disable}=useBookingAlarm(owner);
 const seen=useRef(new Set<string>()); const until=useRef(0);
 const rows=bookings.filter(b=>!b.archived_at&&!['completed','cancelled'].includes(b.status)&&pickupAt(b)>=now-7200000&&pickupAt(b)<=now+7*86400000).sort((a,b)=>pickupAt(a)-pickupAt(b));
 const urgent=rows.filter(b=>{const r=prebookingRisk(b,now);return r&&r.stage<=30;});
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  if(!wanted||!enabled||audio.current?.state!=='running') return;
  if(!urgent.length) until.current=0;
  for(const b of urgent){const risk=prebookingRisk(b,now)!;const key=`${b.id}:${pickupAt(b)}:${risk.stage}`;if(!seen.current.has(key)){seen.current.add(key);until.current=now+60000;}}
  if(now<until.current&&now%3000<1000){const ctx=audio.current;const o=ctx.createOscillator();const g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=740;g.gain.setValueAtTime(0.12,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.35);o.start();o.stop(ctx.currentTime+0.35);}
 },[now,enabled,wanted,urgent.length]);

 return <section className="dispatchTable" style={{marginBottom:20}}><div className="tableHead"><div><h2>Kommande förbokningar</h2><span>Nästa 7 dagar · {rows.length} körningar</span></div><button onClick={()=>{if(wanted&&enabled){until.current=0;disable();}else activate();}}>{wanted?(enabled?'Stäng av larm':'Tillåt ljud · På (sparat)'):'Aktivera larm'}</button></div>
 {rows.length===0?<p style={{padding:20}}>Inga kommande förbokningar.</p>:rows.map(b=>{const r=prebookingRisk(b,now);const accepted=['accepted','en_route','arrived','passenger_onboard'].includes(b.status);return <article key={b.id} className={`dispatchUpcomingCard ${r?'needsAttention':''}`}><time className="dispatchWatchTime" dateTime={new Date(pickupAt(b)).toISOString()}><small>HÄMTNING · {new Date(pickupAt(b)).toLocaleDateString('sv-SE',{timeZone:'Europe/Stockholm',day:'numeric',month:'short'})}</small><strong>{new Date(pickupAt(b)).toLocaleTimeString('sv-SE',{timeZone:'Europe/Stockholm',hour:'2-digit',minute:'2-digit'})}</strong></time><div className="dispatchWatchRoute"><b>Körning #{b.booking_number}</b><span>A · {b.pickup||b.pickup_address}</span><span>B · {b.destination||b.dropoff_address}</span><strong className={accepted?'acceptConfirmed':'acceptPending'}>{accepted?'✓ Accepterad':'◷ Väntar på accept'} · {b.driver_name||'Ingen förare'}</strong>{r&&<strong className="watchRisk">{r.message}</strong>}</div><button onClick={()=>onEdit(b)}>Öppna körning →</button></article>;})}
 <p style={{padding:'10px 16px',fontSize:13}}>Samma sparade larminställning som för nya bokningar. Webbläsaren kan kräva ett tryck efter omstart. Ljudet varar högst en minut per varning. Varningen ligger kvar tills körningen hanteras.</p></section>;
}
