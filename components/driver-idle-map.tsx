'use client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {useEffect,useRef,useState} from 'react';
import type {Map as LibreMap,Marker} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import {LocateFixed,Settings2,Plus,Minus,X} from 'lucide-react';
import {animationDuration,interpolatePosition,travelBearing,interpolateBearing} from '@/lib/map-position-animation';
import DriverAudioSettings from './driver-audio-settings';
import {alarmVolume,DRIVER_ALARM_VOLUME_KEY} from '@/lib/driver-alarm-volume';
import LiveMap from './customer-trip-map';
type Point={lat:number;lng:number;name?:string};
const valid=(p:Point|undefined):p is Point=>!!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=85&&Math.abs(p.lng)<=180;
const styles={light:'https://tiles.openfreemap.org/styles/liberty',dark:'/maps/avenyn-night.json'};
export default function DriverIdleMap({position}:{position?:Point}){
 const host=useRef<HTMLDivElement>(null),map=useRef<LibreMap|null>(null),marker=useRef<Marker|null>(null),frame=useRef(0),lastSample=useRef(0),follow=useRef(true),latest=useRef(position);
 const cameraPosition=useRef<Point|undefined>(position),heading=useRef(0),headingAnchor=useRef<Point|undefined>(position);
 latest.current=position;
 const [menu,setMenu]=useState(false),[tab,setTab]=useState('map'),[volume,setVolume]=useState(70);
 useEffect(()=>{const open=()=>{setTab('map');setMenu(true)};window.addEventListener('avenyn-open-map-settings',open);return()=>window.removeEventListener('avenyn-open-map-settings',open)},[]);
 useEffect(()=>{try{setVolume(alarmVolume(localStorage.getItem(DRIVER_ALARM_VOLUME_KEY)))}catch{}},[]);
 const changeVolume=(n:number)=>{setVolume(n);try{localStorage.setItem(DRIVER_ALARM_VOLUME_KEY,String(n))}catch{}};
 const manual=()=>{follow.current=false;setFollowing(false)};
 const [ready,setReady]=useState(false),[failed,setFailed]=useState(false),[following,setFollowing]=useState(true),[covered,setCovered]=useState(0),[theme,setTheme]=useState('auto'),[dark,setDark]=useState(false),[tilted,setTilted]=useState(false);
 useEffect(()=>{try{const saved=localStorage.getItem('avenyn-driver-map-theme');if(['auto','light','dark'].includes(saved||''))setTheme(saved!);}catch{}},[]);
 useEffect(()=>{const query=matchMedia('(prefers-color-scheme: dark)');const update=()=>setDark(theme==='dark'||(theme==='auto'&&query.matches));update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[theme]);
 useEffect(()=>{
  const el=host.current,workspace=el?.closest('.driverWorkView');if(!el||!workspace)return;
  const update=()=>{const rect=el.getBoundingClientRect(),sheet=workspace.querySelector('.driverTripSheet:not([hidden])')?.getBoundingClientRect();const bottom=sheet?Math.max(0,Math.min(rect.height-120,rect.bottom-sheet.top)):0;setCovered(bottom);el.closest<HTMLElement>('.driverMapWorkspace')?.style.setProperty('--driver-map-covered-bottom',bottom+'px');};
  const ro=new ResizeObserver(update);ro.observe(el);workspace.querySelectorAll('.driverTripSheet').forEach(n=>ro.observe(n));
  const mo=new MutationObserver(update);mo.observe(workspace,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','open']});update();return()=>{ro.disconnect();mo.disconnect();};
 },[]);
 useEffect(()=>{
  if(failed)return;
  let disposed=false;let resize:ResizeObserver|undefined;let timer:ReturnType<typeof setTimeout>=setTimeout(()=>{if(!disposed)setFailed(true)},15000);
  void import('maplibre-gl').then(gl=>{
   if(disposed||!host.current)return;gl.setWorkerUrl(workerUrl);
   const canvas=host.current.querySelector<HTMLElement>('.driverLibreCanvas')!;
   const p=latest.current;
   const m=new gl.Map({container:canvas,style:styles.light,center:valid(p)?[p.lng,p.lat]:[11.9746,57.7089],zoom:12,pitch:0,maxPitch:60,minZoom:5,maxZoom:19,attributionControl:false});map.current=m;

   m.addControl(new gl.AttributionControl({compact:true}),'bottom-right');
   // Constrain the camera before rendering: pinch/wheel zoom keeps its zoom,
   // while GPS remains the center and travel heading remains the orientation.
   m.setTransformCameraUpdate(()=>{const p=cameraPosition.current;return {...(valid(p)?{center:new gl.LngLat(p.lng,p.lat)}:{}),...(follow.current?{bearing:heading.current}:{})};});
   m.dragPan.disable();m.dragRotate.disable();m.touchZoomRotate.disableRotation();
   m.on('zoomend',()=>{const p=cameraPosition.current;if(valid(p))m.jumpTo({center:[p.lng,p.lat]});});
   m.on('load',()=>{if(disposed)return;clearTimeout(timer);setReady(true);});
   m.on('error',()=>{if(!disposed&&!m.isStyleLoaded()){clearTimeout(timer);setFailed(true);}});
   m.getCanvas().addEventListener('webglcontextlost',()=>{if(!disposed)setFailed(true);});
   
   resize=new ResizeObserver(()=>m.resize());resize.observe(canvas);
  }).catch(()=>{if(!disposed)setFailed(true);});
  return()=>{disposed=true;clearTimeout(timer);resize?.disconnect();cancelAnimationFrame(frame.current);marker.current?.remove();marker.current=null;map.current?.remove();map.current=null;};
 },[failed]);
 useEffect(()=>{if(ready&&!failed)map.current?.setStyle(dark?styles.dark:styles.light);},[ready,dark,failed]);
 useEffect(()=>{if(ready)map.current?.easeTo({pitch:tilted?45:0,duration:300});},[ready,tilted]);
 useEffect(()=>{
  const m=map.current;if(!ready||failed||!m||!valid(position))return;
  let cancelled=false;cancelAnimationFrame(frame.current);
  void import('maplibre-gl').then(gl=>{
   if(cancelled||map.current!==m)return;
   if(!marker.current){const el=document.createElement('div');el.className='driverLibreCar';el.setAttribute('role','img');el.setAttribute('aria-label','Din taxis position');el.innerHTML='<svg width="34" height="42" viewBox="0 0 34 42" aria-hidden="true"><path d="M17 0 11 7h12z" fill="#006e95"/><rect x="7" y="10" width="20" height="30" rx="6" fill="#006e95"/><path d="M11 15h12l1 7H10z" fill="white"/><path d="M11 32h12v4H11z" fill="white"/></svg>';marker.current=new gl.Marker({element:el,rotationAlignment:'map',pitchAlignment:'map'}).setLngLat([position.lng,position.lat]).addTo(m);if(follow.current)m.jumpTo({center:[position.lng,position.lat],zoom:12});}
   const nextHeading=headingAnchor.current?travelBearing(headingAnchor.current,position):null;if(nextHeading!==null)headingAnchor.current=position;else if(!headingAnchor.current||Math.abs(position.lat-headingAnchor.current.lat)>.01||Math.abs(position.lng-headingAnchor.current.lng)>.02)headingAnchor.current=position;const fromHeading=heading.current,toHeading=nextHeading??fromHeading;
   const start=marker.current.getLngLat(),from={lat:start.lat,lng:start.lng},now=performance.now(),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:animationDuration(lastSample.current?now-lastSample.current:850);lastSample.current=now;
   const animate=(time:number)=>{if(cancelled||!marker.current)return;const t=duration?Math.min(1,(time-now)/duration):1,p=interpolatePosition(from,position,t);cameraPosition.current=p;heading.current=interpolateBearing(fromHeading,toHeading,t);marker.current.setLngLat([p.lng,p.lat]).setRotation(heading.current);if(!m.isZooming())m.jumpTo({center:[p.lng,p.lat],...(follow.current?{bearing:heading.current}:{})});if(t<1)frame.current=requestAnimationFrame(animate);};frame.current=requestAnimationFrame(animate);
  });return()=>{cancelled=true;cancelAnimationFrame(frame.current);};
 },[ready,failed,position?.lat,position?.lng]);
 const recenter=()=>{const p=latest.current;if(!valid(p))return;follow.current=true;setFollowing(true);cameraPosition.current=p;map.current?.jumpTo({center:[p.lng,p.lat],zoom:17});};
 return <div ref={host} className="driverLibre" style={{'--libre-covered':covered+'px'} as React.CSSProperties}>
  {failed?<><LiveMap driverMode followDriver cars={valid(position)?[position]:[]}/><small className="driverLibreFallback">Reservkarta visas · <button onClick={()=>{setReady(false);setFailed(false)}}>Försök igen</button></small></>:<><div className="driverLibreCanvas" style={{position:"absolute",top:0,left:0,right:0,bottom:covered,minHeight:120}} aria-label="Förarkarta med MapLibre"/>
 {menu&&<section className="driverMapMenu" aria-label="Kartinställningar" onKeyDown={e=>{if(e.key==='Escape')setMenu(false)}}><header><b>Karta och ljud</b><button aria-label="Stäng inställningar" onClick={()=>setMenu(false)}><X/></button></header><div className="driverMapMenuTabs"><button aria-pressed={tab==='map'} onClick={()=>setTab('map')}>Karta</button><button aria-pressed={tab==='audio'} onClick={()=>setTab('audio')}>Ljud</button></div>
 {tab==='map'?<><label>Utseende<select value={theme} onChange={e=>{setTheme(e.target.value);try{localStorage.setItem('avenyn-driver-map-theme',e.target.value)}catch{}}}><option value="auto">Automatiskt</option><option value="light">Ljust</option><option value="dark">Mörkt</option></select></label><div className="driverMapMenuTabs"><button aria-pressed={!tilted} onClick={()=>setTilted(false)}>2D</button><button aria-pressed={tilted} onClick={()=>setTilted(true)}>Lutad vy</button><button onClick={()=>{const p=latest.current;map.current?.jumpTo({zoom:12,...(valid(p)?{center:[p.lng,p.lat] as [number,number]}:{})});}}>Överblick</button></div><button aria-pressed={following} onClick={()=>{follow.current=true;setFollowing(true);map.current?.jumpTo({bearing:heading.current})}}>Följ färdriktningen</button><p>Fast riktning uppåt på kartan</p><div className="driverMapDirections">{[['Nord',0],['Öst',90],['Syd',180],['Väst',270]].map(([label,bearing])=><button key={label} onClick={()=>{manual();map.current?.jumpTo({bearing:Number(bearing)})}}>{label}</button>)}</div></>:<><label>Bokningslarm · {volume}%<input aria-label="Volym för bokningslarm" type="range" min="0" max="100" step="5" value={volume} onChange={e=>changeVolume(Number(e.target.value))}/></label><button onClick={()=>changeVolume(volume?0:70)}>{volume?'Stäng av bokningsljud':'Slå på bokningsljud'}</button><p>Larmet behöver aktiveras med Aktivera bokningslarm. Telefonens medievolym påverkar också ljudstyrkan.</p><DriverAudioSettings/></>}
 </section>}
 <div className="driverLibreZoom"><button aria-label="Zooma in" onClick={()=>{const m=map.current;if(m)m.jumpTo({zoom:Math.min(19,m.getZoom()+1)})}}><Plus/></button><button aria-label="Zooma ut" onClick={()=>{const m=map.current;if(m)m.jumpTo({zoom:Math.max(5,m.getZoom()-1)})}}><Minus/></button></div><button className="driverLibreLocate" title="Min position" aria-label="Centrera på min position" aria-pressed={following} disabled={!valid(position)} onClick={recenter}><LocateFixed/></button></>}

 </div>;
}
