"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import EconomyAutomationPanel from './economy-automation-panel';
import EconomyTools from './economy-tools';
import {payrollTransfer,type PayrollTransfer,type ReceiptTransfer} from '@/lib/economy-transfer';
import type {SupabaseClient} from '@supabase/supabase-js';
import {MONEY_KEYS,netPay,hasPayrollCalculation,missingTaxMessage,payrollEmployer,sek,csv,type PayrollRow,type ReceiptRow} from '@/lib/economy-workspace';

type Driver={id:string;name?:string|null};
type Draft=Record<string,string>;
const labels:Record<string,string>={gross:'Bruttolön',tax:'Skatteavdrag',benefits:'Skattepliktiga förmåner',reimbursement:'Skattefria kostnadsersättningar',advance:'Tidigare förskott / nettoreglering',employerFee:'Arbetsgivaravgifter'};
const statusName={draft:'Utkast',approved:'Godkänd',paid:'Utbetald'};
const baseButton='min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50';
const button=baseButton+' border-slate-300 bg-white text-slate-800';
const primary=baseButton+' border-blue-700 bg-blue-700 text-white';
const input='mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900';
const card='min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
function blank():Draft{return {driver_id:'',payment_date:'',...payrollEmployer,employerAddress:'',employeeIdentity:'',employeeAddress:'',taxBasis:'',notes:'',...Object.fromEntries(MONEY_KEYS.map(k=>[k,['gross','tax','employerFee'].includes(k)?'':'0']))};}
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm'}).format(new Date());
function saveFile(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function Field({label,name,form,setForm,type='text',required=false}:{label:string;name:string;form:Draft;setForm:(value:Draft)=>void;type?:string;required?:boolean}){return <label className="block min-w-0 text-sm font-semibold text-slate-700">{label}<input className={input} name={name} type={type} value={form[name]||''} readOnly={name==='employerName'||name==='employerOrg'} required={required} maxLength={300} onChange={e=>setForm({...form,[name]:e.target.value})}/></label>;}
export default function EconomyWorkspace({supabase,drivers}:{supabase:SupabaseClient;drivers:Driver[]}){
 const [tab,setTab]=useState<'payroll'|'receipts'|'tax'>('payroll');const [month,setMonth]=useState(()=>today().slice(0,7));
 const [rows,setRows]=useState<PayrollRow[]>([]),[paid,setPaid]=useState<PayrollRow[]>([]),[receipts,setReceipts]=useState<ReceiptRow[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[archive,setArchive]=useState(false);
 const [form,setForm]=useState<Draft>(blank),[edit,setEdit]=useState<PayrollRow|null>(null),[showForm,setShowForm]=useState(false);
 const [action,setAction]=useState<{row:PayrollRow;kind:'approve'|'paid'}|null>(null),[confirmed,setConfirmed]=useState(false),[paidDate,setPaidDate]=useState('');
 const [receiptForm,setReceiptForm]=useState<Draft>({expense_date:today(),supplier:'',category:'Drivmedel',amount:'',vat:'0',deductibleVat:'0',note:''});
 const [file,setFile]=useState<File|null>(null);const receiptFormRef=useRef<HTMLFormElement>(null);const reviewRef=useRef<HTMLDivElement>(null);const formRef=useRef<HTMLFormElement>(null);const fileInput=useRef<HTMLInputElement>(null);const requestId=useRef('');const receiptId=useRef('');const generation=useRef(0);
 const request=useCallback(async(path:string,init:RequestInit={})=>{
  let session=(await supabase.auth.getSession()).data.session;
  if(!session)throw new Error('Logga in igen som administratör.');
  const send=(token:string)=>fetch('/api/economy/'+path,{...init,headers:{...init.headers,Authorization:`Bearer ${token}`}});
  let r=await send(session.access_token);
  if(r.status===401){session=(await supabase.auth.refreshSession()).data.session;if(session)r=await send(session.access_token);}
  if(!r.ok){const body=await r.json().catch(()=>({}));throw new Error(body.error||'Kunde inte slutföra åtgärden.');}
  return r;
 },[supabase]);
 const reload=useCallback(async()=>{
  const run=++generation.current;setLoading(true);setError('');
  try{const [p,r]=await Promise.all([request(`payroll?month=${month}`).then(r=>r.json()),request(`receipts?month=${month}`).then(r=>r.json())]);if(run===generation.current){setRows(p.rows);setPaid(p.paid);setReceipts(r.rows);}}
  catch(e){if(run===generation.current){setRows([]);setPaid([]);setReceipts([]);setError((e as Error).message);}}
  finally{if(run===generation.current)setLoading(false);}
 },[month,request]);
 useEffect(()=>{void reload();return()=>{generation.current++;};},[reload]);
 useEffect(()=>{if(action){reviewRef.current?.scrollIntoView({behavior:'smooth',block:'start'});reviewRef.current?.focus({preventScroll:true});}},[action]);
 useEffect(()=>{if(showForm)formRef.current?.scrollIntoView({behavior:'smooth',block:'start'});},[showForm]);
 async function work(task:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await task();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function mutate(path:string,body:unknown,method='POST'){await request(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
 const [autoSalary,setAutoSalary]=useState(false);
 const [autoNote,setAutoNote]=useState('');
 const autoKey=JSON.stringify([form.driver_id,form.payment_date,form.gross,form.benefits]);
 const [calculatedKey,setCalculatedKey]=useState('');
 useEffect(()=>{
   if(!autoSalary||!showForm)return;
   let cancelled=false;
   setCalculatedKey('');
   setForm(current=>({...current,tax:'',employerFee:'',taxBasis:''}));
   const amount=Number(form.gross?.replace(',','.'));
   if(!form.driver_id||!form.payment_date||!(amount>0)){
     setAutoNote('Välj förare och ange utbetalningsdatum och bruttolön.');return;
   }
   if(!form.payment_date.startsWith('2026-')||Number((form.benefits||'0').replace(',','.'))!==0){
     setAutoNote('Automatiken gäller 2026 och kontant bruttolön. För annat år eller skattepliktiga förmåner, ange kontrollerade belopp manuellt.');return;
   }
   setAutoNote('Hämtar löneförslag från förarens skatteprofil…');
   const timer=setTimeout(async()=>{
     try{
       const {data,error}=await supabase.rpc('avenyn_ekonomi_forare_loneforslag_2026',{
         p_forare_id:form.driver_id,p_utbetalningsdatum:form.payment_date,p_bruttolon_kr:amount
       });
       if(error)throw error;
       const result=payrollTransfer(data,form.driver_id,form.payment_date);
       if(cancelled)return;
       setForm(current=>({...current,tax:result.tax,employerFee:result.employerFee,taxBasis:result.taxBasis}));
       setCalculatedKey(autoKey);setAutoNote('Skatteavdrag och arbetsgivaravgift har fyllts i.');
     }catch{if(!cancelled)setAutoNote('Förarprofilen saknar ett användbart skatteunderlag. Öppna Beräkna lön från brutto eller netto och ange uppgifterna från skattebeslutet.');}
   },450);
   return ()=>{cancelled=true;clearTimeout(timer)};
 },[autoKey,autoSalary,showForm,supabase]);
 function openDraft(row?:PayrollRow){
  setAutoSalary(!row);setCalculatedKey('');setAutoNote('');
  requestId.current=row?.id||crypto.randomUUID();setEdit(row||null);setShowForm(true);setNotice('');setError('');
  setForm(row?{...Object.fromEntries(Object.entries(row.details).map(([k,v])=>[k,String(v)])),...Object.fromEntries(MONEY_KEYS.map(k=>[k,Number.isFinite(row.details[k])?(row.details[k]/100).toFixed(2):''])),...payrollEmployer,driver_id:row.driver_id,payment_date:row.payment_date}:blank());
 }
 function acceptPayroll(value:PayrollTransfer){
  if(busy||showForm||action||file||receiptForm.supplier||receiptForm.amount)return;
  setAutoSalary(false);requestId.current=crypto.randomUUID();setEdit(null);setTab('payroll');setArchive(false);setMonth(value.paymentDate.slice(0,7));
  setForm({...blank(),driver_id:value.driverId,payment_date:value.paymentDate,gross:value.gross,tax:value.tax,employerFee:value.employerFee,taxBasis:value.taxBasis});setShowForm(true);
  setNotice('Löneförslaget har fyllt i utkastet. Kontrollera löneperioden och komplettera uppgifterna före sparande.');
 }
 function acceptReceipt(value:ReceiptTransfer){
  if(busy||showForm||action||file||receiptForm.supplier||receiptForm.amount)return;
  receiptId.current=crypto.randomUUID();setFile(value.file);setTab('receipts');setArchive(false);setMonth(value.expenseDate.slice(0,7));
  setReceiptForm({expense_date:value.expenseDate,supplier:value.supplier,category:value.category,amount:value.amount,vat:value.vat,deductibleVat:'0',note:value.note});
  setNotice('Kvittot och de kontrollerade uppgifterna är överförda. Kontrollera momsavdraget och spara kvittot.');
 }
 useEffect(()=>{if(tab==='receipts'&&file)receiptFormRef.current?.scrollIntoView({behavior:'smooth',block:'start'});},[tab,file]);
 async function submitPayroll(e:FormEvent){e.preventDefault();if(autoSalary&&autoKey!==calculatedKey)return;await work(async()=>{await mutate('payroll',{...form,id:requestId.current,period:month,...(edit?{revision:edit.revision}:{})});setShowForm(false);setEdit(null);await reload();setNotice('Löneutkastet är sparat. Öppna det för kontroll och godkännande.');});}
 async function download(kind:'payroll'|'receipt',id:string){await work(async()=>{const r=await request(`document?kind=${kind}&id=${id}`);const blob=await r.blob();saveFile(blob,`${kind==='payroll'?'lonebesked':'kvitto'}-${id.slice(0,8)}.${blob.type==='application/pdf'?'pdf':blob.type==='image/png'?'png':'jpg'}`);});}
 async function submitReceipt(e:FormEvent){e.preventDefault();await work(async()=>{
  if(!file)throw new Error('Välj ett kvitto.');if(file.size>10485760)throw new Error('Kvittot får vara högst 10 MB.');
  if(!receiptId.current)receiptId.current=crypto.randomUUID();const data=new FormData();for(const [k,v] of Object.entries(receiptForm))data.set(k,v);data.set('id',receiptId.current);data.set('file',file);
  await request('receipts',{method:'POST',body:data});receiptId.current='';setFile(null);if(fileInput.current)fileInput.current.value='';setReceiptForm({...receiptForm,supplier:'',amount:'',vat:'0',deductibleVat:'0',note:''});await reload();setNotice('Kvittot är sparat. Det visas i månaden som kvittodatumet tillhör.');
 });}
 const activeReceipts=receipts.filter(r=>!r.archived_at),activeRows=rows.filter(r=>!r.archived_at);
 const total=(key:'amount_ore'|'vat_ore'|'deductible_vat_ore')=>activeReceipts.reduce((sum,r)=>sum+Number(r[key]),0);
 const sumPaid=(key:typeof MONEY_KEYS[number])=>paid.reduce((sum,r)=>sum+r.details[key],0);
 function exportTax(){
  saveFile(new Blob([csv([['MANUELLT KONTROLLUNDERLAG – INTE EN AGI-IMPORTFIL'],['Utbetalningsmånad',month],['Arbetsgivare','Org.nr','Anställd','Person-/samordningsnummer','Löneperiod','Utbetalningsdatum','Bruttolön kr','Förmåner kr','Skatteavdrag kr','Arbetsgivaravgifter kr','Kostnadsersättningar kr','Förskott/nettoreglering kr','Att betala ut kr','Övriga upplysningar'],...paid.map(r=>[r.details.employerName,r.details.employerOrg,r.employee_name,r.details.employeeIdentity,r.period,r.payment_date,...(['gross','benefits','tax','employerFee','reimbursement','advance'] as const).map(k=>(r.details[k]/100).toFixed(2)),(netPay(r.details)/100).toFixed(2),r.details.notes])])],{type:'text/csv;charset=utf-8'}),`skatteunderlag-${month}.csv`);
 }
 function exportCosts(){saveFile(new Blob([csv([['Kvitton och kostnader – kontrollunderlag',month],['Datum','Leverantör','Kategori','Belopp inkl moms kr','Moms på kvitto kr','Manuellt angiven avdragsgill moms kr','Anteckning'],...activeReceipts.map(r=>[r.expense_date,r.supplier,r.category,(r.amount_ore/100).toFixed(2),(r.vat_ore/100).toFixed(2),(r.deductible_vat_ore/100).toFixed(2),r.note])])],{type:'text/csv;charset=utf-8'}),`kostnader-${month}.csv`);}
 return <section aria-label="Löner och kvitton" className="min-w-0 space-y-4" aria-busy={busy||loading}>
  <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-xl font-bold">Löner & kvitton</h3><p className="text-sm text-slate-600">Samlat underlag för företagets ekonomi</p></div><label className="text-sm font-semibold">Månad<input aria-label="Rapportmånad" type="month" className={input} value={month} disabled={busy||showForm||!!action} onChange={e=>{if(e.target.value){setMonth(e.target.value);setNotice('');}}}/></label></div>
  <nav aria-label="Löner och kostnader" className="grid grid-cols-1 gap-2 sm:grid-cols-3">{([['payroll','Löner'],['receipts','Kvitton & kostnader'],['tax','Skatteunderlag']] as const).map(([key,label])=><button type="button" key={key} disabled={busy||showForm||!!action} aria-pressed={tab===key} className={tab===key?primary:button} onClick={()=>{setTab(key);setArchive(false);}}>{label}</button>)}</nav>
  {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}{notice&&<p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-green-800">{notice}</p>}
  {loading&&<p role="status">Hämtar sparade uppgifter…</p>}
  <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy||loading} onClick={()=>void reload()}>Uppdatera lista</button>{tab!=='tax'&&<button type="button" className={button} disabled={busy} onClick={()=>setArchive(!archive)}>{archive?'Visa aktiva':'Visa arkiverade'}</button>}</div>
  {tab==='payroll'&&<>
   <p className="text-sm text-slate-600">Ange kontrollerad bruttolön, skatt och arbetsgivaravgifter. Löne- och skattehjälpen nedan kan fylla i beloppen automatiskt. Godkännande låser underlaget. Utbetalning görs i din bank.</p>
   {!showForm&&<button type="button" className={primary} disabled={busy||loading} onClick={()=>openDraft()}>+ Ny lön för {month}</button>}
   {showForm&&<details className={card}><summary className="cursor-pointer font-semibold">Beräkna lön från brutto eller netto</summary>
    <EconomyAutomationPanel supabase={supabase} drivers={drivers.filter(d=>!form.driver_id||d.id===form.driver_id).map(d=>({id:d.id,full_name:d.name||'Namn saknas'}))}
      transferBlocked={busy} onPayroll={value=>{
        setAutoSalary(false);
        if(form.driver_id&&form.driver_id!==value.driverId)throw new Error('Välj samma förare som i utkastet.');
        setForm(current=>({...current,driver_id:value.driverId,payment_date:value.paymentDate,gross:value.gross,tax:value.tax,employerFee:value.employerFee,taxBasis:value.taxBasis}));
        setNotice('Beräkningen är överförd. Kontrollera löneperioden innan du sparar.');
      }}/>
   </details>}
   {showForm&&<form ref={formRef} onSubmit={submitPayroll} className={card}><fieldset disabled={busy} className="space-y-4"><legend className="mb-3 text-lg font-bold">{edit?'Redigera löneutkast':'Nytt löneutkast'}</legend>
    <label className="flex gap-2"><input type="checkbox" checked={autoSalary} onChange={e=>setAutoSalary(e.target.checked)}/>Beräkna automatiskt med förarens skatteprofil</label>
    {autoSalary&&<p role="status">{autoNote}</p>}
    <label className="block text-sm font-semibold">Löneperiod<input className={input} type="month" required value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value);}}/></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Förare<select className={input} required value={form.driver_id} onChange={e=>setForm({...form,driver_id:e.target.value})}><option value="">Välj förare</option>{Array.from(new Map(drivers.map(d=>[d.id,d])).values()).map(d=><option key={d.id} value={d.id}>{d.name||'Namn saknas'}</option>)}</select></label><Field label="Planerat utbetalningsdatum" name="payment_date" type="date" form={form} setForm={setForm} required/>
    {MONEY_KEYS.map(k=><label key={k} className="text-sm font-semibold">{labels[k]} (kr)<input className={input} inputMode="decimal" required readOnly={autoSalary&&(k==='tax'||k==='employerFee')} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}</div>
    {(!form.tax?.trim()||!form.employerFee?.trim()||!form.taxBasis?.trim())&&<p role="status">{missingTaxMessage}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{[['employerName','Arbetsgivarens juridiska namn'],['employerOrg','Organisationsnummer'],['employerAddress','Arbetsgivarens adress'],['employeeIdentity','Person-/samordningsnummer (12 siffror)'],['employeeAddress','Den anställdes adress'],['taxBasis','Skatteunderlag, t.ex. tabell/kolumn eller beslut'],['taxZeroReason','Skäl vid noll kronor i skatt'],['employerFeeExemptionReason','Skäl vid avgiftsbefrielse']] .map(([key,label])=><Field key={key} name={key} label={label} form={form} setForm={setForm}/>)}</div>
    <label className="block text-sm font-semibold">Övertid, frånvaro, semester och andra upplysningar<textarea className={input} maxLength={2000} rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
    <div className="flex flex-wrap gap-2"><button className={primary} type="submit" disabled={autoSalary&&autoKey!==calculatedKey}>Spara utkast</button><button className={button} type="button" onClick={()=>setShowForm(false)}>Avbryt</button></div>
   </fieldset></form>}
   <div className="grid gap-3 lg:grid-cols-2">{rows.filter(r=>!!r.archived_at===archive).map(r=><article key={r.id} className={card}>
    <div className="flex flex-wrap justify-between gap-2"><h4 className="font-bold">{r.employee_name}</h4><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">{r.archived_at?'Arkiverad':statusName[r.status]}</span></div>
    <p className="mt-2 text-sm text-slate-600">Löneperiod {r.period} · Utbetalningsdatum {r.payment_date}</p><p className="mt-3 text-2xl font-bold">{hasPayrollCalculation(r.details)?sek(netPay(r.details)):missingTaxMessage}</p><p className="text-sm text-slate-600">Att betala ut · Brutto {sek(r.details.gross)} · Skatt {hasPayrollCalculation(r.details)?sek(r.details.tax):missingTaxMessage}</p>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} className={button} onClick={()=>void download('payroll',r.id)}>{r.status==='draft'?'Underlag PDF':'Lönebesked PDF'}</button>
    {!archive&&r.status==='draft'&&<><button type="button" className={button} disabled={busy||showForm} onClick={()=>openDraft(r)}>Redigera</button><button type="button" className={primary} disabled={busy||showForm} onClick={()=>void work(async()=>{
      const {data,error}=await supabase.rpc('avenyn_ekonomi_loneutkast_kontroll',{p_payroll_id:r.id});
      if(error)throw new Error('Lönekontrollen kunde inte genomföras.');
      if(data?.kan_godkannas!==true)throw new Error((data?.fel||[]).join(' · ')||'Utkastet behöver kompletteras.');
      setAction({row:r,kind:'approve'});setConfirmed(false);
    })}>Granska & godkänn</button></>}
    {!archive&&r.status==='approved'&&<button type="button" className={button} disabled={busy} onClick={()=>{setAction({row:r,kind:'paid'});setPaidDate(r.payment_date);setConfirmed(false);}}>Registrera utbetalning</button>}
    {r.status==='draft'&&<button type="button" className={button} disabled={busy||showForm} onClick={()=>void work(async()=>{await mutate('payroll',{id:r.id,revision:r.revision,action:archive?'restore':'archive'},'PATCH');await reload();})}>{archive?'Återställ':'Arkivera'}</button>}
    </div></article>)}</div>
   {!loading&&!rows.some(r=>!!r.archived_at===archive)&&<p className={card}>Inga {archive?'arkiverade':'sparade'} löner för månaden.</p>}
   {action&&<div ref={reviewRef} tabIndex={-1} role="region" aria-label="Granska lön" className={card+' border-blue-300'}><h4 className="text-lg font-bold">{action.kind==='approve'?'Godkänn och lås lön':'Registrera genomförd betalning'} – {action.row.employee_name}</h4><p className="my-3 font-bold">Att betala ut: {sek(netPay(action.row.details))}</p>
    <dl className="grid gap-2 sm:grid-cols-2">{MONEY_KEYS.map(k=><div key={k}><dt className="text-sm text-slate-500">{labels[k]}</dt><dd className="font-semibold">{sek(action.row.details[k])}</dd></div>)}</dl>
    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{([['Arbetsgivare',action.row.details.employerName],['Organisationsnummer',action.row.details.employerOrg],['Arbetsgivaradress',action.row.details.employerAddress],['Person-/samordningsnummer',action.row.details.employeeIdentity],['Anställds adress',action.row.details.employeeAddress],['Skatteunderlag',action.row.details.taxBasis],['Utbetalningsdatum',action.row.payment_date],['Övriga upplysningar',action.row.details.notes]]).map(([label,value])=><div key={label}><dt className="text-slate-500">{label}</dt><dd className="break-words">{value||'Ej angivet'}</dd></div>)}</dl>
    {action.kind==='paid'&&<label className="mt-4 block text-sm font-semibold">Faktiskt utbetalningsdatum<input className={input} type="date" max={today()} value={paidDate} onChange={e=>setPaidDate(e.target.value)}/></label>}
    <label className="my-4 flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{action.kind==='approve'?'Jag har kontrollerat lönebeskedets samtliga uppgifter, skatteavdrag och arbetsgivaravgifter. Underlaget låses efter godkännandet.':'Jag bekräftar att lönen faktiskt har betalats ut via banken på angivet datum. Detta gör ingen banköverföring.'}</label>
    <div className="flex flex-wrap gap-2"><button className={primary} type="button" disabled={busy||!confirmed} onClick={()=>void work(async()=>{await mutate('payroll',{id:action.row.id,revision:action.row.revision,action:action.kind,confirmed,payment_date:paidDate},'PATCH');setAction(null);await reload();setNotice('Lönens status har uppdaterats.');})}>{action.kind==='approve'?'Godkänn och lås':'Markera som utbetald'}</button><button type="button" className={button} disabled={busy} onClick={()=>setAction(null)}>Avbryt</button></div>
   </div>}
  </>}
  {tab==='receipts'&&<>
   <div className="grid gap-3 sm:grid-cols-3">{[['Kostnader inkl. moms',total('amount_ore')],['Moms enligt kvitton',total('vat_ore')],['Angiven avdragsgill moms',total('deductible_vat_ore')]].map(([name,value])=><div key={name} className={card}><p className="text-sm text-slate-500">{name}</p><p className="text-xl font-bold">{sek(Number(value))}</p></div>)}</div>
   <form ref={receiptFormRef} className={card} onSubmit={submitReceipt}><fieldset className="space-y-4" disabled={busy}><legend className="mb-3 text-lg font-bold">Ladda upp kvitto</legend><p className="text-sm text-slate-600">Välj bild/PDF eller ta ett foto med mobilens filväljare. Fyll i beloppen från kvittot. Du kan också läsa kvittot automatiskt med ”Läs kvitto” nedan och föra över uppgifterna hit.</p>
    <label className="block text-sm font-semibold">Kvitto (JPG, PNG eller PDF, högst 10 MB)<input ref={fileInput} className={input} type="file" required={!file} accept="image/jpeg,image/png,application/pdf" onChange={e=>{setFile(e.target.files?.[0]||null);receiptId.current='';}}/></label>
    {file&&<p className="text-sm font-semibold">Valt original: {file.name}</p>}
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Kvittodatum" name="expense_date" type="date" form={receiptForm} setForm={setReceiptForm} required/><Field label="Leverantör" name="supplier" form={receiptForm} setForm={setReceiptForm} required/>
    <label className="text-sm font-semibold">Kategori<select className={input} value={receiptForm.category} onChange={e=>setReceiptForm({...receiptForm,category:e.target.value})}>{['Drivmedel','Laddning','Service & reparation','Parkering','Försäkring','Leasing','Utrustning','Kontorsmaterial','Förbrukningsmaterial','Telefoni','Övrigt'].map(k=><option key={k}>{k}</option>)}</select></label>
    {[['amount','Totalt inklusive moms'],['vat','Moms enligt kvittot'],['deductibleVat','Avdragsgill moms, kontrollerat belopp']].map(([key,label])=><label key={key} className="text-sm font-semibold">{label} (kr)<input className={input} inputMode="decimal" required value={receiptForm[key]} onChange={e=>setReceiptForm({...receiptForm,[key]:e.target.value})}/></label>)}</div>
    <p className="text-sm text-slate-500">Avdragsgill moms är 0 kr tills du anger ett kontrollerat belopp. Beloppet räknas inte automatiskt utifrån kategori.</p>
    <Field label="Anteckning / bilens registreringsnummer" name="note" form={receiptForm} setForm={setReceiptForm}/><button type="submit" className={primary}>Spara kvitto</button>{(file||receiptForm.supplier||receiptForm.amount)&&<button type="button" className={button} onClick={()=>{setFile(null);receiptId.current='';if(fileInput.current)fileInput.current.value='';setReceiptForm({expense_date:today(),supplier:'',category:'Drivmedel',amount:'',vat:'0',deductibleVat:'0',note:''});setNotice('');}}>Avbryt kvitto</button>}
   </fieldset></form>
   <button type="button" className={button} disabled={loading||busy||!activeReceipts.length} onClick={exportCosts}>Ladda ner månadens kostnader (CSV)</button>
   <div className="grid gap-3 lg:grid-cols-2">{receipts.filter(r=>!!r.archived_at===archive).map(r=><article key={r.id} className={card}><h4 className="font-bold">{r.supplier}</h4><p className="text-sm text-slate-500">{r.expense_date} · {r.category}</p><p className="my-2 text-xl font-bold">{sek(r.amount_ore)}</p><p className="text-sm">Moms {sek(r.vat_ore)} · Avdragsgill {sek(r.deductible_vat_ore)}</p>{r.note&&<p className="mt-2 break-words text-sm">{r.note}</p>}<div className="mt-3 flex flex-wrap gap-2"><button className={button} type="button" disabled={busy} onClick={()=>void download('receipt',r.id)}>Hämta kvitto</button><button className={button} type="button" disabled={busy} onClick={()=>void work(async()=>{await mutate('receipts',{id:r.id,action:archive?'restore':'archive'},'PATCH');await reload();})}>{archive?'Återställ':'Arkivera'}</button></div></article>)}</div>
   {!loading&&!receipts.some(r=>!!r.archived_at===archive)&&<p className={card}>Inga {archive?'arkiverade':'sparade'} kvitton för månaden.</p>}
  </>}
  {tab==='tax'&&<>
   <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><h4 className="font-bold">Skatteverket: inte anslutet</h4><p className="mt-1 text-sm">Här skapas kontrollunderlag för manuell redovisning. Ingenting skickas till Skatteverket. CSV-filen är inte en AGI-fil som kan laddas upp i e-tjänsten.</p></div>
   <h4 className="font-bold">Registrerade utbetalningar under {month}</h4><p className="text-sm text-slate-600">Urvalet följer utbetalningsdatum, inte löneperiod. Utkast och löner som inte är markerade som utbetalda ingår inte. Kontrollera även förmåner, frånvaro och eventuella ersättningar utanför detta system.</p>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Bruttolön',sumPaid('gross')],['Förmåner',sumPaid('benefits')],['Skatteavdrag',sumPaid('tax')],['Arbetsgivaravgifter',sumPaid('employerFee')]].map(([name,value])=><div key={name} className={card}><p className="text-sm text-slate-500">{name}</p><p className="text-xl font-bold">{sek(Number(value))}</p></div>)}</div>
   <p className="text-sm">{paid.length} lönebesked i utbetalningsmånaden. {activeRows.filter(r=>r.status!=='paid').length} underlag i vald löneperiod är ännu inte markerade som utbetalda.</p>
   <button type="button" className={primary} disabled={busy||loading||!paid.length} onClick={exportTax}>Ladda ner skatteunderlag (CSV)</button>
   <div className="grid gap-3 lg:grid-cols-2">{paid.map(r=><article className={card} key={r.id}><h4 className="font-bold">{r.employee_name}</h4><p className="text-sm">Utbetalningsdatum {r.payment_date} · Löneperiod {r.period}</p><p>Brutto {sek(r.details.gross)} · Skatt {hasPayrollCalculation(r.details)?sek(r.details.tax):missingTaxMessage}</p></article>)}</div>
  </>}
 <EconomyTools supabase={supabase} drivers={drivers} onPayroll={acceptPayroll} onReceipt={acceptReceipt} transferBlocked={busy||showForm||!!action||!!file||!!receiptForm.supplier||!!receiptForm.amount}/>
 </section>;
}
