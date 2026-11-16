'use client';
import PaidTripReview,{isPaidTrip} from './paid-trip-review';
import {useEffect,useRef,useState} from 'react';
import {invoiceNo,validInvoiceEmail,customerNumber,paymentReference,postalAddress,simplifiedInvoice,invoiceBankgiro,services,newInvoiceLine,priceLines,type InvoiceLineInput} from '@/lib/customer-invoice';
import {sek} from '@/lib/economy-workspace';
import {orderReference,invoiceBooking} from '@/lib/invoice-booking';
import {billingSummary} from '@/lib/business-billing';

const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm'}).format(new Date());
const blank=()=>({recipientEmail:'',refFormat:'short',kind:'private',name:'',address:'',org:'',reference:'',description:'Persontransport med taxi',serviceDate:today(),days:'30',amount:'',rate:'6',vatReason:'',sellerVat:'SE556597479601',sellerAddress:'',payment:invoiceBankgiro,bookingId:''});
type Form=ReturnType<typeof blank>;
type Draft={id:string;revision:number;payload:{form:Form;items:InvoiceLineInput[];replacementOf?:string}};
type Entry={credited?:boolean;customer_no?:number;id:string;serial_no:number;gross_ore:number;issued_on:string;booking_id:string|null;document:Form;delivery?:{recipient:string;state:'accepted'|'pending'|'rejected'}|null};
export default function CustomerInvoices({accessToken,bookings,companies,links,initialBooking='',billingLoaded,onBookingOpened,onEditBooking}:{onEditBooking:(row:any)=>void;initialBooking?:string;billingLoaded?:boolean;onBookingOpened?:()=>void;accessToken:string;bookings:any[];companies:any[];links:any[]}){
 const [form,setForm]=useState(blank),[invoices,setInvoices]=useState<Entry[]>([]),[busy,setBusy]=useState(false),[review,setReview]=useState(false),[feedback,setFeedback]=useState('');
 const [items,setItems]=useState<InvoiceLineInput[]>(()=>[newInvoiceLine()]);
 function editItems(next:InvoiceLineInput[]){setItems(next);setReview(false);setFeedback('');requestId.current='';}
 function editLine(index:number,patch:Partial<InvoiceLineInput>){editItems(items.map((row,i)=>i===index?{...row,...patch}:row));}
 const [drafts,setDrafts]=useState<Draft[]>([]),[editing,setEditing]=useState<{id:string;revision:number}|null>(null);
 const [replacementOf,setReplacementOf]=useState('');
 const [confirmAction,setConfirmAction]=useState('');
 const [search,setSearch]=useState('');
 const formSection=useRef<HTMLDetailsElement>(null);
 const [registerReady,setRegisterReady]=useState(false);
 const [plans,setPlans]=useState<any[]>([]),[deliveries,setDeliveries]=useState<any[]>([]);
 const [planVersion,setPlanVersion]=useState('');
 const [sms,setSms]=useState<{id:string;phone:string;attempt:string}|null>(null);
 async function smsData(){
  const r=await fetch('/api/dispatch/customer-invoices/sms',{headers,cache:'no-store'});
  if(!r.ok)throw Error('SMS-registret kunde inte hämtas.');
  const j=await r.json();setPlans(j.plans);setDeliveries(j.deliveries);
 }
 async function smsAction(body:any){
  if(lock.current)return;
  lock.current=true;setBusy(true);
  try{
   const r=await fetch('/api/dispatch/customer-invoices/sms',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
   const j=await r.json();if(!r.ok)throw Error(j.error||'Åtgärden misslyckades.');
   if(body.action==='plan')resetForm();
   setSms(null);
   setFeedback(body.action==='send'?'SMS-tjänsten har tagit emot fakturalänken.':body.action==='plan'?'Planerat. Fakturan skickas efter avslutad körning.':'Det planerade utskicket har tagits bort.');
  }catch(e){setFeedback((e as Error).message);}
  finally{await smsData().catch(()=>{});lock.current=false;setBusy(false);}
 }
 useEffect(()=>{void smsData().catch(e=>setFeedback(e.message));},[accessToken]);
 const [mail,setMail]=useState<{id:string;recipient:string}|null>(null);
 const requestId=useRef(''),lock=useRef(false);
 const headers={Authorization:'Bearer '+accessToken};
 async function list(){
  const res=await fetch('/api/dispatch/customer-invoices',{headers,cache:'no-store'});
  if(!res.ok)throw Error('Fakturaregistret kunde inte hämtas.');
  const rows:Entry[]=(await res.json()).invoices;setInvoices(rows);setRegisterReady(true);
  if(rows.length)setForm(f=>({...f,sellerAddress:f.sellerAddress||(postalAddress(rows[0].document.sellerAddress)?rows[0].document.sellerAddress:''),payment:f.payment||rows[0].document.payment}));
 }
 useEffect(()=>{void list().catch(e=>setFeedback(e.message));},[accessToken]);
 async function loadDrafts(){
  const res=await fetch('/api/dispatch/customer-invoices/manage',{headers,cache:'no-store'});if(!res.ok)throw Error('Utkasten kunde inte hämtas.');setDrafts(await res.json());
 }
 useEffect(()=>{void loadDrafts().catch(e=>setFeedback(e.message));},[accessToken]);
 async function manage(body:any){
  const res=await fetch('/api/dispatch/customer-invoices/manage',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await res.json();if(!res.ok)throw Error(data.error||'Åtgärden kunde inte genomföras.');return data;
 }
 function focusForm(){if(formSection.current){formSection.current.open=true;formSection.current.scrollIntoView({block:'start'});}}
 function resetForm(){setPlanVersion('');setReplacementOf('');setEditing(null);setReview(false);setItems([newInvoiceLine()]);setForm(f=>({...blank(),sellerAddress:f.sellerAddress}));requestId.current='';}
 function openDraft(d:Draft){setReplacementOf(d.payload.replacementOf||'');setEditing({id:d.id,revision:d.revision});setForm({...blank(),...d.payload.form});setItems(d.payload.items);setReview(false);requestId.current=d.id;setConfirmAction('');focusForm();}
 async function saveDraft(){
  if(lock.current)return;lock.current=true;setBusy(true);requestId.current||=crypto.randomUUID();
  try{const saved=await manage({action:'save',id:editing?.id||requestId.current,revision:editing?.revision||0,payload:{form,items,replacementOf}});setEditing(saved);await loadDrafts();setFeedback('Utkastet är sparat.');}
  catch(e){setFeedback((e as Error).message);}finally{lock.current=false;setBusy(false);}
 }
 async function removeDraft(d:Draft){
  if(lock.current)return;lock.current=true;setBusy(true);
  try{await manage({action:'delete',id:d.id,revision:d.revision,confirmed:true});if(editing?.id===d.id)resetForm();await loadDrafts();setFeedback('Utkastet är raderat.');setConfirmAction('');}
  catch(e){setFeedback((e as Error).message);}finally{lock.current=false;setBusy(false);}
 }
 function copyInvoice(entry:Entry,replacement=false){
  const doc:any=entry.document;const original=doc.booking||{};
  const lines=(doc.items||[{description:doc.description,quantity:1,unitOre:entry.gross_ore,rate:doc.rate}]).map((i:any)=>({service:i.service||(i.rate===6?'passenger':i.rate===25?'courier':'other'),quantity:String(i.quantity),amount:(i.unitOre/100).toFixed(2),rate:String(i.rate),description:i.description,vatReason:i.reason||''}));
  selection.current++;setChoosing(false);setChoice(null);setPlanVersion('');setConfirmAction('');setTripQuery('');
  setFeedback('Kopierad från '+invoiceNo(entry.serial_no)+'. Granska raderna och tjänstedatumet innan du utfärdar fakturan.');
  setReplacementOf(replacement?entry.id:'');setEditing(null);requestId.current='';setReview(false);setItems(lines);
  setForm({...blank(),...doc,address:postalAddress(doc.address)?doc.address:'',sellerAddress:postalAddress(doc.sellerAddress)?doc.sellerAddress:'',payment:invoiceBankgiro,days:String(doc.days),bookingId:replacement?(entry.booking_id||''):'',recipientEmail:doc.recipientEmail||original.email||''});focusForm();
 }
 async function credit(entry:Entry){
  if(lock.current)return;lock.current=true;setBusy(true);
  try{await manage({action:'credit',id:entry.id,confirmed:true});await list();setConfirmAction('');setFeedback('Fakturan är helkrediterad. Hämta kreditfakturan eller öppna en korrigerad kopia.');}
  catch(e){setFeedback((e as Error).message);}finally{lock.current=false;setBusy(false);}
 }
 function update(patch:Partial<Form>){setForm(f=>({...f,...patch}));setReview(false);setFeedback('');requestId.current='';}
 function customer(c:any){return {kind:'company',recipientEmail:c.invoice_email||'',name:c.name,address:c.billing_address,org:c.org_number,days:String(c.payment_days)};}
 const [tripQuery,setTripQuery]=useState(''),[matches,setMatches]=useState<any[]>([]),[finding,setFinding]=useState(false),[searchError,setSearchError]=useState('');
 const [choice,setChoice]=useState<any>(null),[choosing,setChoosing]=useState(false);
 const selection=useRef(0);
 useEffect(()=>{
  const abort=new AbortController();setFinding(true);setSearchError('');
  const timer=setTimeout(async()=>{
   try{
    const r=await fetch('/api/dispatch/customer-invoices/bookings?q='+encodeURIComponent(tripQuery),{headers,signal:abort.signal,cache:'no-store'});
    if(!r.ok)throw Error('Bokningarna kunde inte hämtas.');
    const data=await r.json();if(!abort.signal.aborted)setMatches(data.bookings);
   }catch(e){if(!abort.signal.aborted){setSearchError((e as Error).message);setMatches([]);}}
   finally{if(!abort.signal.aborted)setFinding(false);}
  },180);
  return ()=>{abort.abort();clearTimeout(timer);};
 },[tripQuery,accessToken]);
 async function chooseBooking(id:string){
  const request=++selection.current;
  setChoosing(!!id);setReview(false);setFeedback('');setPlanVersion('');setReplacementOf('');setEditing(null);
  if(!id){setChoice(null);resetForm();return;}
  try{
   const r=await fetch('/api/dispatch/customer-invoices/bookings?id='+encodeURIComponent(id),{headers,cache:'no-store'});
   const result=await r.json();if(request!==selection.current)return;
   if(!r.ok)throw Error(result.error||'Bokningen kunde inte hämtas.');
   const b=result.booking,l=result.link,summary=billingSummary(b,l?.company||{approved:true},l?.reference||'');
   const amount=summary.grossOre===null?'':(summary.grossOre/100).toFixed(2);
   const description=('Taxiresa #'+b.booking_number+' · '+b.pickup_address+' → '+b.dropoff_address).slice(0,300);
   setChoice(result);setItems([{...newInvoiceLine(),description,amount}]);requestId.current='';
   setForm(f=>({...blank(),sellerAddress:f.sellerAddress,...(l?.company?customer(l.company):{name:b.customer_name||'',recipientEmail:b.customer_email||''}),bookingId:b.id,reference:orderReference(b.booking_number,l?.reference),description,serviceDate:b.booking_date,amount}));
  }catch(e){if(request===selection.current){setChoice(null);resetForm();setFeedback((e as Error).message);}}
  finally{if(request===selection.current)setChoosing(false);}
 }
 useEffect(()=>{
  if(!initialBooking||!registerReady||!billingLoaded)return;
  void chooseBooking(initialBooking);focusForm();onBookingOpened?.();
 },[initialBooking,registerReady,billingLoaded]);
 async function sendPdf(id:string,recipient:string){
  const res=await fetch('/api/dispatch/customer-invoices/send',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id,recipient})});
  const reply=await res.json();
  if(!res.ok)throw Error(reply.error||'Utskicket kunde inte bekräftas.');
 }
 async function sendExisting(){
  if(!mail||lock.current)return;
  lock.current=true;setBusy(true);
  try{await sendPdf(mail.id,mail.recipient);setFeedback('Mejltjänsten har tagit emot fakturan till '+mail.recipient+'.');setMail(null);}
  catch(e){setFeedback((e as Error).message);}
  finally{try{await list();}finally{lock.current=false;setBusy(false);}}
 }
 async function issue(andSend=false){
  if(lock.current)return;lock.current=true;setBusy(true);setFeedback('');
  try{
   requestId.current ||= crypto.randomUUID();
   const res=await fetch('/api/dispatch/customer-invoices',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({...form,items,replacementOf,id:editing?.id||requestId.current,...(editing?{draftRevision:editing.revision}:{})})});
   const result=await res.json();if(!res.ok)throw Error(result.error||'Fakturan kunde inte utfärdas.');
   resetForm();void loadDrafts().catch(()=>{});
   if(andSend){
    try{await sendPdf(result.id,form.recipientEmail);setFeedback('Faktura '+invoiceNo(result.serial_no)+' är utfärdad och mejltjänsten har tagit emot den till '+form.recipientEmail+'.');}
    catch(e){setFeedback('Faktura '+invoiceNo(result.serial_no)+' är utfärdad. '+(e as Error).message);}
   }else setFeedback('Faktura '+invoiceNo(result.serial_no)+' är utfärdad. Du kan mejla den från listan.');
   await list();
  }catch(e){setFeedback((e as Error).message);}finally{setBusy(false);lock.current=false;}
 }
 async function pdf(entry:Entry,correctPayment=false,isCredit=false){
  try{const r=await fetch('/api/dispatch/customer-invoices?id='+entry.id+(isCredit?'&credit=1':'')+(correctPayment?'&paymentCopy=1':''),{headers});if(!r.ok)throw Error('PDF kunde inte hämtas.');
   const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=(isCredit?'K-':'')+invoiceNo(entry.serial_no)+(correctPayment?'-rattad-betalning':'')+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){setFeedback((e as Error).message);}
 }
 const matching=invoices.filter(i=>(invoiceNo(i.serial_no)+' '+(i.customer_no?customerNumber(i.customer_no):'')+' '+i.document.name+' '+i.issued_on).toLocaleLowerCase('sv-SE').includes(search.trim().toLocaleLowerCase('sv-SE')));
 const field=(key:keyof Form,label:string,required=true,type='text',max=180)=><label>{label}<input type={type} value={form[key]} required={required} maxLength={max} onChange={e=>update({[key]:e.target.value})}/></label>;
 let totals:ReturnType<typeof priceLines>|undefined;
 try{totals=priceLines(items);}catch{/* Incomplete inputs are expected while editing. */}
 const gross=totals?.gross??0,vat=totals?.vat??0;
 const picked=choice?.booking?.id===form.bookingId?choice:null;
 const selectedBooking=picked?.booking||bookings.find(b=>b.id===form.bookingId);
 const paidTrip=isPaidTrip(selectedBooking);
 const upcoming=selectedBooking&&selectedBooking.status!=='completed';
 const trip=selectedBooking?invoiceBooking(selectedBooking):null;
 const linked=picked?.link||links.find(l=>l.booking_id===form.bookingId);
 const reasons=selectedBooking?billingSummary({...selectedBooking,status:upcoming&&selectedBooking.status!=='cancelled'?'completed':selectedBooking.status},linked?.company||{approved:true},linked?.reference||'').reasons:[];
 if(selectedBooking?.payment_status==='refunded')reasons.push('Resan är återbetald');
 const issued=picked?.invoice||invoices.find(i=>!i.credited&&i.booking_id===form.bookingId&&form.bookingId);
 if(issued)reasons.push('Faktura '+invoiceNo(issued.serial_no)+' är redan utfärdad');
 const optional=form.kind==='private'&&(!gross||simplifiedInvoice(form.kind,gross));
 return <section aria-label="Kundfakturor" ><header className="bbIntro"><img src="/avenyn-logo-optimized.webp" width="80" alt="Avenyn Taxi"/><h2>Kundfakturor</h2></header>
 <details ref={formSection}><summary className="cursor-pointer font-bold">{editing?'Redigera fakturautkast':'Ny kundfaktura'}</summary><form onSubmit={e=>{e.preventDefault();if(choosing||reasons.length)return;try{priceLines(items);setReview(true);setFeedback('');}catch(e){setFeedback((e as Error).message);}}}><fieldset disabled={busy||review} className="grid gap-3 sm:grid-cols-2">
 <div className="sm:col-span-2"><label>Sök bokning<input type="search" value={tripQuery} placeholder="Bokningsnummer, kund, telefon, e-post, datum eller adress" onChange={e=>setTripQuery(e.target.value)}/></label>
 <label>Hämta uppgifter från resa<select disabled={finding} value={form.bookingId} onChange={e=>void chooseBooking(e.target.value)}><option value="">Fristående faktura</option>{selectedBooking&&!matches.some(b=>b.id===selectedBooking.id)&&<option value={selectedBooking.id}>#{selectedBooking.booking_number} · {selectedBooking.customer_name}</option>}{matches.map(b=><option key={b.id} value={b.id}>#{b.booking_number} · {b.customer_name} · {b.booking_date} · {b.pickup_address}</option>)}</select></label>
 <small role="status">{searchError||(choosing?'Hämtar reseuppgifter…':finding?'Söker…':!matches.length?'Ingen bokning hittades.':matches.length===50?'Visar 50 bokningar. Skriv mer för att begränsa sökningen.':'')}</small>
 {selectedBooking&&<button type="button" disabled={choosing} onClick={()=>onEditBooking(selectedBooking)}>Redigera bokning #{selectedBooking.booking_number}</button>}
 {!paidTrip&&reasons.length>0&&<p role="status">{reasons.join(' · ')}</p>}</div>
 {trip&&<div className="bbInfo sm:col-span-2"><strong>Bokning #{trip.number} · {trip.name}</strong><p>Telefon: {trip.phone||'saknas'} · E-post: {trip.email||'saknas i bokningen'}</p><p>{trip.date} {trip.time} · {trip.from} → {trip.to}</p>{trip.stop&&<p>Extra stopp: {trip.stop}</p>}{trip.flight&&<p>Flygnummer: {trip.flight}</p>}{!paidTrip&&!trip.email&&!form.recipientEmail&&<p>Ange mottagarens e-post nedan om du vill mejla fakturan.</p>}</div>}
 {paidTrip?<PaidTripReview accessToken={accessToken} key={selectedBooking.id} booking={selectedBooking}/>:<>
 <label>Kundtyp<select value={form.kind} onChange={e=>update({kind:e.target.value,recipientEmail:'',name:'',org:'',reference:'',address:''})}><option value="private">Privatkund</option><option value="company">Företagskund</option></select></label>
 {form.kind==='company'&&<label>Hämta företag<select value="" onChange={e=>{const c=companies.find(x=>x.id===e.target.value);if(c)update(customer(c));}}><option value="">Välj från företagsregistret</option>{companies.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>}
 {field('name',form.kind==='company'?'Företagsnamn':'Kundens namn')}{field('address',optional?'Kundens adress (valfri upp till 4 000 kr inkl. moms)':'Kundens fakturaadress',!optional,'text',250)}
 {form.kind==='company'&&field('org','Kundens organisationsnummer')}{field('reference','Beställarreferens',false)}{field('recipientEmail','E-post för faktura',false,'email',254)}
 {field('serviceDate','Tjänstedatum',true,'date')}
 <section className="sm:col-span-2 space-y-3"><h3>Fakturarader</h3>
 {items.map((row,i)=><fieldset key={i} className="rounded-xl border p-3 grid gap-2 sm:grid-cols-2"><legend>Rad {i+1}</legend>
 <label>Tjänst<select value={row.service} onChange={e=>{const service=e.target.value as InvoiceLineInput['service'];editLine(i,{service,rate:service==='other'?row.rate:String(services[service].rate),description:service==='other'?'':services[service].label});}}>
 <option value="passenger">Persontransport · 6 % moms</option><option value="courier">Bud och godstransport · 25 % moms</option><option value="other">Annan tjänst</option></select></label>
 <label>Beskrivning<input required maxLength={300} value={row.description} onChange={e=>editLine(i,{description:e.target.value})}/></label>
 <label>Antal<input required type="number" min="1" max="999" value={row.quantity} onChange={e=>editLine(i,{quantity:e.target.value})}/></label>
 <label>À-pris inklusive moms (kr)<input required inputMode="decimal" value={row.amount} onChange={e=>editLine(i,{amount:e.target.value})}/></label>
 {row.service==='other'&&<label>Momssats<select value={row.rate} onChange={e=>editLine(i,{rate:e.target.value})}>{[0,6,12,25].map(n=><option key={n} value={n}>{n} %</option>)}</select></label>}
 {row.service==='other'&&row.rate==='0'&&<label>Grund för momsfrihet<input required value={row.vatReason} maxLength={160} onChange={e=>editLine(i,{vatReason:e.target.value})}/></label>}
 {items.length>1&&<button type="button" onClick={()=>editItems(items.filter((_,j)=>j!==i))}>Ta bort rad {i+1}</button>}</fieldset>)}
 <button type="button" disabled={items.length>=25} onClick={()=>editItems([...items,newInvoiceLine()])}>+ Lägg till fakturarad</button></section>
 {field('days','Betalningsvillkor (dagar)',true,'number')}
 {field('sellerAddress','Avenyn Taxis fakturaadress',!optional,'text',250)}{field('sellerVat','Säljarens momsregistreringsnummer')}<p><strong>Bankgiro 5370-4524</strong><br/>Ett kort betalningsmeddelande skapas från fakturans löpnummer.</p>
 </>}</fieldset>{!paidTrip&&Number.isFinite(gross)&&gross>0&&<p>Exkl. moms {sek(gross-vat)} · Moms {sek(vat)} · <strong>Att betala {sek(gross)}</strong></p>}
 {!paidTrip&&totals&&<ul aria-label="Momsspecifikation">{[...new Set(totals.items.map(r=>r.rate))].sort((a,b)=>a-b).map(rate=><li key={rate}>Moms {rate} %: {sek(totals!.items.filter(r=>r.rate===rate).reduce((sum,r)=>sum+r.vat,0))}</li>)}</ul>}
 {paidTrip?null:!review?<><button type="submit" disabled={choosing||reasons.length>0}>Granska faktura</button> <button type="button" disabled={busy} onClick={()=>void saveDraft()}>Spara utkast</button>{editing&&<button type="button" disabled={busy} onClick={resetForm}>Stäng utkast</button>}</>:<div className="bbInfo"><p>Utfärda faktura till <strong>{form.name}</strong> på <strong>{sek(gross)}</strong> med {form.days} dagars betalningsvillkor?</p>{!upcoming&&<button type="button" disabled={busy} onClick={()=>void issue()}>Utfärda utan att skicka</button>} {selectedBooking?.customer_phone&&!editing&&!replacementOf&&<button type="button" disabled={busy} onClick={()=>void smsAction({action:'plan',bookingId:form.bookingId,phone:selectedBooking.customer_phone,payload:{...form,items},version:planVersion})}>{upcoming?'Skicka PDF via SMS när körningen avslutas':'Utfärda och skicka PDF via SMS'} · {selectedBooking.customer_phone}</button>} {!upcoming&&validInvoiceEmail(form.recipientEmail)&&<button type="button" disabled={busy} onClick={()=>void issue(true)}>Utfärda och mejla till {form.recipientEmail}</button>} <button type="button" disabled={busy} onClick={()=>setReview(false)}>Redigera</button></div>}</form></details>
 {feedback&&<p role="status">{feedback}</p>}<h3>Sparade fakturautkast</h3>{drafts.length===0?<p>Inga sparade utkast.</p>:drafts.map(d=><div className="bbCompany" key={d.id}><b>{d.payload.form.name||'Utan kundnamn'} · {d.payload.form.reference||d.payload.form.serviceDate}</b><button disabled={busy} onClick={()=>openDraft(d)}>Redigera</button>{confirmAction===d.id?<><button disabled={busy} onClick={()=>void removeDraft(d)}>Ja, radera utkast</button><button onClick={()=>setConfirmAction('')}>Avbryt</button></>:<button disabled={busy} onClick={()=>setConfirmAction(d.id)}>Radera utkast</button>}</div>)}
 {plans.length>0&&<section><h3>Planerade SMS-fakturor</h3>{plans.map(p=><div className="bbCompany" key={p.booking_id}><div>Bokning #{p.bookings?.booking_number} · {p.payload.name} · {p.recipient}<p>{p.note||(p.state==='processing'?'Behandlas':'Väntar på avslutad körning')}</p></div><button disabled={busy||p.state==='processing'} onClick={()=>{setEditing(null);setReplacementOf('');setPlanVersion(p.updated_at);setForm({...blank(),...p.payload});setItems(p.payload.items);setReview(false);requestId.current='';focusForm();}}>Redigera planering</button><button disabled={busy||p.state==='processing'} onClick={()=>{if(window.confirm('Ta bort det planerade fakturautskicket?'))void smsAction({action:'remove',bookingId:p.booking_id,version:p.updated_at});}}>Radera planering</button></div>)}</section>}
 <h3>Utfärdade fakturor</h3><label>Sök bland de senaste 200 fakturorna<input type="search" placeholder="Fakturanummer, datum eller kund" value={search} onChange={e=>setSearch(e.target.value)}/></label>{matching.length===0?<p>Inga fakturor att visa.</p>:matching.map(i=><div key={i.id} className="bbCompany"><span><b>{invoiceNo(i.serial_no)}</b> · {i.document.name} · {i.issued_on} · {sek(i.gross_ore)}</span><div><button type="button" disabled={busy} onClick={()=>copyInvoice(i)}>Kopiera till ny faktura</button>{i.credited?<><strong>Helkrediterad</strong><button onClick={()=>void pdf(i,false,true)}>Hämta kreditfaktura</button><button disabled={busy} onClick={()=>copyInvoice(i,true)}>Skapa ersättningsfaktura</button></>:<>{confirmAction===i.id?<div><p>Hela faktura {invoiceNo(i.serial_no)} på {sek(i.gross_ore)} krediteras. Originalet sparas.</p><button disabled={busy} onClick={()=>void credit(i)}>Bekräfta helkreditering</button><button onClick={()=>setConfirmAction('')}>Avbryt</button></div>:<button disabled={busy||i.delivery?.state==='pending'} onClick={()=>setConfirmAction(i.id)}>Kreditera / rätta faktura</button>}</>}
 {!i.credited&&<><button disabled={busy} onClick={()=>{const phone=(i.document as any).booking?.phone||bookings.find(b=>b.id===i.booking_id)?.customer_phone||'';setSms({id:i.id,phone,attempt:crypto.randomUUID()});}}>{deliveries.some(d=>d.invoice_id===i.id)?'Skicka PDF via SMS igen':'Skicka PDF via SMS'}</button>
 {deliveries.filter(d=>d.invoice_id===i.id).slice(0,1).map(d=><small key={d.created_at}>Senaste SMS till {d.recipient} · {d.state==='accepted'?'mottaget av SMS-tjänsten':d.state==='rejected'?'nekat':'kontrollera utskicket'}</small>)}
 {sms?.id===i.id&&<form onSubmit={e=>{e.preventDefault();void smsAction({action:'send',...sms});}}><label>Mobilnummer för faktura<input type="tel" required value={sms.phone} onChange={e=>setSms({...sms,phone:e.target.value,attempt:crypto.randomUUID()})}/></label><button disabled={busy}>Skicka fakturalänk</button><button type="button" onClick={()=>setSms(null)}>Avbryt</button></form>}</>}
 {i.credited?null:i.delivery?.state==='accepted'?<p>Mejltjänsten tog emot fakturan till {i.delivery.recipient}.</p>:i.delivery?.state==='pending'?<p>Utskick registrerat till {i.delivery.recipient}. Inväntar bekräftelse.</p>:mail?.id===i.id?<form onSubmit={e=>{e.preventDefault();void sendExisting();}}><label>Mottagarens e-post<input type="email" required maxLength={254} value={mail.recipient} onChange={e=>setMail({...mail,recipient:e.target.value})}/></label><button disabled={busy}>Skicka PDF till kunden</button> <button type="button" disabled={busy} onClick={()=>setMail(null)}>Avbryt</button></form>:<button disabled={busy} onClick={()=>{const linked=links.find(l=>l.booking_id===i.booking_id);const booking=bookings.find(b=>b.id===i.booking_id);setMail({id:i.id,recipient:i.document.recipientEmail||(i.document.kind==='company'?linked?.company?.invoice_email:booking?.customer_email)||''});}}>Mejla faktura</button>}{i.customer_no&&<small>Betalningsreferens: {paymentReference(i)}</small>}{i.document.payment!==invoiceBankgiro?<><strong>Den sparade betalningsuppgiften avviker från bankgiro 5370-4524.</strong><button onClick={()=>void pdf(i,true)}>PDF med rättat bankgiro</button><button onClick={()=>void pdf(i)}>PDF med ursprunglig betalningsuppgift</button></>:<button onClick={()=>void pdf(i)}>Hämta PDF</button>}</div></div>)}
 </section>;
}
