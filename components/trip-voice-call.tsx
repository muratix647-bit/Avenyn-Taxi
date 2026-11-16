"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Call, Device } from "@twilio/voice-sdk";
import {hasNativeMicrophone,requestMicrophone,openMicrophoneSettings} from "@/lib/native-microphone";
import styles from "./trip-voice-call.module.css";
export default function TripVoiceCall({trackingToken,bookingId,accessToken,role,compact=false}:{trackingToken?:string;bookingId?:string;accessToken?:string;role:"customer"|"driver";compact?:boolean}){
  const [enabled,setEnabled]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[state,setState]=useState(""),[incoming,setIncoming]=useState(false),[connected,setConnected]=useState(false),[muted,setMuted]=useState(false);
  const [microphoneHelp,setMicrophoneHelp]=useState(false);
  const device=useRef<Device|null>(null),call=useRef<Call|null>(null),alive=useRef(true);
  const tokenRef=useRef(accessToken);tokenRef.current=accessToken;
  useEffect(()=>{alive.current=true;const controller=new AbortController();void fetch("/api/voice/config",{signal:controller.signal}).then(r=>r.json()).then(d=>{if(alive.current)setEnabled(d.enabled===true);}).catch(()=>{});return()=>{alive.current=false;controller.abort();call.current?.disconnect();device.current?.destroy();device.current=null;call.current=null;};},[bookingId,trackingToken]);
  useEffect(()=>{if(!incoming)return;const pulse=()=>{try{navigator.vibrate?.([300,150,300]);}catch{}};pulse();const timer=setInterval(pulse,3000);return()=>{clearInterval(timer);try{navigator.vibrate?.(0);}catch{}};},[incoming]);
  const getToken=async()=>{
    const response=await fetch("/api/voice/token",{method:"POST",headers:{"Content-Type":"application/json",...(tokenRef.current?{Authorization:`Bearer ${tokenRef.current}`}:{})},body:JSON.stringify(trackingToken?{trackingToken}:{bookingId})});
    const body=await response.json();if(!response.ok)throw new Error(body.error||"Samtal kunde inte anslutas.");return body.token as string;
  };
  const finish=()=>{call.current=null;if(!alive.current)return;setIncoming(false);setConnected(false);setMuted(false);setBusy(false);setState("Samtalet är avslutat.");};
  const bind=(c:Call,isIncoming:boolean)=>{
    call.current=c;setIncoming(isIncoming);setState(isIncoming?"Inkommande appsamtal":"Ringer…");
    c.on("accept",()=>{if(!alive.current)return;setIncoming(false);setConnected(true);setState("Samtal pågår");});
    for(const event of ["disconnect","cancel","reject"] as const)c.on(event,finish);
    c.on("error",()=>{finish();if(alive.current)setState("Samtalet kunde inte kopplas. Försök igen.");});
  };
  const enable=async()=>{
    setBusy(true);setMicrophoneHelp(false);setState("Ansluter…");
    try{
      await requestMicrophone();
      const token=await getToken();const {Device}=await import("@twilio/voice-sdk");
      if(!alive.current)return;
      device.current?.destroy();const d=new Device(token,{logLevel:0,tokenRefreshMs:60000});device.current=d;
      d.on("incoming",c=>{if(call.current){c.reject();return;}bind(c,true);});
      d.on("tokenWillExpire",()=>{void getToken().then(token=>d.updateToken(token)).catch(()=>{d.destroy();if(alive.current){setReady(false);setState("Anslutningen behöver aktiveras igen.");}});});
      d.on("error",()=>{if(alive.current){setReady(false);setState("Samtalsanslutningen avbröts. Aktivera igen.");}});
      await d.register();if(alive.current){setReady(true);setState("Redo för appsamtal.");}
    }catch(error){device.current?.destroy();device.current=null;if(alive.current)setMicrophoneHelp(error instanceof Error && (error.name==="NotAllowedError" || /permission denied/i.test(error.message)));if(alive.current)setState(error instanceof Error && (error.name==="NotAllowedError" || /permission denied/i.test(error.message)) ? "Mikrofonen är inte tillåten. Öppna instruktionerna nedan och aktivera sedan samtalet igen." : error instanceof Error?error.message:"Kunde inte aktivera samtal.");}
    finally{if(alive.current)setBusy(false);}
  };
  const dial=async()=>{if(!device.current||call.current)return;setBusy(true);setState("Kopplar…");try{await getToken();const c=await device.current.connect();if(!alive.current){c.disconnect();return;}bind(c,false);}catch{if(alive.current)setState("Kunde inte ringa. Kontrollera att båda har aktiverat appsamtal.");}finally{if(alive.current)setBusy(false);}};
  if(!enabled)return null;
  const panel=<section className={`${styles.card} ${incoming?styles.incoming:compact?styles.compact:""}`} aria-label="Appsamtal"><strong>{incoming?"☎ Inkommande appsamtal":"☎ Appsamtal"} · {role==="customer"?"din förare":"din kund"}</strong>
    <p hidden={compact&&!incoming&&!microphoneHelp}>{incoming?"Din "+(role==="customer"?"förare":"kund")+" ringer. Tryck Svara för att prata.":ready?"Du kan ringa och ta emot samtal här. Håll resans sida öppen.":"Aktivera mikrofonen för att ringa och ta emot appsamtal. Båda behöver ha resans sida öppen."}</p>
    <div className={styles.actions}>
      {!ready&&<button type="button" disabled={busy} onClick={()=>void enable()}>{compact?"Aktivera appsamtal":"☎ Aktivera samtal och mikrofon"}</button>}
      {ready&&!call.current&&<button type="button" className={styles.accept} disabled={busy} onClick={()=>void dial()}>Ring {role==="customer"?"föraren":"kunden"}{compact?"":" i appen"}</button>}
      {incoming&&<><button type="button" className={styles.accept} onClick={()=>call.current?.accept()}>☎ Svara på samtalet</button><button type="button" className={styles.decline} onClick={()=>{call.current?.reject();finish();}}>Avvisa</button></>}
      {connected&&<button type="button" aria-pressed={muted} onClick={()=>{call.current?.mute(!muted);setMuted(!muted);}}>{muted?"Slå på mikrofon":"Stäng av mikrofon"}</button>}
      {call.current&&!incoming&&<button type="button" className={styles.decline} onClick={()=>{call.current?.disconnect();finish();}}>Lägg på</button>}
    </div><span role="status">{state}</span>{microphoneHelp&&<>{hasNativeMicrophone()&&<button type="button" className={styles.settings} onClick={()=>void openMicrophoneSettings().catch(()=>setState("Appinställningarna kunde inte öppnas."))}>Öppna mikrofoninställningar</button>}<details open><summary>Mikrofon · så aktiverar du den</summary><p>Android-app: håll inne appikonen → Appinformation → Behörigheter → Mikrofon → Tillåt när appen används. Kontrollera också att telefonens mikrofonåtkomst är på.</p><p>I Chrome: öppna sidans inställningar vid adressfältet → Behörigheter → Mikrofon → Tillåt. Gå tillbaka och tryck Aktivera appsamtal.</p><p>Om Mikrofon saknas bland appens behörigheter krävs en uppdaterad Android-app. Under tiden kan du öppna resan i Chrome och aktivera appsamtal där, eller ringa med telefonknappen.</p></details></>}
  </section>;
  return incoming?createPortal(panel,document.body):panel;
}
