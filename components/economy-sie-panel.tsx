"use client";
import { useRef, useState } from 'react';
import { decodeSIE, parseSIE4, type SIEPreview } from './sie4-preview';
export default function EconomySIEPanel() {
 const [result,setResult]=useState<SIEPreview|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);const generation=useRef(0);
 async function read(file?:File){const id=++generation.current;setResult(null);setError('');if(!file)return;
  if(file.size===0||file.size>15*1024*1024){setError('Välj en SIE-fil på högst 15 MB.');return;}setBusy(true);
  try{const parsed=parseSIE4(decodeSIE(new Uint8Array(await file.arrayBuffer())),file.name);if(id===generation.current)setResult(parsed);}catch{if(id===generation.current)setError('Filen kunde inte läsas. Välj en SIE4-export.');}finally{if(id===generation.current)setBusy(false);}}
 const mismatch=result?.organizationNumber?.replace(/\D/g,'')!=='5565974796';
 return <section aria-label="SIE4-förhandsgranskning" aria-busy={busy} className="min-w-0 space-y-4 rounded-xl border bg-white p-4">
  <h3 className="text-xl font-bold">SIE4 · granska fil</h3>
  <p className="text-sm text-slate-600">Filen läses enbart i din webbläsare. Ingen import eller bokföring görs. Kontrollen granskar filstruktur och balans, inte riktigheten i bokföringen.</p>
  <label className="block text-sm font-semibold">SIE4-fil (högst 15 MB)<input className="mt-2 block w-full rounded-lg border p-3" type="file" accept=".se,.si,.sie,.txt" disabled={busy} onChange={e=>void read(e.target.files?.[0])}/></label>
  {busy&&<p role="status">Läser filen…</p>}{error&&<p role="alert" className="text-red-700">{error}</p>}
  {result&&<><dl className="grid gap-3 sm:grid-cols-2">{[['Fil',result.filename],['Företag',result.companyName||'Saknas'],['Organisationsnummer',result.organizationNumber||'Saknas'],['Period',result.fiscalYear?`${result.fiscalYear.start} – ${result.fiscalYear.end}`:'Saknas'],['Konton',result.accounts.length],['Verifikationer',result.vouchers.length],['Obalanserade',result.vouchers.filter(v=>!v.balanced).length]].map(([label,value])=><div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="break-words font-semibold">{value}</dd></div>)}</dl>
   {mismatch&&<p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-900">Organisationsnumret saknas eller skiljer sig från Citra Trans och Bilservice AB (556597-4796).</p>}
   <p className="font-semibold">{result.safeToConsiderForImport&&!mismatch?'Inga struktur- eller balansfel hittades i de kontrollerade posterna.':'Filen kräver manuell granskning.'}</p>
   <ul className="space-y-2 text-sm text-amber-900">{[...result.warnings,...result.vouchers.flatMap(v=>v.issues.map(i=>`${v.series}${v.number}: ${i}`))].slice(0,30).map((warning,i)=><li key={i}>{warning}</li>)}</ul>
   <p className="text-xs text-slate-500">Högst 30 kontrollmeddelanden visas.</p>
  </>}
  <p className="rounded-xl bg-slate-100 p-3 text-sm"><strong>Bokföringsdelen är inte aktiverad.</strong> Verifikationer, periodlås och import blir tillgängliga först efter separat databasgranskning och test.</p>
 </section>;
}
