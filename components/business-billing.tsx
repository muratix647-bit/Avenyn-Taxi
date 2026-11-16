'use client';
import CompanyContracts from './company-contracts';
import CompanyAccessAdmin from './company-access-admin';
import CustomerInvoices from './customer-invoices';
import {useCallback,useEffect,useRef,useState} from 'react';
const blank={id:'',name:'',org_number:'',invoice_email:'',billing_address:'',payment_days:30,reference_required:false,approved:false};
export default function BusinessBilling({accessToken,initialBooking='',onBookingOpened,onEditBooking}:{onEditBooking:(row:any)=>void;accessToken:string;initialBooking?:string;onBookingOpened?:()=>void}){
 const [data,setData]=useState<any>({companies:[],bookings:[],links:[]});
 const [company,setCompany]=useState(blank),[bookingId,setBookingId]=useState(''),[companyId,setCompanyId]=useState(''),[reference,setReference]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[updated,setUpdated]=useState('');
 const [preview,setPreview]=useState<{url:string;number:string}|null>(null),[previewBusy,setPreviewBusy]=useState('');
 const previewRequest=useRef<AbortController|null>(null);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview.url);},[preview]);
 useEffect(()=>{setPreview(null);return()=>previewRequest.current?.abort();},[accessToken]);
 async function previewPdf(id:string,number:string){
  previewRequest.current?.abort();const controller=new AbortController();previewRequest.current=controller;
  setPreviewBusy(id);setError('');setPreview(null);
  try{const r=await fetch(`/api/dispatch/business-billing/preview?booking_id=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store',signal:controller.signal});if(!r.ok){const j:any=await r.json();throw Error(j.error);}const blob=await r.blob();if(controller.signal.aborted)return;if(blob.type!=='application/pdf')throw Error('Svaret var inte en PDF.');setPreview({url:URL.createObjectURL(blob),number});}
  catch(e:any){if(!controller.signal.aborted)setError(e.message||'Kunde inte skapa PDF.');}
  finally{if(previewRequest.current===controller)setPreviewBusy('');}
 }
 const load=useCallback(async()=>{try{const r=await fetch('/api/dispatch/business-billing'+(initialBooking?'?booking='+encodeURIComponent(initialBooking):''),{headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store'});const j: any=await r.json();if(!r.ok)throw Error(j.error);setData(j);setLoaded(true);setUpdated(new Date().toLocaleTimeString('sv-SE'));setError('');}catch(e:any){setError(e.message||'Kunde inte hämta underlagen.');}},[accessToken,initialBooking]);
 useEffect(()=>{load();const timer=setInterval(load,30000);return()=>clearInterval(timer);},[load]);
 async function save(body:any){setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/dispatch/business-billing',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const j: any=await r.json();if(!r.ok)throw Error(j.error);setNotice('Sparat.');if(body.action==='save_company')setCompany(blank);await load();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 const money=(ore:number|null)=>ore===null?'Slutpris saknas':(ore/100).toLocaleString('sv-SE',{style:'currency',currency:'SEK'});
 return <section className="businessBilling">
 <CustomerInvoices onEditBooking={onEditBooking} initialBooking={initialBooking} onBookingOpened={onBookingOpened} billingLoaded={loaded} accessToken={accessToken} bookings={data.bookings} companies={data.companies} links={data.links}/>
 <div className="bbIntro"><div><h2>Företagskunder & fakturaunderlag</h2><p>Koppla en bokning till ett godkänt företag. Underlaget följer resans status och slutpris.</p></div><button onClick={load} disabled={busy}>Uppdatera</button></div>
 <p className="bbInfo">Här kan du förhandsvisa företagens reseunderlag. Välj Ny kundfaktura ovan för att utfärda en faktura.</p>
 {error&&<p role="alert" className="bbError">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {preview&&<aside className="bbInfo" aria-label="PDF-förhandsvisning"><strong>Fakturautkast för bokning #{preview.number}</strong><p>Inte utfärdad och ska inte betalas. Momsberäkningen är preliminär.</p><a href={preview.url} target="_blank" rel="noopener noreferrer">Öppna PDF</a>{' · '}<a href={preview.url} download={`avenyn-utkast-${preview.number}.pdf`}>Ladda ner PDF</a><button onClick={()=>setPreview(null)}>Stäng</button></aside>}
 <CompanyContracts accessToken={accessToken} companies={data.companies} links={data.links} onSaved={load}/>
 <CompanyAccessAdmin accessToken={accessToken} companies={data.companies} onSaved={load}/>
 <div className="bbGrid"><form onSubmit={e=>{e.preventDefault();save({action:'save_company',company});}}>
 <h3>{company.id?'Redigera företagskund':'Ny företagskund'}</h3>
 {([['name','Företagsnamn'],['org_number','Organisationsnummer / utländskt företags-ID'],['invoice_email','Fakturamejl'],['billing_address','Fullständig fakturaadress']] as const).map(([key,label])=><label key={key}>{label}<input required type={key==='invoice_email'?'email':'text'} maxLength={key==='billing_address'?500:180} value={company[key]} onChange={e=>setCompany({...company,[key]:e.target.value})}/></label>)}
 <label>Betalningsvillkor, dagar<input type="number" required min={1} max={90} value={company.payment_days} onChange={e=>setCompany({...company,payment_days:Number(e.target.value)})}/></label>
 <label className="bbCheck"><input type="checkbox" checked={company.reference_required} onChange={e=>setCompany({...company,reference_required:e.target.checked})}/>Kundreferens krävs</label>
 <label className="bbCheck"><input type="checkbox" checked={company.approved} onChange={e=>setCompany({...company,approved:e.target.checked})}/>Godkänd av mig för fakturabetalning</label>
 <button disabled={busy}>Spara företag</button>{company.id&&<button type="button" onClick={()=>setCompany(blank)}>Avbryt redigering</button>}
 </form><div><form onSubmit={e=>{e.preventDefault();save({action:'link_booking',booking_id:bookingId,company_id:companyId,reference});}}><h3>Koppla bokning till företag</h3>
 <label>Bokning<select required value={bookingId} onChange={e=>setBookingId(e.target.value)}><option value="">Välj bokning</option>{data.bookings.map((b:any)=><option key={b.id} value={b.id}>#{b.booking_number} · {b.booking_date} · {b.customer_name}</option>)}</select></label>
 <small>De 200 senaste aktiva bokningarna visas. En ny koppling ersätter eventuell tidigare företagskoppling.</small>
 <label>Företag<select required value={companyId} onChange={e=>setCompanyId(e.target.value)}><option value="">Välj godkänt företag</option>{data.companies.filter((c:any)=>c.approved).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label>Kundreferens / kostnadsställe<input maxLength={160} value={reference} onChange={e=>setReference(e.target.value)}/></label>
 <p>Betalningssätt och pris ändras i bokningen. Betalda eller avbokade resor markeras för granskning.</p><button disabled={busy||!loaded}>Spara koppling</button></form>
 <h3>Företagsregister</h3>{!loaded?<p>Laddar…</p>:data.companies.length===0?<p>Inga företag registrerade ännu.</p>:data.companies.map((c:any)=><div className="bbCompany" key={c.id}><div><strong>{c.name}</strong><small>{c.org_number} · {c.approved?'Godkänd':'Ej godkänd'} · {c.payment_days} dagar</small></div><button onClick={()=>setCompany({...c})}>Redigera</button></div>)}</div></div>
 <div className="bbIntro"><h3>Underlag från kopplade resor</h3><small>Uppdateras var 30:e sekund{updated?` · Senast ${updated}`:''}</small></div>
 <p>Högst 500 senaste kopplingar visas. Beloppen inkluderar moms; momsfördelningen fastställs vid fakturering.</p>
 {loaded&&data.links.length===0&&<p>Inga kopplade resor ännu.</p>}
 {data.links.map((l:any)=><article className="bbDraft" key={l.booking_id}><div className="bbIntro"><strong>{l.company.name} · #{l.booking.booking_number}</strong><strong>{money(l.summary.grossOre)}</strong></div><p>{l.booking.booking_date} · {l.booking.pickup_address} → {l.booking.dropoff_address}</p><small>Referens: {l.reference||'Ingen'} · {l.company.invoice_email}</small><p className={l.summary.ready?'bbReady':'bbReview'}>{l.summary.ready?'Redo för fakturagranskning — inte skickad':l.summary.reasons.join(' · ')}</p>{l.summary.ready&&<button disabled={!!previewBusy} onClick={()=>previewPdf(l.booking_id,String(l.booking.booking_number))}>{previewBusy===l.booking_id?'Skapar PDF…':'Förhandsvisa PDF'}</button>}</article>)}
 <style>{`.businessBilling{padding:20px;max-width:1200px;color:#102b46}.bbIntro{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}.businessBilling h2{font-size:24px;margin:0 0 8px}.businessBilling h3{margin:14px 0}.businessBilling p{line-height:1.5;margin:10px 0}.bbInfo{padding:14px;border-left:4px solid #d5aa24;background:#fff8de;border-radius:8px}.bbGrid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}.businessBilling form,.bbDraft{padding:20px;border:1px solid #d7e1eb;border-radius:16px;background:white}.businessBilling label{display:block;margin:12px 0;font-size:14px;font-weight:600}.businessBilling input:not([type=checkbox]),.businessBilling select{display:block;width:100%;margin-top:6px;border:1px solid #bacbdc;border-radius:8px;padding:11px;background:white;color:#102b46;min-width:0}.businessBilling .bbCheck{display:flex;align-items:center;gap:10px}.businessBilling button{padding:10px 14px;border:1px solid #b9cbdc;border-radius:8px;background:#eaf2fa;color:#12365b;cursor:pointer;margin:4px}.businessBilling button:disabled{opacity:.5;cursor:wait}.bbCompany{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #d7e1eb;gap:8px}.bbCompany small{display:block;margin-top:4px}.bbDraft{margin:12px 0}.bbReady{color:#176039;font-weight:600}.bbReview{color:#875114}.bbError{padding:12px;background:#fff0ee;color:#9a2828}.businessBilling small{overflow-wrap:anywhere}@media(max-width:760px){.bbGrid{grid-template-columns:1fr}.businessBilling{padding:12px}.businessBilling form{padding:14px}}`}</style>
 </section>;
}
