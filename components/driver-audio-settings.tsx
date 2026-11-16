'use client';
import {useEffect,useState} from 'react';
import {Capacitor,registerPlugin} from '@capacitor/core';
type Settings={volume:number;language:string;theme:string;muted:boolean};
const Navigation=registerPlugin<{capabilities():Promise<{audioSettings?:boolean;mapSettings?:boolean}>;getAudioSettings():Promise<Settings>;setAudioSettings(options:Settings):Promise<void>}>('AvenynNavigation');
export default function DriverAudioSettings(){
 const [supported,setSupported]=useState(false),[enhanced,setEnhanced]=useState(false),[settings,setSettings]=useState<Settings>({volume:70,language:'sv',theme:'auto',muted:false}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let alive=true;if(Capacitor.getPlatform()==='android')void Navigation.capabilities().then(async c=>{if(!c.audioSettings)return;const s=await Navigation.getAudioSettings();if(alive){setSupported(true);setEnhanced(!!c.mapSettings);setSettings({volume:s.volume,language:s.language,theme:s.theme||'auto',muted:!!s.muted});}}).catch(()=>{});return()=>{alive=false};},[]);
 const change=(patch:Partial<Settings>)=>{setSettings(s=>({...s,...patch}));setMessage('');};
 return <details className="driverAudioSettings compactDriverAudio"><summary>Ljud och karta</summary>{supported?<>
 {enhanced&&<label>Kartans utseende<select value={settings.theme} onChange={e=>change({theme:e.target.value})}><option value="auto">Automatiskt dag/natt</option><option value="light">Ljust</option><option value="dark">Mörkt</option></select></label>}
 {enhanced&&<label className="driverVoiceToggle"><input type="checkbox" checked={!settings.muted} onChange={e=>change({muted:!e.target.checked})}/> Navigationsröst på</label>}
 <label>Medievolym · {settings.volume}%<input type="range" min="0" max="100" step="5" value={settings.volume} onChange={e=>change({volume:Number(e.target.value)})}/></label>
 <label>Språk i bilnavigationen<select value={settings.language} onChange={e=>change({language:e.target.value})}><option value="sv">Svenska</option><option value="en">English</option>{enhanced&&<option value="ml">Malayalam · മലയാളം (prova på telefonen)</option>}</select></label>
 {settings.language==='ml'&&<p>Malayalam-rösten behöver verifieras på telefonen. Google kan använda ett annat språk om rösten saknas. Välj English om instruktionerna inte läses upp på Malayalam.</p>}
 <p>Valen sparas på den här telefonen. Volymreglaget påverkar även annat medieljud och bokningslarm. Stäng av enbart navigationsrösten med reglaget ovan. Byt språk mellan körningar; navigationen kan behöva öppnas på nytt.</p>
 <button disabled={busy} onClick={async()=>{setBusy(true);setMessage('');try{await Navigation.setAudioSettings(settings);setMessage('Inställningarna är sparade.');}catch(e){setMessage(e instanceof Error?e.message:'Kunde inte ändra inställningarna. Försök igen mellan körningar.');}finally{setBusy(false);}}}>{busy?'Sparar…':'Spara inställningar'}</button>
 </>:<p>Val för kartläge, navigationsljud och språk kräver den nya Android-versionen av förarappen. Den installerade versionen har ännu inte stöd för dessa inställningar.</p>}{message&&<p role="status">{message}</p>}</details>;
}
