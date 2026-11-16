"use client";

import { useCallback, useEffect, useState } from "react";
import EconomyWorkspace from "@/components/economy-workspace";
import type { SupabaseClient } from "@supabase/supabase-js";

type Summary = {
  slutforda_korningar: number;
  registrerade_slutpriser_kr: number;
  betaldmarkerade_betalningar_kr: number;
  saknar_slutpris: number;
  saknar_forare: number;
  foretagskopplade_bokningar: number;
  lonekorningar: number;
};
type Month = {
  manad: string;
  slutforda_korningar?: number;
  markerade_betalda?: number;
  saknar_slutpris?: number;
  registrerade_slutpriser_kr?: number;
  betalningsposter?: number;
  betaldmarkerat_belopp_kr?: number;
  belopp_inkl_moms_kr?: number;
  indikativ_moms_6_procent_kr?: number;
};
type DriverMonth = {
  manad: string;
  forare_id: string | null;
  slutforda_korningar: number;
  saknar_slutpris: number;
  registrerade_slutpriser_inkl_moms_kr: number;
};
type CostMonth = { manad: string; kalla: string; antal_poster: number; registrerade_belopp_kr: number };
type Report = {
  summary: Summary;
  trips: Month[];
  payments: Month[];
  vat: Month[];
  drivers: DriverMonth[];
  costs: CostMonth[];
  exceptions: Record<string, number>;
  invoiceCandidates: number;
  generatedAt: string;
};

const SEK = new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" });
const INT = new Intl.NumberFormat("sv-SE");
const money = (n: number | null | undefined) => SEK.format(Number(n ?? 0));
const integer = (n: number | null | undefined) => INT.format(Number(n ?? 0));
const month = (v: string) => v?.slice(0, 7) || "–";

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <>
    <div className="grid min-w-0 gap-3 md:hidden">
      {rows.length ? rows.map((cells, i) => <dl key={i} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        {cells.map((cell, j) => <div key={j} className="grid min-w-0 grid-cols-2 gap-3 border-b border-slate-100 py-2 last:border-0">
          <dt className="break-words text-slate-500">{headers[j]}</dt>
          <dd className="min-w-0 break-words text-right font-semibold text-slate-900">{cell}</dd>
        </div>)}
      </dl>) : <p className="py-5 text-sm text-slate-500">Inga registrerade uppgifter.</p>}
    </div>
    <div className="hidden min-w-0 overflow-x-auto rounded-xl border border-slate-700/30 md:block">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-slate-800"><tr>{headers.map((h) => <th key={h} className="whitespace-nowrap px-3 py-3">{h}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map((cells, i) => <tr key={i} className="border-t border-slate-200 bg-white text-slate-900">{cells.map((c, j) => <td key={j} className="whitespace-nowrap px-3 py-3">{c}</td>)}</tr>) : <tr><td colSpan={headers.length} className="bg-white px-3 py-5 text-slate-500">Inga registrerade uppgifter.</td></tr>}</tbody>
      </table>
    </div>
    </>
  );
}

/**
 * Render inside the EXISTING authenticated /dispatch UI.
 * Pass the same SupabaseClient used by Dispatch, so the authenticated session is reused.
 * All monetary data is fetched from a PostgreSQL security-definer RPC that checks the
 * active admin role itself. No secret/service-role key is included in frontend code.
 * Operational reports remain read-only. The separate workspace manages payroll and receipts.
 */
type DriverIdentity = { id: string; name?: string | null };

export default function EconomyPanel({ supabase, drivers = [] }: { supabase: SupabaseClient; drivers?: DriverIdentity[] }) {
  const driverNames = new Map(drivers.filter(driver => driver.name?.trim()).map(driver => [driver.id, driver.name!.trim()]));
  const driverName = (id: string | null) => id ? driverNames.get(id) || `Namn saknas (${id.slice(0, 8)})` : "Ej tilldelad";
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"trips" | "payments" | "vat" | "drivers" | "costs" | "invoices" | "checks">("trips");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("avenyn_economy_dashboard");
      if (rpcError) throw rpcError;
      if (!data || typeof data !== "object" || Array.isArray(data) || !data.summary) throw new Error("Ogiltigt svarsformat");
      setReport(data as Report);
    } catch (e) {
      setReport(null);
      setError("Rapporterna kunde inte laddas. Kontrollera att du är inloggad som behörig administratör.");
    } finally {
      setBusy(false);
    }
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const tabs = [
    ["trips", "Körningar"], ["payments", "Betalningar"], ["vat", "Moms"],
    ["drivers", "Förare"], ["costs", "Kostnader"], ["invoices", "Fakturor"], ["checks", "Kontroll"],
  ] as const;

  return <section aria-label="Avenyn Ekonomi" aria-busy={busy} className="min-w-0 space-y-5 text-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-bold">Ekonomi</h2><p className="text-sm text-slate-500">Avenyn Taxi · Löner, kvitton och rapporter</p></div>
      <button type="button" onClick={() => void load()} disabled={busy} className="rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60">{busy ? "Uppdaterar…" : "Uppdatera"}</button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
    <EconomyWorkspace supabase={supabase} drivers={drivers} />
    {report && <details className="space-y-4"><summary className="cursor-pointer rounded-xl bg-slate-200 p-4 font-bold">Körnings- och betalningsrapporter</summary>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Slutförda resor", integer(report.summary.slutforda_korningar)],
          ["Registrerade slutpriser", money(report.summary.registrerade_slutpriser_kr)],
          ["Betaldmarkerade betalningsposter", money(report.summary.betaldmarkerade_betalningar_kr)],
          ["Saknar slutpris", integer(report.summary.saknar_slutpris)],
          ["Saknar förare", integer(report.summary.saknar_forare)],
          ["Företagskopplade bokningar", integer(report.summary.foretagskopplade_bokningar)],
          ["Lönekörningar", integer(report.summary.lonekorningar)],
          ["Fakturakandidater", integer(report.invoiceCandidates)],
        ].map(([name, value]) => <div key={name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{name}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}
      </div>
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Preliminära kontrollunderlag, inte bankavstämd bokföring. Momsen antar att alla markerade poster avser svenska persontransporter med 6 % moms. Löneunderlag är inte lönebesked. Inga fakturor skickas härifrån.</p>
      <nav aria-label="Ekonomirapporter" className="flex flex-wrap gap-2">{tabs.map(([key, label]) => <button type="button" key={key} onClick={() => setTab(key)} aria-pressed={tab === key} className={"rounded-full px-4 py-2 text-sm font-semibold " + (tab === key ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-800")}>{label}</button>)}</nav>
      <div className="min-w-0 rounded-2xl bg-white p-2 shadow-sm sm:p-4">
        {tab === "trips" && <Table headers={["Månad", "Slutförda", "Betaldmarkerade", "Utan slutpris", "Slutpriser"]} rows={(report.trips || []).map(x => [month(x.manad), integer(x.slutforda_korningar), integer(x.markerade_betalda), integer(x.saknar_slutpris), money(x.registrerade_slutpriser_kr)])} />}
        {tab === "payments" && <Table headers={["Månad", "Betalningsposter", "Belopp"]} rows={(report.payments || []).map(x => [month(x.manad), integer(x.betalningsposter), money(x.betaldmarkerat_belopp_kr)])} />}
        {tab === "vat" && <Table headers={["Månad", "Belopp inklusive moms", "Indikativ moms 6 %"]} rows={(report.vat || []).map(x => [month(x.manad), money(x.belopp_inkl_moms_kr), money(x.indikativ_moms_6_procent_kr)])} />}
        {tab === "drivers" && <Table headers={["Förare", "Månad", "Körningar", "Utan slutpris", "Slutpriser"]} rows={(report.drivers || []).map(x => [driverName(x.forare_id), month(x.manad), integer(x.slutforda_korningar), integer(x.saknar_slutpris), money(x.registrerade_slutpriser_inkl_moms_kr)])} />}
        {tab === "costs" && <Table headers={["Månad", "Källa", "Poster", "Belopp"]} rows={(report.costs || []).map(x => [month(x.manad), x.kalla, integer(x.antal_poster), money(x.registrerade_belopp_kr)])} />}
        {tab === "invoices" && <p className="text-sm">{integer(report.invoiceCandidates)} slutförda, företagskopplade bokningar finns som fakturakandidater. Faktura kräver godkänd kund, verifierat slutpris och manuellt godkännande. Ingen faktura skickas automatiskt.</p>}
        {tab === "checks" && <Table headers={["Avvikelse", "Antal"]} rows={Object.entries(report.exceptions || {}).map(([key, val]) => [key.replaceAll("_", " "), integer(val)])} />}
      </div>
    </details>}
  </section>;
}
