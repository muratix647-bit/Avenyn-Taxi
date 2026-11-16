"use client";

import { useEffect, useState } from "react";
import { payrollTransfer, type PayrollTransfer } from "@/lib/economy-transfer";
import type { SupabaseClient } from "@supabase/supabase-js";

type ReceiptPreview = {
  status: string;
  belopp_ore: number;
  momssats_procent: number | null;
  beraknad_moms_ore: number | null;
  belopp_exkl_moms_ore: number | null;
  avdragsgill_moms_ore: number | null;
  bas_konto_forslag: string | null;
  kontotext: string;
  varning: string;
};

type TaxChecklist = {
  period: string;
  loneunderlag_godkanda_eller_betalda: number;
  loneutkast: number;
  kvitton: number;
  kvitton_som_kraver_momsgranskning: number;
  slutforda_korningar_utan_slutpris: number;
  betaldmarkerade_betalningsposter: number;
  tasks: Array<{ type: string; status: string; title: string; instruction: string }>;
  submission_status: string;
  warning: string;
};

type PayrollPreview = {
  skattetabell?: number;
  kolumn?: number;
  status: string;
  skattear?: number;
  bruttolon_kr?: number;
  arbetsgivaravgift_kr?: number;
  total_lonekostnad_exkl_andra_kostnader_kr?: number;
  skatteavdrag_kr?: number | null;
  nettolon_kr?: number | null;
  skatt_status?: string;
  varning?: string;
  instruktion?: string;
  netto_avvikelse_kr?: number;
  inmatat_nettobelopp_kr?: number;
  beraknat_bruttobelopp_kr?: number;
};

const categories = [
  ["okand", "Välj / osäker"],
  ["kontorsmaterial", "Kontorsmaterial"],
  ["forbrukningsmaterial", "Förbrukningsmaterial"],
  ["telefoni", "Telefoni"],
  ["personbil_bransle", "Bränsle (personbil)"],
  ["personbil_reparation", "Reparation (personbil)"],
  ["personbil_leasing", "Leasing (personbil)"],
] as const;
const fmt = (kr: number | null | undefined) => kr == null ? "Ej beräknat" : new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(kr);
const fromOre = (ore: number | null | undefined) => fmt(ore == null ? null : ore / 100);

function NumberField({ title, value, onChange, step = "1" }: { title: string; value: string; onChange: (v: string) => void; step?: string }) {
  return <label className="block space-y-2 text-sm font-medium text-slate-700"><span>{title}</span><input type="number" min="0" step={step} value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5" /></label>;
}
function Row({ name, value }: { name: string; value: string }) {
  return <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-2 text-sm"><span className="text-slate-500">{name}</span><span className="font-semibold text-slate-900">{value}</span></div>;
}

/**
 * Mount inside the EXISTING authenticated Admin/Dispatch Economy tab.
 * Calls read-only calculation RPCs. A reviewed result may populate the existing payroll form.
 * Saving and approval remain in the authenticated workspace.
 */
type DriverOption = { id: string; full_name: string };

export default function EconomyAutomationPanel({ supabase, drivers = [], onPayroll, transferBlocked = false }: { supabase: SupabaseClient; drivers?: DriverOption[]; onPayroll?: (value:PayrollTransfer)=>void; transferBlocked?:boolean }) {
  const [gross, setGross] = useState("");
  const [salaryMode, setSalaryMode] = useState<"brutto" | "netto">("brutto");
  const [driverId, setDriverId] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [taxTable, setTaxTable] = useState("");
  const [taxColumn, setTaxColumn] = useState("");
  const [payroll, setPayroll] = useState<PayrollPreview | null>(null);
  const [transferred, setTransferred] = useState(false);
  const [receiptTotal, setReceiptTotal] = useState("");
  const [vatRate, setVatRate] = useState("");
  const [category, setCategory] = useState<string>("okand");
  const [receipt, setReceipt] = useState<ReceiptPreview | null>(null);
  const [busy, setBusy] = useState<"salary" | "receipt" | null>(null);
  const [checkMonth, setCheckMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [checklist, setChecklist] = useState<TaxChecklist | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setChecklistLoading(true); setChecklist(null);
    void Promise.resolve(supabase.rpc("avenyn_ekonomi_skatte_checklista", { p_manad: checkMonth + "-01" }))
      .then(({ data, error }) => {
        if (!cancelled) setChecklist(error ? null : (data as TaxChecklist));
      })
      .catch(() => { if (!cancelled) setChecklist(null); })
      .finally(() => { if (!cancelled) setChecklistLoading(false); });
    return () => { cancelled = true; };
  }, [supabase, checkMonth]);

  async function previewPayroll() {
    setError(""); setPayroll(null); setTransferred(false);
    const value = Number(gross.replace(",", "."));
    if (!(value > 0) || !payDate) { setError("Ange lönebelopp och utbetalningsdatum."); return; }
    const useProfile = salaryMode === "brutto" && Boolean(driverId) && !birthYear && !taxTable;
    if (!useProfile && !birthYear && !taxTable) {
      setError("Ange födelseår och skattetabell från A-skattsedeln, eller använd en tidigare sparad förarprofil för bruttolön."); return;
    }
    setBusy("salary");
    try {
      const rpcName = useProfile
        ? "avenyn_ekonomi_forare_loneforslag_2026"
        : salaryMode === "netto" ? "avenyn_ekonomi_netto_till_brutto_2026" : "avenyn_ekonomi_lone_forslag";
      const args = useProfile ? {
        p_forare_id: driverId,
        p_bruttolon_kr: value,
        p_utbetalningsdatum: payDate,
      } : salaryMode === "netto" ? {
        p_nettolon_kr: value,
        p_fodelsear: Number(birthYear),
        p_utbetalningsdatum: payDate,
        p_skattetabell: Number(taxTable),
        p_kolumn: taxColumn ? Number(taxColumn) : null,
      } : {
        p_bruttolon_kr: value,
        p_fodelsear: Number(birthYear),
        p_utbetalningsdatum: payDate,
        p_skattetabell: Number(taxTable),
        p_kolumn: taxColumn ? Number(taxColumn) : null,
      };
      const { data, error: err } = await supabase.rpc(rpcName, args);
      if (err) throw err;
      setPayroll(data as PayrollPreview);
    } catch {
      setError("Kunde inte beräkna löneförslaget. Kontrollera Admin-inloggning och de angivna värdena.");
    } finally { setBusy(null); }
  }
  async function previewReceipt() {
    setError(""); setReceipt(null);
    const kr = Number(receiptTotal.replace(",", "."));
    if (!(kr > 0)) { setError("Ange ett kvittobelopp större än noll."); return; }
    setBusy("receipt");
    try {
      const { data, error: err } = await supabase.rpc("avenyn_ekonomi_kvitto_forslag", {
        p_belopp_ore: Math.round(kr * 100),
        p_momssats: vatRate ? Number(vatRate) : null,
        p_kategori: category,
      });
      if (err) throw err;
      setReceipt(data as ReceiptPreview);
    } catch {
      setError("Kunde inte ta fram förslag. Kontrollera Admin-inloggning och belopp.");
    } finally { setBusy(null); }
  }

  useEffect(() => { setPayroll(null); setTransferred(false); }, [gross, salaryMode, driverId, birthYear, payDate, taxTable, taxColumn]);
  useEffect(() => { setReceipt(null); }, [receiptTotal, vatRate, category]);

  return <fieldset disabled={busy !== null} className="min-w-0 space-y-5">
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <strong>Automatik – förhandsberäkning, inte bokföring.</strong> Kontrollera alltid kvitto, skattetabell,
      löneslag, åldersregler och skattebeslut. Inga fakturor, löner eller deklarationer skickas från denna vy.
      Beräkningen använder de inlästa månadstabellerna för 2026 (29–42).
      Rätt tabell, eventuell jämkning, inkomstart och tidigare löneutbetalningar måste fortfarande kontrolleras.
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">{error}</div>}
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-xl font-bold">Lön och skatt · 2026</h3>
        <p className="mb-4 mt-1 text-sm text-slate-600">För en registrerad förare – brutto, arbetsgivaravgift och preliminär skatt enligt officiell tabell.</p>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-medium text-slate-700"><span>Beräkna från</span><select value={salaryMode} onChange={e => setSalaryMode(e.target.value as "brutto" | "netto")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="brutto">Bruttolön (före skatt)</option><option value="netto">Nettolön (efter skatt)</option></select></label>
          {drivers.length > 0 && <label className="block space-y-2 text-sm font-medium text-slate-700"><span>Förare (valfritt)</span><select value={driverId} onChange={e => setDriverId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="">Välj förare…</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></label>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField title={salaryMode === "netto" ? "Nettolön (kr)" : "Bruttolön (kr)"} step="0.01" value={gross} onChange={setGross} />
          <NumberField title="Födelseår" value={birthYear} onChange={setBirthYear} />
          <label className="block space-y-2 text-sm font-medium text-slate-700"><span>Utbetalningsdag</span><input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
          <NumberField title="Skattetabell (29–42)" value={taxTable} onChange={setTaxTable} />
          <label className="col-span-2 block space-y-2 text-sm font-medium text-slate-700"><span>Skattetabellens kolumn</span><select value={taxColumn} onChange={e => setTaxColumn(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="">Föreslå automatiskt efter födelseår</option>{[1,2,3,4,5,6].map(c=><option key={c} value={c}>{c}</option>)}</select></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" disabled={busy!==null} onClick={() => void previewPayroll()} className="rounded-xl bg-blue-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{busy === "salary" ? "Beräknar..." : "Beräkna löneförslag"}</button>
        </div>
        {payroll && <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <Row name="Status" value={payroll.status} />
          <Row name="Bruttolön" value={fmt(payroll.beraknat_bruttobelopp_kr ?? payroll.bruttolon_kr)} />
          {salaryMode === "netto" && payroll.netto_avvikelse_kr != null && <Row name="Avvikelse mot önskad nettolön" value={fmt(payroll.netto_avvikelse_kr)} />}
          <Row name="Arbetsgivaravgift (preliminär)" value={fmt(payroll.arbetsgivaravgift_kr)} />
          <Row name="Arbetsgivarens kostnad (exkl. andra kostnader)" value={fmt(payroll.total_lonekostnad_exkl_andra_kostnader_kr)} />
          <Row name="Preliminärt skatteavdrag" value={fmt(payroll.skatteavdrag_kr)} />
          <Row name="Nettolön" value={fmt(payroll.nettolon_kr)} />
          <p className="mt-3 text-sm text-amber-900">{payroll.varning || payroll.instruktion}</p>
          {onPayroll && <div className="mt-4 space-y-2"><button type="button" disabled={transferBlocked || transferred || !driverId || payroll.skatteavdrag_kr == null || payroll.nettolon_kr == null} className="rounded-xl bg-blue-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50" onClick={() => { try { onPayroll(payrollTransfer(payroll, driverId, payDate)); setTransferred(true); } catch (e) { setError((e as Error).message); } }}>{transferred ? "Överfört till löneutkast" : "Använd i löneutkast"}</button><p className="text-sm text-slate-600">{transferBlocked ? "Spara eller avbryt det öppna underlaget först." : !driverId ? "Välj förare och beräkna för att fylla i ett löneutkast." : "Beloppen fylls i automatiskt. Kontrollera löneperiod och personuppgifter innan du sparar."}</p></div>}
        </div>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-xl font-bold">Kvitto och BAS-konto</h3>
        <p className="mb-4 mt-1 text-sm text-slate-600">Förhandsberäkning efter att belopp och momssats lästs från originalkvittot.</p>
        <div className="space-y-3">
          <NumberField title="Kvittobelopp inklusive moms (kr)" step="0.01" value={receiptTotal} onChange={setReceiptTotal} />
          <label className="block space-y-2 text-sm font-medium text-slate-700"><span>Momssats på kvittot</span><select value={vatRate} onChange={e => setVatRate(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="">Osäker / blandad moms – granska</option>{[0,6,12,25].map(r=><option key={r} value={r}>{r} %</option>)}</select></label>
          <label className="block space-y-2 text-sm font-medium text-slate-700"><span>Kategori</span><select value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5">{categories.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
        </div>
        <button type="button" disabled={busy!==null} onClick={() => void previewReceipt()} className="mt-4 rounded-xl bg-blue-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{busy === "receipt" ? "Beräknar..." : "Föreslå momskod och BAS-konto"}</button>
        {receipt && <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <Row name="Totalt på kvittot" value={fromOre(receipt.belopp_ore)} />
          <Row name="Beräknad moms i kvittobelopp" value={fromOre(receipt.beraknad_moms_ore)} />
          <Row name="Exklusive moms" value={fromOre(receipt.belopp_exkl_moms_ore)} />
          <Row name="Föreslaget BAS-konto" value={receipt.bas_konto_forslag ? `${receipt.bas_konto_forslag} · ${receipt.kontotext}` : "Granska manuellt"} />
          <Row name="Avdragsgill ingående moms" value="Måste godkännas" />
          <p className="mt-3 text-sm text-amber-900">{receipt.varning}</p>
        </div>}
      </section>
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-bold">Skatteverket · vad som ska förberedas</h3>
      <div className="my-3 flex flex-wrap items-end gap-3"><label className="text-sm font-medium">Rapportmånad <input type="month" value={checkMonth} onChange={e => { if(e.target.value) setCheckMonth(e.target.value); }} className="ml-2 rounded-lg border border-slate-300 p-2" /></label><span className="text-sm font-semibold text-amber-800">Ingen automatisk inlämning är aktiverad.</span></div>
      {checklistLoading && <p className="text-sm text-slate-600">Kontrollerar registrerade underlag…</p>}
      {checklist && <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Row name="Löneutkast" value={String(checklist.loneutkast)} />
          <Row name="Godkända/betaldmarkerade löner" value={String(checklist.loneunderlag_godkanda_eller_betalda)} />
          <Row name="Kvitton med momsuppgift att granska" value={String(checklist.kvitton_som_kraver_momsgranskning)} />
          <Row name="Slutförda körningar utan pris" value={String(checklist.slutforda_korningar_utan_slutpris)} />
        </div>
        <div className="mt-3 grid gap-3">{(checklist.tasks || []).map(t => <div key={t.type} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="font-semibold">{t.title} · {t.status.replaceAll("_", " ")}</p><p className="mt-1 text-sm text-slate-600">{t.instruction}</p></div>)}</div>
        <p className="mt-3 text-sm text-amber-900">{checklist.warning}</p>
      </>}
      {!checklist && !checklistLoading && <p className="text-sm text-slate-600">Checklistan kan inte visas förrän Admin-inloggningen är verifierad.</p>}
      <p className="mt-3 text-sm text-slate-600">AGI per utbetalningsmånad: utbetald bruttolön, förmåner, avdragen skatt och arbetsgivaravgifter. Momsrapport efter rätt redovisningsperiod: försäljning per momssats och avdragsgill ingående moms. Behörig fil/API-anslutning och godkännande krävs för inlämning.</p>
      <p className="mt-3 text-xs text-slate-500">BAS-konton är bokföringsförslag som kan användas i Fortnox eller Visma efter att företagets kontoplan/momskoder har verifierats. Leverantörsspecifika löneartskoder och momsmarkeringar kan skilja sig.</p>
    </section>
  </fieldset>;
}
