"use client";
import {useEffect,useRef,useState} from "react";

const films=["gothenburg-coast-vivid","liseberg-rabalder-background"];
export default function NightlifeBackdrop({playbackEnabled=true,hideControls=false,repeat=false}:{playbackEnabled?:boolean;hideControls?:boolean;repeat?:boolean}={}) {
  const video=useRef<HTMLVideoElement>(null);
  const [paused,setPaused]=useState(true);
  const [mobile,setMobile]=useState<boolean>();
  const [clip,setClip]=useState(0);
  const [failed,setFailed]=useState(false);
  const [finished,setFinished]=useState(false);
  const source=mobile===undefined?undefined:`/${films[clip]}${mobile?"-mobile":""}.mp4`;
  useEffect(()=>{
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setPaused(preference.matches||!playbackEnabled);
    setMobile(window.matchMedia('(max-width: 760px)').matches);
    update();preference.addEventListener('change',update);
    return ()=>preference.removeEventListener('change',update);
  },[playbackEnabled]);
  useEffect(()=>{
    const element=video.current;
    if(!element||!source||failed)return;
    if(paused)element.pause();
    else {element.muted=true;void element.play().catch(()=>setPaused(true));}
  },[paused,source,failed]);
  return <div className="coastCinema">
    <div className="nightlifeScenery nightlifeVideo" aria-hidden="true">
      {failed||!source?<img src="/gothenburg-coast-vivid-poster.webp" alt="" width="1920" height="804" fetchPriority="high"/>:
      <video ref={video} src={source} poster="/gothenburg-coast-vivid-poster.webp" muted playsInline autoPlay={!paused} preload="metadata" onEnded={()=>{if(clip<films.length-1)setClip(clip+1);else if(repeat){setClip(0);}else {if(video.current)video.current.currentTime=20;setFinished(true);setPaused(true);}}} disablePictureInPicture onError={()=>setFailed(true)} />}
      <div className="nightlifeShade" />
    </div>
    {!failed&&!hideControls&&<button className="nightlifeMotion" type="button" aria-label={paused?'Spela bakgrundsvideo':'Pausa bakgrundsvideo'} aria-pressed={!paused} onClick={()=>{if(paused&&finished){setClip(0);setFinished(false);}setPaused(!paused);}}>{paused?'▶':'Ⅱ'}</button>}
  </div>;
}
