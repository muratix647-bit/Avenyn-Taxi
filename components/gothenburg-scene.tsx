"use client";
import {useEffect,useRef,useState} from "react";
import {Pause,Play} from "lucide-react";
export default function GothenburgScene({english=false}:{english?:boolean}) {
 const video=useRef<HTMLVideoElement>(null);
 const [paused,setPaused]=useState(false),[allowed,setAllowed]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{const media=window.matchMedia("(prefers-reduced-motion: reduce)");const update=()=>setAllowed(!media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
 useEffect(()=>{const el=video.current;if(!el||!allowed||failed)return;
 let visible=false;const sync=()=>{if(visible&&!paused&&!document.hidden)el.play().catch(()=>{});else el.pause();};
 const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();},{threshold:.15});observer.observe(el);document.addEventListener("visibilitychange",sync);
 return()=>{observer.disconnect();document.removeEventListener("visibilitychange",sync);el.pause();};
 },[allowed,paused,failed]);
 return <div className="gothenburgScene gothenburgScene--video">
  <img src="/gothenburg-karlatornet-aerial.webp" alt={english?"Generated aerial view inspired by Gothenburg, with Karlatornet and the river":"Genererad flygvy inspirerad av Göteborg med Karlatornet och Göta älv"} width="1600" height="900" loading="eager" decoding="async"/>
  {allowed&&!failed&&<video ref={video} className="gothenburgSceneVideo" loop muted playsInline preload="none" poster="/gothenburg-karlatornet-aerial.webp" aria-hidden="true" onError={()=>setFailed(true)}><source src="/gothenburg-karlatornet-loop.mp4" type="video/mp4"/></video>}
  <div className="gothenburgSceneShade"/>
  <div className="gothenburgSceneCaption"><span>{english?"GOTHENBURG · KARLATORNET":"GÖTEBORG · KARLATORNET"}</span><b>{english?"Your journey starts here.":"Din resa börjar här."}</b><small>{english?"Generated city view":"Genererad stadsvy"}</small></div>
  {allowed&&!failed&&<button type="button" className="sceneMotionToggle" aria-pressed={paused} aria-label={paused?(english?"Play video":"Spela video"):(english?"Pause video":"Pausa video")} onClick={()=>setPaused(!paused)}>{paused?<Play/>:<Pause/>}</button>}
 </div>;
}
