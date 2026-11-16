"use client";
import {useEffect,useState} from 'react';
import {loadMapEngine} from './live-map-engine';
type Point={lat?:number;lng?:number};
export type CustomerRoute={path:[number,number][];minutes:number;kilometers:number;trafficAvailable:boolean;delayMinutes?:number;future?:boolean};
const withTimeout=<T,>(promise:Promise<T>,ms:number)=>new Promise<T>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('route timeout')),ms);promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
const valid=(p:Point)=>Number.isFinite(p.lat)&&Number.isFinite(p.lng);
export function useCustomerRoute(enabled:boolean,from:Point,to:Point,stop:Point|undefined,time:string){
 const [route,setRoute]=useState<CustomerRoute|null>(null),[loading,setLoading]=useState(false),[failed,setFailed]=useState(false);
 const key=JSON.stringify([from.lat,from.lng,to.lat,to.lng,stop?.lat,stop?.lng,time]);
 useEffect(()=>{
  setRoute(null);setFailed(false);setLoading(false);
  if(!enabled||!valid(from)||!valid(to)||(stop&&!valid(stop)))return;
  let disposed=false;const controller=new AbortController();
  const timer=setTimeout(()=>{setLoading(true);void(async()=>{
   const points=[from,...(stop?[stop]:[]),to];
   try{
    const engine=await loadMapEngine();
    if(engine.provider==='google'){
     try{
      const g=(window as any).google.maps;const {Route}=await g.importLibrary('routes');
      const date=time&&time!=='now'?new Date(time):new Date();const future=date.getTime()>Date.now()+300000;
      const result:any=await withTimeout(Route.computeRoutes({origin:{lat:from.lat,lng:from.lng},destination:{lat:to.lat,lng:to.lng},intermediates:stop?[{location:{lat:stop.lat,lng:stop.lng}}]:[],travelMode:'DRIVING',routingPreference:'TRAFFIC_AWARE',departureTime:date.getTime()>Date.now()?date:new Date(),fields:['path','durationMillis','staticDurationMillis','distanceMeters']}),6500);
      const r=result.routes?.[0];
      if(r?.path?.length>1&&Number.isFinite(r.durationMillis)&&Number.isFinite(r.distanceMeters)){
       if(!disposed)setRoute({path:r.path.map((p:any)=>[typeof p.lat==='function'?p.lat():p.lat,typeof p.lng==='function'?p.lng():p.lng]),minutes:Math.ceil(r.durationMillis/60000),kilometers:r.distanceMeters/1000,trafficAvailable:Number.isFinite(r.staticDurationMillis),delayMinutes:Number.isFinite(r.staticDurationMillis)?Math.max(0,Math.round((r.durationMillis-r.staticDurationMillis)/60000)):undefined,future});return;
      }
     }catch{/* Show a road route even when the traffic service is unavailable. */}
    }
    if(disposed)return;
    const response=await fetch('/api/customer-route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points:points.map(p=>[p.lng,p.lat])}),signal:controller.signal});
    const r:any=await response.json();if(!response.ok||r.state!=='ready')throw Error('route');
    if(!disposed)setRoute(r);
   }catch{if(!disposed)setFailed(true);}finally{if(!disposed)setLoading(false);}
  })();},350);
  return()=>{disposed=true;clearTimeout(timer);controller.abort();};
 },[enabled,key]);
 return {route,loading,failed};
}
