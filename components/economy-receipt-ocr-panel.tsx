"use client";

import { useEffect, useRef, useState } from "react";
import type { ReceiptTransfer } from "@/lib/economy-transfer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSwedishReceipt } from "./receipt-ocr-parser";

const VAT_RATES = [0, 6, 12, 25] as const;
const CATEGORIES = [
  ["okand", "Osäker – granska manuellt"],
  ["personbil_bransle", "Bränsle till personbil"],
  ["personbil_reparation", "Reparation/service personbil"],
  ["personbil_leasing", "Leasing av personbil"],
  ["kontorsmaterial", "Kontorsmaterial"],
  ["forbrukningsmaterial", "Förbrukningsmaterial"],
  ["telefoni", "Mobiltelefoni"],
] as const;

type Preview = {
  beraknad_moms_ore: number | null;
  belopp_exkl_moms_ore: number | null;
  bas_konto_forslag: string | null;
  kontotext: string;
  mojliga_dubbletter: number;
  faktura_kravs_vid_over_4000: boolean;
  viktigt: string;
};
type Draft = {
  id: string;
  expense_date: string;
  supplier: string;
  amount_ore: number;
  suggested_vat_ore: number | null;
  suggested_bas_account: string | null;
  duplicate_candidates: number;
  file_path: string;
  file_name: string;
  mime_type: string;
  status: string;
  created_at: string;
};
const ore = (value: number | null | undefined) => value == null ? "Ej fastställt" :
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(value / 100);
const field = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none";

/**
 * Mount in existing authorized Trafikledning -> Ekonomi -> Kvitton & kostnader.
 * Reuse existing signed-in Supabase client, never use service-role keys in the browser.
 * Image OCR runs in browser via Tesseract.js@7 and NEVER authorizes bookkeeping or VAT deduction.
 * A file is uploaded only when the user presses Save draft.
 * Drafts are separate from the manually approved expense archive.
 */
export default function EconomyReceiptOCRPanel({ supabase, onReceipt, transferBlocked = false }: { supabase: SupabaseClient; onReceipt?: (value:ReceiptTransfer)=>void; transferBlocked?:boolean }) {
  const mounted = useRef(true);
  const workerRef = useRef<Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>> | null>(null);
  const pendingUpload = useRef<string | null>(null);
  const [saveUncertain, setSaveUncertain] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; void workerRef.current?.terminate(); }; }, []);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [supplier, setSupplier] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [totalKr, setTotalKr] = useState("");
  const [vatRate, setVatRate] = useState("");
  const [category, setCategory] = useState("okand");
  const [ocrNotes, setOcrNotes] = useState<string[]>([]);
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState<"ocr" | "preview" | "save" | "list" | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [ackOriginal, setAckOriginal] = useState(false);
  const [ackDuplicate, setAckDuplicate] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!file || file.type === "application/pdf") { setFilePreview(null); return; }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function chooseFile(nextFile?: File) {
    setPreview(null);setOcrNotes([]);setSuccess("");setError("");setAckOriginal(false);setAckDuplicate(false);
    pendingUpload.current = null; setSaveUncertain(false);
    setSupplier(""); setExpenseDate(""); setTotalKr(""); setVatRate(""); setCategory("okand"); setProgress("");
    setFile(nextFile || null);
    if (nextFile && (!["image/jpeg", "image/png", "application/pdf"].includes(nextFile.type) || nextFile.size > 10 * 1024 * 1024 || nextFile.size <= 0)) {
      setFile(null);
      setError("Välj JPG, PNG eller PDF (högst 10 MB). Kontrollera filen innan uppladdning.");
    }
  }

  async function readImage() {
    if (!file || file.type === "application/pdf") {
      setError("Automatisk OCR stöder JPG och PNG i denna version. För PDF fyller du i uppgifterna manuellt.");
      return;
    }
    setBusy("ocr");setError("");setProgress("Startar lokal OCR …");setPreview(null);
    let worker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>> | undefined;
    try {
      // Language model resources may be downloaded. The selected image is processed in the browser.
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker(["swe", "eng"], 1, {
        logger: m => {
          if (m.status === "recognizing text") setProgress(`Läser text … ${Math.round((m.progress || 0) * 100)} %`);
        },
      });
      workerRef.current = worker;
      if (!mounted.current) { await worker.terminate(); return; }
      const { data } = await worker.recognize(file);
      if (!mounted.current) return;
      const result = parseSwedishReceipt(data.text);
      setSupplier(result.supplier);
      setExpenseDate(result.expenseDate);
      setTotalKr(result.totalOre === null ? "" : (result.totalOre / 100).toFixed(2));
      setVatRate(result.vatRate === null ? "" : String(result.vatRate));
      setCategory(result.category);
      setOcrNotes(result.notices);
      setProgress("OCR färdig – kontrollera varje fält mot originalkvittot.");
    } catch {
      setError("Kunde inte läsa bilden med OCR. Fyll i uppgifterna manuellt, eller använd en tydligare JPG/PNG.");
      setProgress("");
    } finally {
      try { await worker?.terminate(); } catch { /* worker cleanup */ }
      workerRef.current = null;
      setBusy(null);
    }
  }

  function totalOre() {
    const parsed = Number(totalKr.trim().replace(/\s/g, "").replace(",", "."));
    const value = Math.round(parsed * 100);
    if (!Number.isFinite(parsed) || !Number.isSafeInteger(value) || value < 1 || value > 100000000) {
      throw new Error("Ange ett korrekt totalbelopp inklusive moms, mellan 0,01 kr och 1 000 000 kr.");
    }
    return value;
  }

  useEffect(() => { setAckOriginal(false); setAckDuplicate(false); }, [file, supplier, expenseDate, totalKr, vatRate, category]);

  async function inspect() {
    setError("");setSuccess("");setPreview(null);
    setBusy("preview");
    try {
      const { data, error: rpcError } = await supabase.rpc("avenyn_ekonomi_kvitto_kontroll", {
        p_supplier: supplier.trim(),
        p_expense_date: expenseDate,
        p_amount_ore: totalOre(),
        p_vat_rate: vatRate === "" ? null : Number(vatRate),
        p_category: category,
      });
      if (rpcError) throw rpcError;
      setPreview(data as Preview);
      setAckDuplicate(false);
    } catch (e) {
      setError(e instanceof Error && !e.message.includes("invalid") ? e.message : "Kontrollen misslyckades. Kontrollera fälten och Admin-inloggningen.");
    } finally { setBusy(null); }
  }

  async function reloadDrafts() {
    setError("");setBusy("list");
    try {
      const { data, error: rpcError } = await supabase.rpc("avenyn_ekonomi_kvitto_utkast_lista", { p_limit: 25 });
      if (rpcError) throw rpcError;
      setDrafts(Array.isArray(data) ? (data as Draft[]) : []);
    } catch { setError("Kunde inte läsa kvittoutkasten. Endast behörig Admin har åtkomst."); }
    finally { setBusy(null); }
  }

  function transferReceipt() {
    if(!onReceipt||transferBlocked||saveUncertain||!file||!preview||!ackOriginal||(preview.mojliga_dubbletter>0&&!ackDuplicate))return;
    const categories:Record<string,string>={personbil_bransle:'Drivmedel',personbil_reparation:'Service & reparation',personbil_leasing:'Leasing',kontorsmaterial:'Kontorsmaterial',forbrukningsmaterial:'Förbrukningsmaterial',telefoni:'Telefoni'};
    onReceipt({file,expenseDate,supplier:supplier.trim(),amount:(totalOre()/100).toFixed(2),vat:preview.beraknad_moms_ore==null?'':(preview.beraknad_moms_ore/100).toFixed(2),category:categories[category]||'Övrigt',note:preview.bas_konto_forslag?`BAS-förslag ${preview.bas_konto_forslag} – ${preview.kontotext}. Kontrollera kontering och avdragsrätt.`:'BAS-konto och moms behöver kontrolleras.'});
    setSaveUncertain(true);setSuccess('Överfört till Kvitton & kostnader ovan. Granska och välj Spara kvitto där.');
  }

  async function saveDraft() {
    if (saveUncertain) return;
    if (!file || !preview) { setError("Välj kvittobild och kör kontrollen innan du sparar."); return; }
    if (!ackOriginal) { setError("Kontrollera kvittot och bekräfta att uppgifterna stämmer."); return; }
    if (preview.mojliga_dubbletter > 0 && !ackDuplicate) {
      setError("Möjlig dubblett hittad. Bekräfta att detta är ett nytt, separat kvitto."); return;
    }
    setBusy("save");setError("");setSuccess("");
    const extension = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "pdf";
    const path = pendingUpload.current || `${expenseDate.slice(0, 7)}/${crypto.randomUUID()}.${extension}`;
    pendingUpload.current = path;
    let uploaded = false;
    try {
      const upload = await supabase.storage.from("economy-receipts").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upload.error) throw upload.error;
      uploaded = true;
      const { data, error: rpcError } = await supabase.rpc("avenyn_ekonomi_kvitto_spara_utkast", {
        p_expense_date: expenseDate,
        p_supplier: supplier.trim(),
        p_amount_ore: totalOre(),
        p_vat_rate: vatRate === "" ? null : Number(vatRate),
        p_category: category,
        p_file_path: path,
        p_file_name: file.name,
        p_mime_type: file.type,
      });
      if (rpcError) throw rpcError;
      setSuccess(`Kvittot har sparats som ${(data as { status?: string })?.status || "UTKAST"}. Originalfilen är privat. Ingen bokföring eller momsdeklaration har skapats.`);
      setPreview(null);setAckOriginal(false);setSaveUncertain(true);
      await reloadDrafts();
    } catch (e) {
      setSaveUncertain(true);
      setError(uploaded ?
        `Originalfilen laddades upp, men svaret om utkastet kunde inte bekräftas. Kontrollera listan innan ett nytt försök. Filreferens: ${path}` :
        `Uppladdningen kunde inte bekräftas. Kontrollera lagringen innan ett nytt försök. Filreferens: ${path}`);
    } finally { setBusy(null); }
  }

  async function downloadReceipt(draft: Draft) {
    setError("");
    try {
      const { data, error: urlError } = await supabase.storage.from("economy-receipts")
        .createSignedUrl(draft.file_path, 60, { download: draft.file_name });
      if (urlError || !data?.signedUrl) throw urlError || new Error("Signed URL saknas");
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = draft.file_name;
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);a.click();a.remove();
    } catch { setError("Kunde inte hämta originalfilen. Kontrollera Admin-behörighet och filens lagring."); }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900">
      <div>
        <h3 className="text-xl font-bold">Kvitton & kostnader · automatisk bildläsning</h3>
        <p className="mt-1 text-sm text-slate-600">
          Välj JPG eller PNG, tryck Läs kvitto och granska uppgifterna. PDF kan laddas upp med manuell registrering.
          OCR körs lokalt i webbläsaren; språkmodeller kan hämtas via internet. {onReceipt ? 'Efter kontroll kan original och uppgifter föras över till Kvitton & kostnader. Originalet laddas upp när du sparar kvittot där.' : 'Originalet laddas upp när du sparar kvittoutkastet. Dessa utkast ingår inte i kostnadsarkivets summeringar.'}
        </p>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <b>Viktigt:</b> Momsavdrag och BAS-konto måste verifieras mot originalet och företagets kontoplan.
        Blandad moms eller ett belopp över 4 000 kr kan kräva särskild fakturagranskning. Ingen bokföring eller Skatteverket-inlämning sker automatiskt.
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-green-800">{success}</p>}
      <fieldset disabled={busy !== null || saveUncertain} className="grid min-w-0 gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-3">
          <label className="block space-y-1 text-sm font-semibold"><span>Originalkvitto · max 10 MB</span>
            <input type="file" accept="image/jpeg,image/png,application/pdf" className={field}
              onChange={e => chooseFile(e.target.files?.[0])} /></label>
          {filePreview && <img src={filePreview} alt="Förhandsvisning av originalkvitto som ska kontrolleras" className="max-h-[430px] w-full rounded-xl border object-contain" />}
          {file?.type === "application/pdf" && <p className="text-sm text-blue-700">PDF vald. Fyll i uppgifterna manuellt; filen sparas oförändrad.</p>}
          <button type="button" onClick={() => void readImage()} disabled={!file || file.type === "application/pdf" || busy !== null}
            className="rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
            {busy === "ocr" ? "Läser kvitto …" : "Läs kvitto automatiskt"}
          </button>
          {progress && <p className="text-sm text-slate-600">{progress}</p>}
          {ocrNotes.length > 0 && <ul className="space-y-1 text-xs text-amber-800">{ocrNotes.map((notice, i) => <li key={i}>• {notice}</li>)}</ul>}
        </div>
        <div className="space-y-3">
          <label className="block space-y-1 text-sm font-semibold">Leverantör <input className={field} maxLength={160} value={supplier}
            onChange={e => { setSupplier(e.target.value); setPreview(null); }} placeholder="Leverantör enligt original" /></label>
          <label className="block space-y-1 text-sm font-semibold">Datum <input type="date" className={field} value={expenseDate}
            onChange={e => { setExpenseDate(e.target.value); setPreview(null); }} /></label>
          <label className="block space-y-1 text-sm font-semibold">Totalt inklusive moms (kr) <input inputMode="decimal" className={field} value={totalKr}
            onChange={e => { setTotalKr(e.target.value); setPreview(null); }} placeholder="125,00" /></label>
          <label className="block space-y-1 text-sm font-semibold">Momssats (endast om bekräftad) <select className={field} value={vatRate}
            onChange={e => { setVatRate(e.target.value); setPreview(null); }}>
            <option value="">Osäker eller blandad moms – granska</option>
            {VAT_RATES.map(rate => <option key={rate} value={rate}>{rate} %</option>)}
          </select></label>
          <label className="block space-y-1 text-sm font-semibold">Föreslagen kostnadskategori <select className={field} value={category}
            onChange={e => { setCategory(e.target.value); setPreview(null); }}>
            {CATEGORIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select></label>
          <button type="button" onClick={() => void inspect()} disabled={busy !== null}
            className="rounded-xl border border-blue-600 px-4 py-2 font-semibold text-blue-700 disabled:opacity-50">
            {busy === "preview" ? "Kontrollerar …" : "Föreslå moms och BAS-konto · sök dubbletter"}
          </button>
          {preview && <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
            <p><b>Preliminär moms:</b> {ore(preview.beraknad_moms_ore)}</p>
            <p><b>Exkl. moms:</b> {ore(preview.belopp_exkl_moms_ore)}</p>
            <p><b>BAS-konto:</b> {preview.bas_konto_forslag ? `${preview.bas_konto_forslag} – ${preview.kontotext}` : "Granska manuellt"}</p>
            <p><b>Möjliga dubbletter:</b> {preview.mojliga_dubbletter}</p>
            {preview.faktura_kravs_vid_over_4000 && <p className="font-semibold text-amber-900">Över 4 000 kr: fullständig faktura behövs normalt för momsavdrag.</p>}
            <p className="text-amber-800">{preview.viktigt}</p>
            <label className="flex items-start gap-2"><input type="checkbox" checked={ackOriginal} onChange={e=>setAckOriginal(e.target.checked)} />
              <span>Jag har jämfört leverantör, datum, belopp och momssats med originalkvittot.</span></label>
            {preview.mojliga_dubbletter > 0 && <label className="flex items-start gap-2"><input type="checkbox" checked={ackDuplicate} onChange={e=>setAckDuplicate(e.target.checked)} />
              <span>Jag har kontrollerat dubblettvarningen. Detta är ett annat inköp.</span></label>}
            <button type="button" onClick={() => onReceipt ? transferReceipt() : void saveDraft()} disabled={(!!onReceipt && transferBlocked) || saveUncertain || !file || busy !== null || !ackOriginal || (preview.mojliga_dubbletter > 0 && !ackDuplicate)}
              className="rounded-xl bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
              {busy === "save" ? "Sparar …" : onReceipt ? "Överför till Kvitton & kostnader" : "Spara original + kvittoutkast"}
            </button>
            {onReceipt&&transferBlocked&&<p>Spara eller avbryt det öppna underlaget först.</p>}
          </div>}
        </div>
      </fieldset>
      {saveUncertain && <button type="button" disabled={busy !== null} onClick={() => chooseFile()} className="rounded-xl border px-4 py-2">Börja med ett annat kvitto</button>}
      <div className="rounded-xl border border-slate-200 p-3">
        <button onClick={() => void reloadDrafts()} disabled={busy !== null} type="button"
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">
          Visa senaste kvittoutkast</button>
        <div className="mt-3 space-y-2">
          {drafts.map(draft => <div key={draft.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-2 text-sm">
            <div><b>{draft.expense_date} · {draft.supplier}</b><p>{ore(draft.amount_ore)} · {draft.status} · BAS {draft.suggested_bas_account || "manuell"}
              {draft.duplicate_candidates > 0 ? ` · ${draft.duplicate_candidates} möjliga dubbletter` : ""}</p></div>
            <button type="button" onClick={() => void downloadReceipt(draft)} className="rounded-lg bg-blue-50 px-3 py-2 font-semibold text-blue-700">Hämta original</button>
          </div>)}
          {drafts.length === 0 && <p className="text-xs text-slate-500">Inga utkast inlästa ännu. Välj ”Visa senaste kvittoutkast”.</p>}
        </div>
      </div>
    </section>
  );
}
