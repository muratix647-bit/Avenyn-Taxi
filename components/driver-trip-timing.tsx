'use client';
import {useEffect,useState} from 'react';
import DriverPickupTime from './driver-pickup-time';
import {pickupAt} from '@/lib/prebooking-watch';
export default function DriverTripTiming({trip}:{trip:any}){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer)},[]);
 const at=pickupAt(trip),minutes=Math.ceil((at-now)/60000),waiting=trip.status==='accepted';
 const urgent=waiting&&minutes<=15,soon=waiting&&minutes<=30;
 const clock=(time:number)=>new Date(time).toLocaleTimeString('sv-SE',{timeZone:'Europe/Stockholm',hour:'2-digit',minute:'2-digit'});
 return <div className={`driverTripTiming ${urgent?'isUrgent':soon?'isSoon':''}`}>
  <DriverPickupTime trip={trip}/>
  {waiting&&Number.isFinite(at)&&<div className="driverTimingReminder" role={soon?'status':undefined}>
   <strong>{minutes<0?'Hämtningstiden har passerat':minutes===0?'Hämtning nu':soon?`Hämtning om ${minutes} min`:'Påminnelser'}</strong>
   <span>{soon?'Inte på väg – tryck START när du åker':`${clock(at-30*60000)} och ${clock(at-15*60000)} · svensk tid`}</span>
  </div>}
 </div>;
}
