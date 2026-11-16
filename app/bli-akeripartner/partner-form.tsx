'use client';
import { useState, type FormEvent } from 'react';
import styles from './partner.module.css';
export default function PartnerForm(){
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;setBusy(true);setError('');const body=Object.fromEntries(new FormData(event.currentTarget));try{const response=await fetch('/api/partners',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result: any=await response.json();if(!response.ok)throw new Error(result.error);setDone(true);}catch(e){setError(e instanceof Error?e.message:'Försök igen.');}finally{setBusy(false);}}
 if(done)return <div className={styles.success} role="status"><h3>Tack för din ansökan!</h3><p>Vi har tagit emot dina uppgifter. Avenyn Taxi kontaktar dig om nästa steg.</p><a href="/">Till startsidan</a></div>;
 return <form onSubmit={submit} className={styles.form}>
  <div className={styles.fields}>
   <label>Företagsnamn<input name="company" required maxLength={150} autoComplete="organization"/></label>
   <label>Organisationsnummer<input name="org_number" required maxLength={13} inputMode="numeric" placeholder="10 siffror"/></label>
   <label>Kontaktperson<input name="contact_name" required maxLength={120} autoComplete="name"/></label>
   <label>Telefon<input name="phone" type="tel" required maxLength={25} autoComplete="tel"/></label>
   <label className={styles.wide}>E-post<input name="email" type="email" required maxLength={200} autoComplete="email"/></label>
   <label>Trafiktillstånd · nummer<input name="permit_number" required maxLength={100}/></label>
   <label>Antal taxibilar<input name="vehicle_count" type="number" required min={1} max={5000}/></label>
   <label className={styles.wide}>Område du kör i<input name="area" required maxLength={300} placeholder="Exempel: Göteborg, Mölndal, Landvetter"/></label>
   <label className={styles.wide}>Meddelande <span>(valfritt)</span><textarea name="message" maxLength={2000} rows={3} placeholder="Exempelvis storbil, barnstol eller tillgängliga tider"/></label>
  </div>
  <div className={styles.trap} aria-hidden="true"><label>Webbplats<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
  <p className={styles.small}>Uppgifterna används för att hantera din ansökan och kontakta dig. <a href="/integritet">Läs vår integritetspolicy.</a></p>
  {error&&<p className={styles.error} role="alert">{error}</p>}
  <button className={styles.submit} disabled={busy}>{busy?'Skickar…':'Skicka ansökan'}</button>
 </form>
}
