"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import styles from "./page.module.css";

type Receipt = {
  id: string;
  expense_date: string;
  supplier: string;
  category: string;
  amount_ore: number;
  vat_ore: number;
  deductible_vat_ore: number;
  file_name: string;
  created_at: string;
  vat_suggestion: Suggestion | null;
};
type Suggestion = {
  suggested_vat_ore: number | null;
  suggested_deductible_vat_ore: number | null;
  suggested_expense_account: string | null;
  expense_ore_after_vat_deduction: number | null;
  review_required: boolean;
  review_flags: string[];
};
type Candidate = {
  bank_id: string;
  date: string;
  amount_ore: number;
  description: string;
  reference: string;
  linked_receipt_id: string | null;
  already_reconciled: boolean;
};
type LedgerReview = {
  receipt: {
    id: string;
    vat_ore: number;
    deductible_vat_ore: number;
    amount_ore: number;
  };
  bank_date: string;
  bank_code: string;
  accounts: {code: string;name: string}[];
  entry?: {id: string;version: number;status: string;account: string;vat_minor: number} | null;
};
type ReceiptForm = {
  supplier: string;
  expense_date: string;
  category: string;
  amount: string;
  vat: string;
  deductible: string;
  rate: string;
  businessUse: string;
  note: string;
};
type Json = Record<string, unknown>;
const categories = ["Drivmedel", "Reparation", "Tvätt", "Däck", "Förbrukningsmaterial", "Försäkring", "Leasing", "Övrigt"];
const money = (ore: number | null | undefined) => ore == null ? "–" :
  new Intl.NumberFormat("sv-SE", {style:"currency",currency:"SEK"}).format(ore / 100);
const parseKr = (value: string): number => {
  const trimmed = value.replace(/\s/g, "");
  const normalized = trimmed.includes(",") ?
    trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw Error("Ange ett giltigt belopp i kronor, exempelvis 1000,00.");
  const n = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(n) || n < 0 || n > 100000000) throw Error("Beloppet ligger utanför tillåtet intervall.");
  return n;
};
const asKr = (ore: number | null | undefined) => ore == null ? "" : (ore / 100).toFixed(2).replace(".", ",");
const errorText = (reason: string) => ({
  admin_access_required: "Du måste vara aktiv trafikledningsadministratör för att se ekonomin.",
  login_required: "Logga in igen.",
  duplicate_file: "Det här kvittot har redan laddats upp.",
  bank_link_required: "Matcha kvittot mot rätt bankbetalning först.",
  account_requires_manual_review: "Kontot behöver granskas av redovisningsansvarig.",
  pdf_ocr_not_configured: "PDF kan laddas upp, men automatisk PDF-avläsning är ännu inte inkopplad.",
  image_ocr_not_configured: "Bildavläsning behöver en konfigurerad OCR-tjänst. Fyll i uppgifterna manuellt.",
} as Record<string,string>)[reason] ?? reason;
const emptyForm = (): ReceiptForm => ({
  supplier:"",expense_date:new Date().toLocaleDateString("sv-SE",{
    year:"numeric",month:"2-digit",day:"2-digit"
  }),category:"Drivmedel",amount:"",vat:"",deductible:"",
  rate:"25",businessUse:"100",note:""
});
function labelText(value: string) {
  switch(value) {
    case "vat_estimated_from_category_verify_against_receipt": return "Momsen är uppskattad utifrån kategori – kontrollera originalkvittot.";
    case "business_use_must_be_verified": return "Kontrollera att inköpet används i verksamheten.";
    case "category_needs_manual_classification": return "Kategorin behöver bedömas manuellt.";
    case "document_and_rate_disagree_or_mixed_receipt": return "Kvittots moms stämmer inte med en enda momssats – kontrollera eventuell blandad moms.";
    case "manual_approval_required_before_bookkeeping": return "Manuellt godkännande krävs.";
    case "deduction_cannot_be_determined": return "Avdragsrätten kan inte fastställas automatiskt.";
    case "vat_on_normally_exempt_category_review_required": return "Moms på normalt momsbefriad kategori – granska.";
    default: return value.replaceAll("_"," ");
  }
}

export default function ReceiptsPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const supabase = useMemo(() => url && anon ? createClient(url,anon,{
    auth:{persistSession:true,autoRefreshToken:true}
  }) : null,[url,anon]);
  const [session,setSession] = useState<Session | null>(null);
  const [authReady,setAuthReady] = useState(false);
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const [failure,setFailure] = useState("");
  const [adminOk,setAdminOk] = useState(false);
  const [imageOcr,setImageOcr] = useState(false);
  const [file,setFile] = useState<File | null>(null);
  const [form,setForm] = useState<ReceiptForm>(emptyForm);
  const [ocrText,setOcrText] = useState("");
  const [ocrStatus,setOcrStatus] = useState("");
  const [receipts,setReceipts] = useState<Receipt[]>([]);
  const [selectedId,setSelectedId] = useState("");
  const [suggestion,setSuggestion] = useState<Suggestion | null>(null);
  const [candidates,setCandidates] = useState<Candidate[]>([]);
  const [bankId,setBankId] = useState("");
  const [review,setReview] = useState<LedgerReview | null>(null);
  const [account,setAccount] = useState("5611");
  const [approvedVat,setApprovedVat] = useState("");
  const [approvedChecked,setApprovedChecked] = useState(false);

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    let mounted = true;
    supabase.auth.getSession().then(({data}) => {
      if(mounted) {setSession(data.session);setAuthReady(true);}
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,next) => {
      if(mounted) {setSession(next);setAuthReady(true);}
    });
    return () => {mounted=false;subscription.unsubscribe();};
  },[supabase]);

  const api = useCallback(async (action: string, data: Json = {}, upload?: File): Promise<Json> => {
    if (!supabase || !url || !anon) throw Error("Supabase-inställningar saknas.");
    const {data:{session:active}} = await supabase.auth.getSession();
    if (!active?.access_token) throw Error("login_required");
    let body: string | FormData;
    const headers: Record<string,string> = {
      Authorization:"Bearer " + active.access_token, apikey:anon
    };
    if(upload) {
      const formData = new FormData();
      formData.append("action",action);
      formData.append("file",upload,upload.name);
      for(const [key,value] of Object.entries(data)) formData.append(key,String(value));
      body=formData;
    } else {
      headers["Content-Type"]="application/json";
      body=JSON.stringify({action,...data});
    }
    const response = await fetch(url.replace(/\/$/,"") + "/functions/v1/finance-receipts-admin",{
      method:"POST",headers,body,cache:"no-store"
    });
    const answer: Json = await response.json().catch(() => ({error:"Svar från servern kunde inte läsas."}));
    if(!response.ok || answer.ok !== true) throw Error(errorText(String(answer.error ?? "serverfel")));
    return answer;
  },[supabase,url,anon]);

  const load = useCallback(async () => {
    const response = await api("list");
    setReceipts((response.receipts as Receipt[]) ?? []);
  },[api]);

  useEffect(() => {
    if(!session || !supabase) {setAdminOk(false);return;}
    let cancelled=false;
    (async () => {
      try {
        const health = await api("health");
        if(cancelled) return;
        setAdminOk(true);
        setImageOcr(Boolean(health.image_ocr_configured));
        setFailure("");
        await load();
      } catch(e) {
        if(!cancelled) {setAdminOk(false);setFailure(errorText(String(e instanceof Error ? e.message : e)));}
      }
    })();
    return ()=>{cancelled=true;};
  },[session,supabase,api,load]);

  const chosen = receipts.find((r)=>r.id===selectedId) ?? null;
  useEffect(() => {
    if(!selectedId || !adminOk) return;
    let cancelled=false;
    setReview(null);
    setApprovedChecked(false);
    (async()=>{
      try {
        const [preview, matches] = await Promise.all([
          api("preview",{receipt_id:selectedId}),
          api("candidates",{receipt_id:selectedId})
        ]);
        if(cancelled) return;
        setSuggestion((preview.suggestion as Suggestion) ?? null);
        const rows=(matches.candidates as Candidate[]) ?? [];
        setCandidates(rows);
        setBankId(rows.find((r)=>r.linked_receipt_id===selectedId)?.bank_id ?? "");
      } catch(e) {
        if(!cancelled) setFailure(String(e instanceof Error ? e.message : e));
      }
    })();
    return ()=>{cancelled=true;};
  },[selectedId,adminOk,api]);

  useEffect(() => {
    if(!chosen) return;
    setAccount(chosen.vat_suggestion?.suggested_expense_account ?? "5611");
    setApprovedVat(asKr(chosen.deductible_vat_ore));
  },[chosen?.id]); // Changing selection resets the form, not subsequent refreshes.

  function change<K extends keyof ReceiptForm>(key: K, value: ReceiptForm[K]) {
    setForm((prev)=>({...prev,[key]:value}));
  }
  async function run(action:()=>Promise<void>) {
    setFailure("");setNotice("");setBusy(true);
    try{await action();}catch(e){setFailure(errorText(String(e instanceof Error?e.message:e)));}
    finally{setBusy(false);}
  }
  async function logIn(e:FormEvent) {
    e.preventDefault();
    await run(async()=>{
      if(!supabase) throw Error("Supabase-inställningar saknas.");
      const {error}=await supabase.auth.signInWithPassword({email,password});
      if(error) throw error;
      setPassword("");
    });
  }
  async function analyze() {
    await run(async()=>{
      if(!file) throw Error("Välj en kvittobild eller PDF.");
      const answer=await api("analyze",{},file);
      const parsed=answer.parsed as Partial<{
        supplier:string;expense_date:string;amount_ore:number;vat_ore:number;category:string;
      }>;
      setOcrStatus(String(answer.reason ?? answer.status ?? ""));
      setOcrText(String(answer.text ?? "").slice(0,8000));
      setForm((current)=>({
        ...current,
        supplier:parsed.supplier || current.supplier,
        expense_date:parsed.expense_date || current.expense_date,
        amount:parsed.amount_ore ? asKr(parsed.amount_ore) : current.amount,
        vat:parsed.vat_ore != null ? asKr(parsed.vat_ore) : current.vat,
        deductible:parsed.vat_ore != null ? asKr(parsed.vat_ore) : current.deductible,
        category:parsed.category && categories.includes(parsed.category) ? parsed.category : current.category
      }));
      setNotice(answer.status === "recognized" ?
        "Text avläst. Kontrollera alla belopp innan du sparar." :
        "Automatisk avläsning är inte tillgänglig för filen. Fyll i kvittot manuellt.");
    });
  }
  function calculate() {
    try {
      const total=parseKr(form.amount);
      if(!total) throw Error("Ange ett totalbelopp.");
      const rate=Number(form.rate);
      const percent=Number(form.businessUse);
      if(![0,6,12,25].includes(rate) || percent<0 || percent>100 || !Number.isInteger(percent))
        throw Error("Välj en giltig momssats och verksamhetsandel.");
      const vat=Math.round(total * rate / (100 + rate));
      setForm((current)=>({...current,vat:asKr(vat),deductible:asKr(Math.round(vat*percent/100))}));
      setNotice("Momsförslag uträknat. Kontrollera att beloppet överensstämmer med kvittot.");
      setFailure("");
    } catch(e) {setFailure(String(e instanceof Error ? e.message : e));}
  }
  async function save(e:FormEvent) {
    e.preventDefault();
    await run(async()=>{
      if(!file) throw Error("Lägg till en kvittobild eller PDF.");
      const amount=parseKr(form.amount),vat=parseKr(form.vat || "0"),deductible=parseKr(form.deductible || "0");
      if(!amount || vat>amount || deductible>vat) throw Error("Kontrollera beloppen och momsen.");
      const answer=await api("upload",{
        supplier:form.supplier,expense_date:form.expense_date,category:form.category,
        amount_ore:amount,vat_ore:vat,deductible_vat_ore:deductible,
        note:form.note,confirmed:true
      },file);
      const row=answer.receipt as {id:string};
      await load();
      setSelectedId(row.id);
      setFile(null);setOcrText("");setOcrStatus("");setForm(emptyForm());
      setNotice("Kvittot är sparat som underlag. Det är ännu inte bokfört.");
    });
  }
  async function viewFile() {
    await run(async()=>{
      if(!chosen) throw Error("Välj ett kvitto.");
      const result=await api("file",{receipt_id:chosen.id});
      const link=String(result.url ?? "");
      if(!link.startsWith("https://")) throw Error("Ogiltig kvittolänk.");
      window.location.assign(link);
    });
  }
  async function linkBank() {
    await run(async()=>{
      if(!chosen || !bankId) throw Error("Välj en bankbetalning.");
      const match=candidates.find((r)=>r.bank_id===bankId);
      if(!match || match.already_reconciled || match.linked_receipt_id && match.linked_receipt_id!==chosen.id)
        throw Error("Bankhändelsen är redan hanterad.");
      if(!window.confirm("Bekräfta att denna bankbetalning hör till kvittot?")) return;
      await api("link",{receipt_id:chosen.id,bank_id:bankId,confirmed:true});
      setNotice("Bankbetalningen är kopplad till kvittot.");
      const result=await api("review",{receipt_id:chosen.id,bank_id:bankId});
      setReview(result.review as LedgerReview);
      const rows=await api("candidates",{receipt_id:chosen.id});
      setCandidates((rows.candidates as Candidate[])??[]);
    });
  }
  async function fetchReview() {
    await run(async()=>{
      if(!chosen || !bankId) throw Error("Välj bankbetalningen först.");
      const result=await api("review",{receipt_id:chosen.id,bank_id:bankId});
      setReview(result.review as LedgerReview);
      setNotice("Kontrollera bokföringsförslaget och bekräfta innan bokföring.");
    });
  }
  async function approve() {
    await run(async()=>{
      if(!chosen || !bankId || !review || !approvedChecked) throw Error("Granska och bekräfta först.");
      if(review.entry?.status==="posted") throw Error("Kvittot är redan bokfört.");
      const vat=parseKr(approvedVat);
      if(vat>chosen.vat_ore) throw Error("Avdragsgill moms kan inte överstiga kvittots moms.");
      const currentAccount=review.accounts.find((r)=>r.code===account);
      if(!currentAccount) throw Error("Välj ett godkänt bokföringskonto.");
      const summary="Bokför " + chosen.supplier + " (" + money(chosen.amount_ore) +
        "), avdragsgill moms " + money(vat) + ", konto " + account +
        " och banktransaktion " + bankId + "? Verifikationen kan inte ändras efter bokföring.";
      if(!window.confirm(summary)) return;
      const result=await api("approve",{receipt_id:chosen.id,bank_id:bankId,
        account,deductible_vat_ore:vat,confirmed:true});
      setNotice("Bokföring genomförd. Verifikation: " +
        JSON.stringify(result.posted ?? result.entry_id));
      setApprovedChecked(false);
      await load();
      await fetchReview();
    });
  }

  if(!authReady) return <main className={styles.page}><p>Kontrollerar inloggning…</p></main>;
  if(!url || !anon) return <main className={styles.page}>
    <h1>Kvitton och kostnader</h1><p>Konfiguration saknas: NEXT_PUBLIC_SUPABASE_URL och NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>
  </main>;
  if(!session) return <main className={styles.page}>
    <header className={styles.head}><a href="/">← Tillbaka</a><h1>Ekonomi · Kvitton</h1></header>
    <section className={styles.panel}>
      <h2>Logga in som administratör</h2>
      <form onSubmit={logIn} className={styles.stack}>
        <label>E-post<input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} /></label>
        <label>Lösenord<input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} /></label>
        <button type="submit" disabled={busy}>Logga in</button>
      </form>
      {failure && <p role="alert" className={styles.error}>{failure}</p>}
    </section>
  </main>;
  return <main className={styles.page}>
    <header className={styles.head}>
      <div><a href="/">← Trafikledningen</a><h1>Ekonomi · Kvitton &amp; kostnader</h1>
        <p className={styles.muted}>Avenyn Taxi · Förhandsgranskning före bokföring</p></div>
      <button type="button" className={styles.secondary} onClick={()=>supabase?.auth.signOut()}>Logga ut</button>
    </header>
    {failure && <div role="alert" className={styles.error}>{failure}</div>}
    {notice && <div role="status" className={styles.success}>{notice}</div>}
    {!adminOk ? <section className={styles.panel}>Kontrollerar administratörsbehörighet…</section> : <>
      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2>1. Ladda upp kvitto</h2>
          <p className={styles.muted}>JPG, PNG eller PDF (högst 10 MB). Inget bokförs vid uppladdning.</p>
          <label>Kvittofil<input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e)=>{
            setFile(e.target.files?.[0] ?? null);setOcrStatus("");setOcrText("");
          }} /></label>
          <button type="button" className={styles.secondary} disabled={busy || !file} onClick={analyze}>
            Läs av kvittot
          </button>
          {!imageOcr && <p className={styles.note}>Bild-OCR är inte konfigurerad. Uppladdning och manuell registrering fungerar.</p>}
          {ocrStatus && <p className={styles.note}>{errorText(ocrStatus)}</p>}
          {ocrText && <details><summary>Visa avläst text (kontroll)</summary><pre className={styles.ocr}>{ocrText}</pre></details>}
          <form className={styles.stack} onSubmit={save}>
            <label>Leverantör<input required maxLength={160} value={form.supplier} onChange={(e)=>change("supplier",e.target.value)}/></label>
            <label>Kvittodatum<input required type="date" value={form.expense_date} onChange={(e)=>change("expense_date",e.target.value)} /></label>
            <label>Kategori<select value={form.category} onChange={(e)=>change("category",e.target.value)}>
              {categories.map((x)=><option key={x} value={x}>{x}</option>)}
            </select></label>
            <div className={styles.cols}>
              <label>Totalt (kr)<input required inputMode="decimal" placeholder="1000,00" value={form.amount} onChange={(e)=>change("amount",e.target.value)} /></label>
              <label>Momssats för förslag<select value={form.rate} onChange={(e)=>change("rate",e.target.value)}>
                {["25","12","6","0"].map((n)=><option key={n} value={n}>{n} %</option>)}
              </select></label>
            </div>
            <div className={styles.cols}>
              <label>Verksamhetsandel (%)<input type="number" min="0" max="100" value={form.businessUse} onChange={(e)=>change("businessUse",e.target.value)}/></label>
              <div className={styles.alignBottom}><button type="button" className={styles.secondary} onClick={calculate}>Beräkna momsförslag</button></div>
            </div>
            <div className={styles.cols}>
              <label>Moms på kvittot (kr)<input required inputMode="decimal" placeholder="200,00" value={form.vat} onChange={(e)=>change("vat",e.target.value)}/></label>
              <label>Avdragsgill moms (kr)<input required inputMode="decimal" placeholder="200,00" value={form.deductible} onChange={(e)=>change("deductible",e.target.value)}/></label>
            </div>
            <label>Notering<textarea rows={2} value={form.note} onChange={(e)=>change("note",e.target.value)}/></label>
            <p className={styles.note}>Kontrollera originalkvittot, verksamhetsanknytningen och eventuell blandad moms före registrering.</p>
            <button disabled={busy || !file} type="submit">Spara granskat kvitto</button>
          </form>
        </section>
        <section className={styles.panel}>
          <div className={styles.headline}><h2>2. Registrerade kvitton</h2>
            <button type="button" className={styles.secondary} disabled={busy} onClick={()=>void run(load)}>Uppdatera</button></div>
          {receipts.length===0 ? <p className={styles.muted}>Inga kvitton hittades.</p> :
          <div className={styles.receipts}>
            {receipts.map((r)=><button type="button" key={r.id}
              className={selectedId===r.id ? styles.selected : styles.receipt}
              onClick={()=>{setSelectedId(r.id);setReview(null);setBankId("");}}>
              <strong>{r.supplier}</strong><span>{r.expense_date} · {r.category}</span>
              <b>{money(r.amount_ore)}</b></button>)}
          </div>}
          {chosen && <div className={styles.review}>
            <h3>3. Granska {chosen.supplier}</h3>
            <p>Belopp: <strong>{money(chosen.amount_ore)}</strong></p>
            <p>Moms: <strong>{money(chosen.vat_ore)}</strong></p>
            <p>Registrerat avdrag: <strong>{money(chosen.deductible_vat_ore)}</strong></p>
            <button type="button" className={styles.secondary} onClick={viewFile} disabled={busy}>Visa originalkvitto</button>
            {suggestion && <div className={styles.note}>
              <strong>Automatiskt bokföringsförslag</strong>
              <p>Avdragsgill moms: {money(suggestion.suggested_deductible_vat_ore)}</p>
              <p>Föreslaget konto: {suggestion.suggested_expense_account ?? "Manuell bedömning"}</p>
              {(suggestion.review_flags ?? []).map((x)=><p key={x}>• {labelText(x)}</p>)}
            </div>}
            <h3>4. Matcha bankbetalningen</h3>
            {candidates.length===0 ? <p className={styles.note}>
              Ingen motsvarande bankhändelse hittades. Importera eller synkronisera banktransaktioner för att kunna bokföra kvittot.
            </p> : <>
              <label>Banktransaktion<select value={bankId} onChange={(e)=>{setBankId(e.target.value);setReview(null);setApprovedChecked(false);}}>
                <option value="">Välj betalning</option>
                {candidates.map((b)=><option key={b.bank_id} value={b.bank_id}
                  disabled={b.already_reconciled || Boolean(b.linked_receipt_id && b.linked_receipt_id!==chosen.id)}>
                  {b.date} · {money(-b.amount_ore)} · {b.description.slice(0,50)}
                  {b.linked_receipt_id===chosen.id ? " · Kopplad" : ""}
                </option>)}
              </select></label>
              <div className={styles.buttons}>
                <button type="button" className={styles.secondary} onClick={linkBank} disabled={busy||!bankId}>Matcha bank</button>
                <button type="button" className={styles.secondary} onClick={fetchReview} disabled={busy||!bankId}>Granska bokföring</button>
              </div>
            </>}
            {review && <div className={styles.ledger}>
              <h3>5. Godkänn bokföring</h3>
              <p>Bankdatum: {review.bank_date} · Bankkonto: {review.bank_code}</p>
              {review.entry?.status==="posted" ?
                <p className={styles.success}>Bokfört i huvudboken. Verifikation kan inte ändras.</p> : <>
                <label>Kostnadskonto<select value={account} onChange={(e)=>{setAccount(e.target.value);setApprovedChecked(false);}}>
                  <option value="">Välj konto</option>
                  {(review.accounts ?? []).map((a)=><option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
                </select></label>
                <label>Godkänd avdragsgill moms (kr)<input value={approvedVat}
                  onChange={(e)=>{setApprovedVat(e.target.value);setApprovedChecked(false);}} inputMode="decimal"/></label>
                <label className={styles.checkbox}><input type="checkbox" checked={approvedChecked}
                  onChange={(e)=>setApprovedChecked(e.target.checked)}/>
                  Jag har kontrollerat kvittot, avdragsrätten, kontot och bankmatchningen.
                </label>
                <button type="button" disabled={busy||!approvedChecked||!account} onClick={approve}>
                  Godkänn och bokför
                </button>
              </>}
            </div>}
          </div>}
        </section>
      </div>
    </>}
  </main>;
}
