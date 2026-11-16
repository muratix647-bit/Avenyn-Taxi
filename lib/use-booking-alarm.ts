'use client';
import {useEffect,useRef,useState} from 'react';

// Desired setting persists; audio readiness is deliberately never persisted.
export function useBookingAlarm(owner:string,driver=false){
 const key=`avenyn-booking-alarm:v1:${driver?'driver':'dispatch'}:${owner}`;
 const [wanted,setWanted]=useState(false),[ready,setReady]=useState(false);
 const audio=useRef<AudioContext|null>(null),desired=useRef(false);
 const resume=()=>{
  if(!desired.current)return;
  try{
   const c=audio.current??(audio.current=new AudioContext());
   c.onstatechange=()=>setReady(c.state==='running');
   setReady(c.state==='running');
   void c.resume().then(()=>setReady(c.state==='running')).catch(()=>setReady(false));
  }catch{setReady(false)}
 };
 const choose=(value:boolean)=>{
  desired.current=value;setWanted(value);
  try{localStorage.setItem(key,value?'on':'off')}catch{}
  window.dispatchEvent(new Event('avenyn-alarm-setting'));
  if(value)resume();else{setReady(false);void audio.current?.suspend();}
 };
 useEffect(()=>{
  const restore=()=>{
   let value=false;try{value=localStorage.getItem(key)==='on'}catch{}
   desired.current=value;setWanted(value);
   if(value)resume();else{setReady(false);void audio.current?.suspend();}
  };
  const wake=()=>{if(document.visibilityState==='visible')resume()};
  restore();
  window.addEventListener('avenyn-alarm-setting',restore);
  window.addEventListener('storage',restore);
  document.addEventListener('pointerdown',resume);
  document.addEventListener('keydown',resume);
  document.addEventListener('visibilitychange',wake);
  return()=>{
   window.removeEventListener('avenyn-alarm-setting',restore);window.removeEventListener('storage',restore);
   document.removeEventListener('pointerdown',resume);document.removeEventListener('keydown',resume);document.removeEventListener('visibilitychange',wake);
   if(audio.current){audio.current.onstatechange=null;void audio.current.close();audio.current=null;}
  };
 },[key]);
 return {wanted,ready,audio,activate:()=>choose(true),disable:()=>choose(false)};
}
