'use client';
import {useEffect,useState} from 'react';
export default function CustomerFlightEditor({token,trip,onSaved}:{token:string;trip:any;onSaved:(flight:string|null)=>void}){
 const [hidden,setHidden]=useState(false),[editing,setEditing]=useState(false),[value,setValue]=useState(''),[previous,setPrevious]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const key=`avenyn-flight-reminder:${token}`;
 useEffect(()=>{try{setHidden(localStorage.getItem(key)==='hidden');}catch{}},[key]);
 if(!/landvetter|airport|flygplats/i.test(`${trip.pickup} ${trip.destination}`)||!['new','scheduled','offered','assigned','accepted','en_route','arrived'].includes(trip.status))return null;
 const open=()=>{setValue(trip.flight_number||'');setPrevious(trip.flight_number||'');setEditing(true);setMessage('');};
 const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setMessage('');try{const r=await fetch(`/api/track/${token}/flight`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flightNumber:value,previous})});const j=await r.json();if(!r.ok)throw Error(j.error||'Kunde inte spara.');onSaved(j.flightNumber);setEditing(false);setMessage(j.message);}catch(e){setMessage(e instanceof Error?e.message:'Kunde inte spara.');}finally{setBusy(false);}};
 return <section className="customerFlightEditor">
 {!trip.flight_number&&!hidden&&<div className="flightReminder" role="status"><strong>Lägg gärna till ditt flygnummer</strong><p>Har du inte numret nu? Du kan lägga till det senare via den här bokningslänken.</p><button type="button" onClick={()=>{setHidden(true);try{localStorage.setItem(key,'hidden');}catch{}}}>Stäng påminnelsen</button></div>}
 <button type="button" onClick={open}>{trip.flight_number?`Flyg ${trip.flight_number} · Ändra flygnummer`:'Lägg till flygnummer'}</button>
 {editing&&<form onSubmit={save}><label>Flygnummer<input maxLength={12} value={value} onChange={e=>setValue(e.target.value)} placeholder="Till exempel SK140" autoCapitalize="characters"/></label><small>Lämna tomt för att ta bort flygnumret.</small><button type="submit" disabled={busy}>{busy?'Sparar…':'Spara flygnummer'}</button><button type="button" disabled={busy} onClick={()=>setEditing(false)}>Avbryt</button></form>}
 {message&&<p role="status">{message}</p>}
 </section>;
}
