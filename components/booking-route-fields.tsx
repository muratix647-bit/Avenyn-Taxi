"use client";
import {createAddressSearch,resolveAddress,warmAddressSearch,knownAddresses} from "@/lib/address-search";
import {cachedAddresses,rememberAddresses,matchingCachedAddresses} from "@/lib/address-suggestions-cache";

import {useEffect,useState,useId,useRef} from "react";
import {MapPin,LocateFixed,CirclePlus,X,ArrowUpDown} from "lucide-react";
export type RoutePlace={label:string;id?:string;lat?:number;lng?:number;area?:string;components?:Record<string,string>;primary?:string;secondary?:string};
function PlaceField({label,value,onChange}:{label:string;value:RoutePlace;onChange:(p:RoutePlace)=>void}) {
 const listId=useId();
 const search=useRef(createAddressSearch()),generation=useRef(0);
 useEffect(()=>{void warmAddressSearch().catch(()=>{});},[]);
 const [hits,setHits]=useState<RoutePlace[]>([]),[show,setShow]=useState(false),[loading,setLoading]=useState(false),[message,setMessage]=useState(""),[retry,setRetry]=useState(0),[active,setActive]=useState(0);
 useEffect(()=>{
  const requestGeneration=++generation.current;
  setHits([]);setMessage("");setLoading(false);
  if(Number.isFinite(value.lat)&&Number.isFinite(value.lng)||value.label.trim().length<2)return;
  const cached=cachedAddresses(value.label);
  if(cached){setHits(cached);setActive(0);setShow(true);return;}
  setHits([...knownAddresses(value.label),...matchingCachedAddresses(value.label)]);
  const c=new AbortController();setLoading(true);setShow(true);
  const timer=setTimeout(async()=>{
   try {
    const result=await search.current(value.label.trim(),c.signal);if(c.signal.aborted||requestGeneration!==generation.current)return;
    const places=Array.isArray(result)?result:[];rememberAddresses(value.label,places);setHits(places);setActive(0);
    if(!places.length)setMessage("Inga förslag hittades. Prova gatunamn och ort.");
   }catch{if(!c.signal.aborted&&requestGeneration===generation.current)setMessage("Adressökningen svarar inte. Försök igen.");}
   finally{if(!c.signal.aborted&&requestGeneration===generation.current)setLoading(false);}
  },150);
  return()=>{clearTimeout(timer);c.abort()};
 },[value.label,value.lat,value.lng,retry]);
 const choose=async(p:RoutePlace)=>{const current=++generation.current;setLoading(true);try{const resolved=await resolveAddress(p);if(current!==generation.current)return;onChange(resolved);setShow(false);setHits([])}catch{if(current===generation.current)setMessage("Adressen kunde inte hämtas. Välj igen.")}finally{if(current===generation.current)setLoading(false)}};
 return <div className="unifiedPlace"><label><span>{label}</span><div><MapPin/><input value={value.label} placeholder="Skriv adress eller område" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={show} aria-controls={listId} onFocus={()=>setShow(true)} onBlur={()=>setTimeout(()=>setShow(false),150)} onChange={e=>onChange({label:e.target.value})} onKeyDown={e=>{if(e.key==="Escape")setShow(false);if(!show||!hits.length)return;if(e.key==="ArrowDown"){e.preventDefault();setActive(i=>Math.min(i+1,hits.length-1))}if(e.key==="ArrowUp"){e.preventDefault();setActive(i=>Math.max(0,i-1))}if(e.key==="Enter"){e.preventDefault();choose(hits[active])}}}/></div></label>
 {show&&(loading||message||hits.length>0)&&<div className="unifiedSuggestions" id={listId}>
 {loading&&<div className="unifiedSearchStatus" role="status">Söker adresser…</div>}
 {message&&<div className="unifiedSearchStatus" role="status">{message}<button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>setRetry(i=>i+1)}>Försök igen</button></div>}
 {hits.some(p=>p.id?.startsWith("google:"))&&<div className="unifiedSearchStatus">Google Maps</div>}
 {hits.map((p,i)=><button type="button" key={p.id||i} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(p)} className={active===i?"active":""}><MapPin/><span><b>{p.primary||p.label}</b>{p.secondary&&<small>{p.secondary}</small>}</span></button>)}
 </div>}</div>;
}
export default function BookingRouteFields({pickup,destination,stop,onChange}:{pickup:RoutePlace;destination:RoutePlace;stop:RoutePlace|null;onChange:(r:{pickup:RoutePlace;destination:RoutePlace;stop:RoutePlace|null})=>void}) {
 const [error,setError]=useState(""),[locating,setLocating]=useState(false);
 const latest=useRef({pickup,destination,stop,onChange});latest.current={pickup,destination,stop,onChange};
 const change=(v:Partial<{pickup:RoutePlace;destination:RoutePlace;stop:RoutePlace|null}>)=>{const r=latest.current;r.onChange({pickup:r.pickup,destination:r.destination,stop:r.stop,...v})};
 const locate=()=>{
  setError("");if(!navigator.geolocation){setError("Position är inte tillgänglig.");return;}
  setLocating(true);const startingLabel=pickup.label;
  navigator.geolocation.getCurrentPosition(async p=>{
   try{const r=await fetch(`/api/addresses?v=2&lat=${p.coords.latitude}&lng=${p.coords.longitude}`,{cache:"no-store"});const result:any=await r.json();if(!r.ok||!result.label)throw Error();if(latest.current.pickup.label===startingLabel)change({pickup:{...result,lat:p.coords.latitude,lng:p.coords.longitude}})}
   catch{setError("Positionen hittades men adressen kunde inte hämtas. Försök igen eller skriv adressen.")}
   finally{setLocating(false)}
  },e=>{setLocating(false);setError(e.code===1?"Tillåt platsåtkomst i webbläsaren och försök igen.":"Position kunde inte hämtas. Kontrollera GPS och försök igen.")},{enableHighAccuracy:true,timeout:15000,maximumAge:10000});
 };
 return <section className="unifiedBookingRoute wide" aria-label="Resans adresser"><div className="unifiedRouteTools"><button type="button" onClick={locate} disabled={locating} aria-busy={locating}><LocateFixed/>{locating?"Hämtar position…":"Hämta min position"}</button><button type="button" onClick={()=>change({pickup:destination,destination:pickup})}><ArrowUpDown/>Byt riktning</button></div><PlaceField label="Varifrån åker du?" value={pickup} onChange={pickup=>change({pickup})}/>{stop&&<><PlaceField label="Extra stopp" value={stop} onChange={stop=>change({stop})}/><button type="button" className="unifiedSwap" onClick={()=>change({pickup:stop,stop:pickup})}><ArrowUpDown/>Byt plats på hämtadress och stopp</button></>}<button type="button" className="unifiedAddStop" onClick={()=>change({stop:stop?null:{label:""}})}>{stop?<X/>:<CirclePlus/>}{stop?"Ta bort extra stopp":"Lägg till stopp"}</button><PlaceField label="Vart ska du?" value={destination} onChange={destination=>change({destination})}/>{error&&<p role="alert">{error}</p>}</section>;
}
