'use client';
import {useEffect,useState} from 'react';
import CustomerTripMap from './customer-trip-map';
import {AppText} from './app-language';
const point=(lat:any,lng:any)=>lat!=null&&lng!=null&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))?{lat:Number(lat),lng:Number(lng)}:undefined;
export default function DriverRoutePreview({trip,accessToken}:{trip:any;accessToken:string}){
 const [route,setRoute]=useState<any>(null);
 useEffect(()=>{const c=new AbortController();setRoute(null);fetch('/api/driver-trips/route-preview?bookingId='+encodeURIComponent(trip.id),{headers:{Authorization:`Bearer ${accessToken}`},signal:c.signal,cache:'no-store'}).then(r=>r.json()).then(j=>{if(!c.signal.aborted)setRoute(j)}).catch(()=>{if(!c.signal.aborted)setRoute({state:'unavailable'})});return()=>c.abort()},[trip.id,accessToken]);
 return <div className="driverRoutePreview"><CustomerTripMap cars={[]} customerLocation={point(trip.pickup_lat,trip.pickup_lng)} destinationLocation={point(trip.dropoff_lat,trip.dropoff_lng)} routePath={route?.path||[]}/><small role="status">{route?.state==='ready'?`${route.kilometers.toFixed(1)} km · ca ${route.minutes} min`:<AppText text={route?'Vägrutten kunde inte hämtas. Hämtning och destination visas.':'Hämtar väg från A till B…'}/>}</small></div>
}

export function DriverTripRoute({trip,accessToken}:{trip:any;accessToken:string}){const [open,setOpen]=useState(false);return <details className="driverTripRoute" onToggle={e=>setOpen(e.currentTarget.open)}><summary><AppText text="Visa rutt A → B"/></summary>{open&&<DriverRoutePreview trip={trip} accessToken={accessToken}/>}</details>}
