'use client';
import {useEffect,useRef,useState} from 'react';
import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';
import {navigationRoute} from '@/lib/driver-navigation';
import {nativeMapMode} from '@/lib/driver-native-map-mode';


const Navigation=registerPlugin<{
 capabilities():Promise<{embedded:boolean;idleMap?:boolean}>;
 showEmbedded(options:{idle?:boolean;waypoints:{lat:number;lng:number;title:string}[]}):Promise<void>;
 updateEmbeddedBounds(options:{visible:boolean;x?:number;y?:number;width?:number;height?:number;viewportWidth?:number;online?:boolean;earnings?:string}):Promise<void>;
 closeEmbedded():Promise<void>;
 continueEmbeddedStop():Promise<void>;
 addListener(name:'embeddedNavigation',callback:(event:{state:string;intermediateStop:boolean;action?:string})=>void):Promise<PluginListenerHandle>;
}>('AvenynNavigation');

/** Older installed apps have no capabilities method: never call their full-screen start(). */
export default function DriverEmbeddedNavigation({trip,phase,visible,online,revenue}:{trip?:any;phase:'pickup'|'destination'|null;visible:boolean;online:boolean;revenue:number}){
 const host=useRef<HTMLDivElement>(null);
 const [supported,setSupported]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[atStop,setAtStop]=useState(false);
 const [idleSupported,setIdleSupported]=useState(false);
 const currentDisplay=useRef({online,revenue});currentDisplay.current={online,revenue};
 const isVisible=useRef(visible);isVisible.current=visible;
 const queue=useRef<Promise<unknown>>(Promise.resolve());
 const atStopRef=useRef(atStop);atStopRef.current=atStop;
 const waypoints=trip&&phase?navigationRoute(trip,phase==='destination').nativePoints:null;
 const mode=nativeMapMode(!!trip,!!waypoints,visible,idleSupported);
 const routeKey=waypoints?JSON.stringify({id:trip.id,phase,waypoints}):mode==='idle'?JSON.stringify({idle:true,waypoints:[]}):'';
 useEffect(()=>{
  if(Capacitor.getPlatform()!=='android'||!Capacitor.isPluginAvailable('AvenynNavigation'))return;
  let alive=true;
  void Navigation.capabilities().then(c=>{if(alive){setSupported(c.embedded===true);setIdleSupported(c.idleMap===true)}}).catch(()=>{});
  return()=>{alive=false};
 },[]);
 useEffect(()=>{
  if(!supported)return;
  let alive=true;let listener:PluginListenerHandle|undefined;
  void Navigation.addListener('embeddedNavigation',event=>{if(alive){
   if(event.action){
    const selectors:Record<string,string>={history:'.driverMapTop button:first-child',online:'.driverMapTop button:last-child',payments:'.driverMapTools button:first-child',more:'.driverMapTools button:last-child'};
    const selector=selectors[event.action];if(selector)host.current?.parentElement?.querySelector<HTMLButtonElement>(selector)?.click();
   }else setAtStop(event.intermediateStop);
  }}).then(l=>{if(alive)listener=l;else void l.remove()});
  return()=>{alive=false;void listener?.remove()};
 },[supported]);
 useEffect(()=>{
  if(!supported)return;
  let alive=true;setReady(false);setAtStop(false);setError('');
  queue.current=queue.current.catch(()=>{}).then(async()=>{
   if(!alive)return;
   if(!routeKey){await Navigation.closeEmbedded();return;}
   try{
    await Navigation.showEmbedded({waypoints:JSON.parse(routeKey).waypoints,idle:!!JSON.parse(routeKey).idle});
    if(alive)setReady(true);
   }catch{if(alive)setError('Bilnavigationen kunde inte starta. Vanliga kartan visas.');}
  });
  return()=>{
   alive=false;
   // Hide immediately; serialize teardown with a route request still awaiting Google.
   void Navigation.updateEmbeddedBounds({visible:false}).catch(()=>{});
   queue.current=queue.current.catch(()=>{}).then(()=>Navigation.closeEmbedded());
  };
 },[supported,routeKey]);
 useEffect(()=>{
  if(!supported||!ready)return;
  let last='';let disposed=false;let inFlight=false;
  const sync=async()=>{
   if(disposed||inFlight)return;
   const el=host.current,workspace=el?.parentElement,shell=workspace?.closest('.driverShell');
   const rect=workspace?.getBoundingClientRect();
   const sheet=shell?.querySelector('.driverTripSheet:not([hidden])')?.getBoundingClientRect();
   let show=isVisible.current&&document.visibilityState==='visible'&&!!rect&&rect.width>0;
   const mapBottom=rect?Math.min(rect.bottom,sheet?.top??rect.bottom,window.innerHeight):0;
   const bottom=mapBottom-(atStopRef.current?56:0);
   if(el&&rect)el.style.setProperty('--embedded-controls-bottom',Math.max(0,rect.bottom-mapBottom)+'px');
   if(rect){
    // A payment/call/dialog overlay must always take priority over the native surface.
    const topElement=document.elementFromPoint(rect.left+rect.width/2,rect.top+Math.max(1,(bottom-rect.top)/2));
    if(!topElement||!workspace?.contains(topElement)||bottom-rect.top<140)show=false;
   }
   const bounds={visible:show,x:rect?.left??0,y:Math.max(0,rect?.top??0),width:rect?.width??0,height:Math.max(0,bottom-Math.max(0,rect?.top??0)),viewportWidth:window.innerWidth,online:currentDisplay.current.online,earnings:Number(currentDisplay.current.revenue||0).toLocaleString('sv-SE',{style:'currency',currency:'SEK'})};
   const signature=JSON.stringify(bounds);if(signature===last)return;
   inFlight=true;
   try{await Navigation.updateEmbeddedBounds(bounds);last=signature;}catch{}finally{inFlight=false;}
  };
  void sync();const timer=setInterval(()=>void sync(),150);
  return()=>{disposed=true;clearInterval(timer);void Navigation.updateEmbeddedBounds({visible:false}).catch(()=>{});};
 },[supported,ready,visible,atStop]);
 if(!supported)return null;
 return <div ref={host} className="driverEmbeddedNavigation" aria-live="polite">
  {error&&<small className="driverMapNotice">{error}</small>}
  {ready&&atStop&&visible&&<button className="driverEmbeddedNextStop" onClick={()=>void Navigation.continueEmbeddedStop().then(()=>setAtStop(false)).catch(()=>setError('Kunde inte fortsätta från stoppet. Försök igen.'))}>Fortsätt från stopp</button>}
 </div>;
}
