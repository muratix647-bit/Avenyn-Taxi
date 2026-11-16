'use client';
import {useEffect,useRef,useState} from 'react';
export default function DispatchAcceptanceNotice({bookings,onOpen}:{bookings:any[];onOpen:(b:any)=>void}){
 const previous=useRef<Map<string,string>|null>(null);const [notices,setNotices]=useState<any[]>([]);
 useEffect(()=>{const next=new Map<string,string>(bookings.map(b=>[b.id,b.status]));if(previous.current){const changes=bookings.filter(b=>b.status==='accepted'&&previous.current!.has(b.id)&&previous.current!.get(b.id)!=='accepted');if(changes.length)setNotices(old=>[...changes,...old].filter((b,i,a)=>a.findIndex(x=>x.id===b.id)===i).slice(0,10));}previous.current=next;},[bookings]);
 return <div aria-live="polite">{notices.map(b=><div className="dispatchAcceptNotice" key={b.id}><div><strong>✓ {b.driver_name||'Föraren'} har accepterat körning #{b.booking_number}</strong><span>{b.pickup||b.pickup_address} → {b.destination||b.dropoff_address}</span></div><button onClick={()=>onOpen(b)}>Visa körning</button><button aria-label="Stäng acceptmeddelandet" onClick={()=>setNotices(n=>n.filter(x=>x.id!==b.id))}>×</button></div>)}</div>;
}
