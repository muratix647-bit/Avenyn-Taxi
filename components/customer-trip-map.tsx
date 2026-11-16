"use client";
import 'leaflet/dist/leaflet.css';
import {useEffect,useRef,useState} from 'react';
import {LocateFixed} from 'lucide-react';
import {interpolatePosition,animationDuration} from '@/lib/map-position-animation';
import {loadMapEngine,type TrackingMap,type TrackingMarker} from '@/lib/live-map-engine';
type Point={lat:number;lng:number};
type Car=Point&{name?:string};
const valid=<T extends Point>(p:T|undefined):p is T=>!!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=85&&Math.abs(p.lng)<=180;
export default function CustomerTripMap({cars,customerLocation,destinationLocation,stopLocation,routePath=[],driverMode=false,followDriver=false,journeyKey="",bookingMode=false,pickupFocusRequest=0,userLocation,locateRequest=0}:{pickupFocusRequest?:number;bookingMode?:boolean;userLocation?:Point;locateRequest?:number;driverMode?:boolean;followDriver?:boolean;journeyKey?:string;cars:Car[];customerLocation?:Point;destinationLocation?:Point;stopLocation?:Point;routePath?:[number,number][]}) {
 const occlusion=()=>{const workspace=container.current?.closest('.driverWorkView');const panel=workspace?.querySelector('.driverMapOffer')||workspace?.querySelector('.driverTripSheet:not([hidden])');return panel instanceof HTMLElement?panel.clientHeight:0};
 const centerCar=(m:TrackingMap,car:Point)=>{const zoom=m.getZoom();if(driverMode&&m.project&&m.unproject){const pixel=m.project([car.lat,car.lng],zoom);const center=m.unproject([pixel.x,pixel.y+occlusion()/2],zoom);m.setView([center.lat,center.lng],zoom,{animate:false});}else m.setView([car.lat,car.lng],zoom,{animate:false});};
 const pickupFocusPoint=useRef(customerLocation);pickupFocusPoint.current=customerLocation;
 const manualView=useRef(false);const needsDetailZoom=useRef(followDriver);
 const carsRef=useRef(cars);carsRef.current=cars;
 const container=useRef<HTMLDivElement>(null);const map=useRef<TrackingMap|null>(null);const markers=useRef(new Map<string,TrackingMarker>());const fitted=useRef('');
 const lastSample=useRef(new Map<string,number>());
 const carsKey=JSON.stringify(cars),routeKey=JSON.stringify(routePath);
 const animations=useRef(new Map<string,number>());
 const [authError,setAuthError]=useState(false);
 useEffect(()=>{const fail=()=>setAuthError(true);window.addEventListener("avenyn-map-auth-error",fail);return()=>window.removeEventListener("avenyn-map-auth-error",fail);},[]);
 const routeLine=useRef<{remove():void}|null>(null);
 const [followTaxi,setFollowTaxi]=useState(followDriver);
 useEffect(()=>{if(driverMode){manualView.current=false;needsDetailZoom.current=followDriver;setFollowTaxi(followDriver);}},[driverMode,followDriver,journeyKey]);
 const [coveredBottom,setCoveredBottom]=useState(0);
 useEffect(()=>{
  if(!driverMode||!container.current)return;
  const canvas=container.current,workspace=canvas.closest('.driverWorkView');
  const update=()=>{const rect=canvas.getBoundingClientRect();const panel=workspace?.querySelector('.driverMapOffer')||workspace?.querySelector('.driverTripSheet:not([hidden])');const panelRect=panel?.getBoundingClientRect();const covered=panelRect?Math.max(0,Math.min(rect.height-100,rect.bottom-panelRect.top)):0;setCoveredBottom(covered);canvas.closest<HTMLElement>('.driverMapWorkspace')?.style.setProperty('--driver-map-covered-bottom',covered+'px');};
  const resize=new ResizeObserver(update);resize.observe(canvas);workspace?.querySelectorAll('.driverTripSheet,.driverMapOffer').forEach(el=>resize.observe(el));
  const mutation=new MutationObserver(()=>{workspace?.querySelectorAll('.driverTripSheet,.driverMapOffer').forEach(el=>resize.observe(el));update();});
  if(workspace)mutation.observe(workspace,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','open','class']});
  update();return()=>{resize.disconnect();mutation.disconnect();};
 },[driverMode]);
 useEffect(()=>{if(driverMode&&followTaxi){const car=markers.current.get('car-0')?.getLatLng()||carsRef.current.find(valid);if(car&&map.current)centerCar(map.current,car);}},[coveredBottom,driverMode,followTaxi]);
 const [provider,setProvider]=useState("");const [traffic,setTraffic]=useState(false);
 const [ready,setReady]=useState(false);const [error,setError]=useState(false);const [reset,setReset]=useState(0);
 useEffect(()=>{let disposed=false;let resize:ResizeObserver|undefined;let cleanupGestures=()=>{};
  void loadMapEngine(driverMode).then(L=>{if(disposed||!container.current)return;
   const m=L.map(container.current,{zoomControl:false,minZoom:5,maxZoom:19,dragging:true,touchZoom:true,scrollWheelZoom:true}).setView([57.7089,11.9746],driverMode?16:12);
   L.control.zoom({position:'topright'}).addTo(m);
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap-bidragsgivare'}).addTo(m);
   m.on?.('dragstart',()=>{manualView.current=true;setFollowTaxi(false)});
   const manualGesture=()=>{manualView.current=true;needsDetailZoom.current=false;setFollowTaxi(false)};
   container.current.addEventListener('pointerdown',manualGesture,{passive:true});
   container.current.addEventListener('touchstart',manualGesture,{passive:true});
   container.current.addEventListener('wheel',manualGesture,{passive:true});
   const canvas=container.current;cleanupGestures=()=>{canvas.removeEventListener('pointerdown',manualGesture);canvas.removeEventListener('touchstart',manualGesture);canvas.removeEventListener('wheel',manualGesture);};
   map.current=m;setProvider(L.provider);resize=new ResizeObserver(()=>m.invalidateSize({pan:true}));resize.observe(container.current);setReady(true);
  }).catch(()=>{if(!disposed)setError(true);});
  return()=>{disposed=true;cleanupGestures();resize?.disconnect();animations.current.forEach(cancelAnimationFrame);animations.current.clear();markers.current.clear();map.current?.remove();map.current=null;};
 },[]);
 useEffect(()=>{const m=map.current;if(!m||!ready)return;let disposed=false;
  void loadMapEngine(driverMode).then(L=>{if(disposed||map.current!==m)return;
   const points:{key:string;point:Point;label:string;kind:string}[]=[];
   cars.filter(valid).forEach((car,i)=>points.push({key:`car-${i}`,point:car,label:car.name||'Din taxi',kind:'taxi'}));
   if(valid(userLocation))points.push({key:'you',point:userLocation,label:'Du är här',kind:'you'});
   if(valid(customerLocation)&&!(bookingMode&&valid(userLocation)&&Math.abs(customerLocation.lat-userLocation.lat)<0.00001&&Math.abs(customerLocation.lng-userLocation.lng)<0.00001))points.push({key:'pickup',point:customerLocation,label:'Hämtning',kind:'pickup'});
   if(valid(stopLocation))points.push({key:'stop',point:stopLocation,label:'Extra stopp',kind:'stop'});
   if(valid(destinationLocation))points.push({key:'destination',point:destinationLocation,label:'Destination',kind:'destination'});
   const keys=new Set(points.map(p=>p.key));markers.current.forEach((marker,key)=>{if(!keys.has(key)){const frame=animations.current.get(key);if(frame!==undefined)cancelAnimationFrame(frame);animations.current.delete(key);marker.remove();markers.current.delete(key);}});
   points.forEach(({key,point,label,kind})=>{
    const existing=markers.current.get(key);if(existing){
      const previous=animations.current.get(key);if(previous!==undefined)cancelAnimationFrame(previous);animations.current.delete(key);
      const from=existing.getLatLng();
      if((kind!=='taxi'&&kind!=='you')||document.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches){existing.setLatLng([point.lat,point.lng]);return;}
      const started=performance.now();const duration=animationDuration(started-(lastSample.current.get(key)??(started-850)));lastSample.current.set(key,started);
      const move=(now:number)=>{if(disposed)return;const progress=Math.min(1,(now-started)/duration);const next=interpolatePosition(from,point,progress);existing.setLatLng([next.lat,next.lng]);if(followTaxi&&!manualView.current)centerCar(m,next);if(progress<1)animations.current.set(key,requestAnimationFrame(move));else animations.current.delete(key);};
      animations.current.set(key,requestAnimationFrame(move));return;
    }
    const el=document.createElement('div');el.className=`tripGeoMarker ${kind}`;
    const icon=document.createElement('span');icon.textContent=kind==='taxi'?'🚕':kind==='pickup'?'A':kind==='you'?'●':kind==='stop'?'1':'B';el.appendChild(icon);
    const text=document.createElement('b');text.textContent=label;el.appendChild(text);
    const marker=L.marker([point.lat,point.lng],{draggable:false,interactive:!bookingMode,title:label,icon:L.divIcon({className:'tripGeoMarkerHost',html:el,iconSize:[140,62],iconAnchor:[70,44]})}).addTo(m);
    markers.current.set(key,marker);
   });
   const signature=points.map(p=>p.key).join('|')+':'+reset+JSON.stringify([customerLocation,destinationLocation])+':'+routePath.length;
   const taxi=points.find(p=>p.kind==='taxi');
   if(followTaxi&&taxi){if(driverMode){const displayed=markers.current.get(taxi.key)?.getLatLng()||taxi.point;if(needsDetailZoom.current){needsDetailZoom.current=false;m.setView([displayed.lat,displayed.lng],17,{animate:false});}if(!animations.current.has(taxi.key))centerCar(m,displayed);}else {const displayed=markers.current.get(taxi.key)?.getLatLng()||taxi.point;if(needsDetailZoom.current){needsDetailZoom.current=false;m.setView([displayed.lat,displayed.lng],16,{animate:false});}if(!animations.current.has(taxi.key))centerCar(m,displayed);}fitted.current='';}
   else if(!manualView.current&&points.length&&fitted.current!==signature){fitted.current=signature;const height=container.current?.clientHeight||500;const bottom=driverMode?Math.max(0,Math.min(height-120,occlusion()+14)):70;const bounds=L.latLngBounds([...points.map(p=>[p.point.lat,p.point.lng]),...routePath.filter(p=>valid({lat:p[0],lng:p[1]}))]);m.fitBounds(bounds,{paddingTopLeft:[35,90],paddingBottomRight:[35,bottom],maxZoom:15,animate:false});}

  });return()=>{disposed=true;animations.current.forEach(cancelAnimationFrame);animations.current.clear();};
 },[userLocation?.lat,userLocation?.lng,carsKey,customerLocation?.lat,customerLocation?.lng,destinationLocation?.lat,destinationLocation?.lng,stopLocation?.lat,stopLocation?.lng,ready,reset,followTaxi,driverMode,routeKey,followDriver,journeyKey]);
 useEffect(()=>{if(!bookingMode||!ready||!map.current||routePath.length<2)return;let cancelled=false;void loadMapEngine().then(L=>{if(!cancelled&&map.current&&!manualView.current)map.current.fitBounds(L.latLngBounds(routePath),{paddingTopLeft:[35,100],paddingBottomRight:[35,50],maxZoom:16,animate:false});});return()=>{cancelled=true};},[bookingMode,ready,routeKey]);
 useEffect(()=>{if(!ready||!map.current)return;let cancelled=false;void loadMapEngine(driverMode).then(L=>{if(cancelled||!map.current)return;routeLine.current?.remove();routeLine.current=null;const path=routePath.filter(p=>Array.isArray(p)&&valid({lat:p[0],lng:p[1]}));if(path.length>1)routeLine.current=L.polyline(path,{color:'#005cff',weight:7,opacity:1}).addTo(map.current);});return()=>{cancelled=true;routeLine.current?.remove();routeLine.current=null;};},[ready,routePath]);
 // Only an explicit button press focuses pickup; GPS updates leave the viewport alone.
 useEffect(()=>{const point=pickupFocusPoint.current;if(!ready||!map.current||!pickupFocusRequest||!valid(point))return;manualView.current=true;map.current.setView([point.lat,point.lng],17,{animate:false});},[ready,pickupFocusRequest]);
 // Keep the complete booking route visible: live GPS must not zoom back into pickup.
 useEffect(()=>{if(bookingMode&&(valid(destinationLocation)||routePath.length>1))return;if(ready&&map.current&&valid(userLocation)&&locateRequest){manualView.current=true;map.current.setView([userLocation.lat,userLocation.lng],17,{animate:false});}},[ready,locateRequest,userLocation?.lat,userLocation?.lng,bookingMode,destinationLocation?.lat,destinationLocation?.lng,routeKey]);
 return <>{!driverMode&&!bookingMode&&<div className="mapModeControls">{provider==="google"&&<button type="button" aria-pressed={traffic} onClick={()=>{setTraffic(!traffic);map.current?.setTraffic?.(!traffic);}}>Trafik {traffic?"på":"av"}</button>}<span>{followTaxi&&cars.length?"Följer din taxi":"Översikt över resan"}</span></div>}<div className="liveMap customerGeoMap"><div ref={container} className="customerGeoCanvas" role="region" aria-label="Karta över din taxi, hämtning och destination"/>
  {authError&&<div className="customerGeoLoading" role="alert">Kartan kunde inte öppnas. Resans uppgifter finns under Resa.</div>}
  {!ready&&<div className="customerGeoLoading">{error?'Kartan kunde inte laddas. Ladda om sidan.':'Laddar din reskarta…'}</div>}
  {driverMode&&<button type="button" className="driverLocatePosition" style={{bottom:coveredBottom+24}} disabled={!ready||!cars.some(valid)} aria-label="Hitta min position och följ bilen" aria-pressed={followTaxi} title={cars.some(valid)?"Hitta min position":"Väntar på GPS-position"} onClick={()=>{manualView.current=false;needsDetailZoom.current=!driverMode;setFollowTaxi(true);setReset(v=>v+1);}}><LocateFixed aria-hidden="true"/></button>}
  {!bookingMode&&(!driverMode||followDriver)&&<button type="button" className="mapResetView" onClick={()=>{manualView.current=false;needsDetailZoom.current=!followTaxi;setFollowTaxi(!followTaxi);setReset(v=>v+1);}}>{cars.length?(followTaxi?"Visa hela resan":"Följ bilen"):"Visa A och B"}</button>}
  {!driverMode&&!bookingMode&&<div className="customerGeoLegend">🚕 Din taxi · A Hämtning · B Destination</div>}
 </div></>;
}
