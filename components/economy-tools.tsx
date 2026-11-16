"use client";
import { lazy, Suspense, useState } from 'react';
import type { PayrollTransfer, ReceiptTransfer } from '@/lib/economy-transfer';
import type { SupabaseClient } from '@supabase/supabase-js';
const Review = lazy(() => import('./economy-payroll-review-panel'));
const Automation = lazy(() => import('./economy-automation-panel'));
const Receipts = lazy(() => import('./economy-receipt-ocr-panel'));
const SIE = lazy(() => import('./economy-sie-panel'));
export default function EconomyTools({supabase, drivers, onPayroll, onReceipt, transferBlocked = false}: {supabase: SupabaseClient; drivers: {id:string;name?:string|null}[]; onPayroll?: (value:PayrollTransfer)=>void; onReceipt?: (value:ReceiptTransfer)=>void; transferBlocked?:boolean}) {
 const [tab,setTab] = useState<'salary'|'ocr'|'sie'|'review'|null>(null);
 const options = Array.from(new Map(drivers.map(d=>[d.id,{id:d.id,full_name:d.name || 'Namn saknas'}])).values());
 return <section className="min-w-0 space-y-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-3 sm:p-5" aria-label="Ekonomiverktyg">
  <div><h3 className="text-xl font-bold">Beräkna & granska</h3><p className="text-sm text-slate-600">Löneförslag, kvittotolkning och lokal kontroll av SIE-filer.</p></div>
  <nav className="flex flex-wrap gap-2" aria-label="Välj ekonomiverktyg">{([['review','Löner & kontroll'],['salary','Löne- och skattehjälp'],['ocr','Läs kvitto'],['sie','SIE4-granskning']] as const).map(([key,title])=><button type="button" key={key} aria-pressed={tab===key} onClick={()=>setTab(key)} className={'min-h-11 rounded-xl border px-4 py-2 font-semibold '+(tab===key?'border-blue-700 bg-blue-700 text-white':'border-slate-300 bg-white text-slate-800')}>{title}</button>)}</nav>
  <Suspense fallback={<p role="status">Öppnar verktyget…</p>}>
   {tab==='review'&&<Review supabase={supabase} onOpenCalculator={()=>setTab('salary')}/>}
   {tab==='salary'&&<Automation supabase={supabase} drivers={options} onPayroll={onPayroll} transferBlocked={transferBlocked}/>}
   {tab==='ocr'&&<Receipts supabase={supabase} onReceipt={onReceipt} transferBlocked={transferBlocked}/>}
   {tab==='sie'&&<SIE/>}
  </Suspense>
 </section>;
}
