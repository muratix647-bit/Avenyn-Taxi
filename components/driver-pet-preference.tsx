'use client';
import {useEffect,useState} from 'react';
import {AppText} from './app-language';
export default function DriverPetPreference({accessToken,onChanged}:{accessToken:string;onChanged:()=>void}){
 const [value,setValue]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let alive=true;fetch('/api/pets?scope=driver',{headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store'}).then(async r=>{const j:any=await r.json();if(!r.ok)throw Error(j.error);if(alive){setValue(j.acceptsPets===true);setReady(true)}}).catch(()=>{if(alive)setError('Djurinställningen kunde inte hämtas.')});return()=>{alive=false}},[accessToken]);
 async function save(next:boolean){setBusy(true);setError('');try{const r=await fetch('/api/pets',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({action:'preference',acceptsPets:next})});const j:any=await r.json();if(!r.ok)throw Error(j.error);setValue(next);onChanged()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <section className="driverPetPreference"><h2><AppText text="Djurresor"/></h2><label><input type="checkbox" checked={value} disabled={!ready||busy} onChange={e=>void save(e.target.checked)}/><span><AppText text="Jag vill köra resor med djur"/></span></label><p><AppText text="Djurförbokningar visas när valet är aktiverat. Redan tilldelade körningar finns kvar."/></p>{error&&<p role="alert"><AppText text={error}/></p>}</section>
}
