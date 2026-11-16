"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type PayrollRow = {
  id: string;
  employee_name: string;
  period: string;
  payment_date: string;
  status: "draft" | "approved" | "paid";
  revision: number;
  created_at: string;
  bruttolon_kr: number | null;
  fel: string[];
  godkannandekontroll: boolean;
  har_skattunderlag: boolean;
};

type PayrollCheck = {
  status: string;
  kan_godkannas: boolean;
  fel: string[];
  berakning_kontrollerad: boolean;
  viktig_info: string;
};

const currency = new Intl.NumberFormat("sv-SE", {
  style: "currency", currency: "SEK", minimumFractionDigits: 2,
});

function statusLabel(status: PayrollRow["status"]) {
  if (status === "draft") return "Utkast – ej godkänt";
  if (status === "approved") return "Godkänt";
  return "Markerat betalt";
}

/**
 * Read-only Admin salary draft verification. Mount inside existing /dispatch Admin → Ekonomi.
 * Reuse the existing authenticated Supabase client; never expose a secret key here.
 * The PostgreSQL RPC independently checks the active Admin role, and the approval
 * trigger blocks broken drafts even if another UI attempts to approve them.
 * Does NOT approve, pay, edit salaries, print payslips, or submit AGI.
 */
export default function EconomyPayrollReviewPanel({
  supabase,
  onOpenCalculator,
}: {
  supabase: SupabaseClient;
  onOpenCalculator?: () => void;
}) {
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [freshCheck, setFreshCheck] = useState<Record<string, PayrollCheck>>({});
  const [checking, setChecking] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("avenyn_ekonomi_loneutkast_admin_lista", {
        p_limit: 50,
      });
      if (rpcError) throw rpcError;
      if (!Array.isArray(data)) throw new Error("Ogiltigt svar från lönekontrollen");
      setRows(data as PayrollRow[]);
      setFreshCheck({});
    } catch {
      setRows([]);
      setError("Kunde inte läsa löneutkasten. Kontrollera Admin-inloggning och databasanslutning.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function verifyDraft(id: string) {
    setChecking(id);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("avenyn_ekonomi_loneutkast_kontroll", {
        p_payroll_id: id,
      });
      if (rpcError) throw rpcError;
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Ogiltigt kontrollsvar");
      setFreshCheck(previous => ({ ...previous, [id]: data as PayrollCheck }));
      setExpanded(id);
    } catch {
      setError("Kontrollen kunde inte genomföras. Försök uppdatera sidan.");
    } finally {
      setChecking(null);
    }
  }

  const drafts = rows.filter(row => row.status === "draft");
  const blocked = drafts.filter(row => !row.godkannandekontroll);

  return <section className="space-y-4" aria-label="Löneutkast och kontroll">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-xl font-bold text-slate-900">Löner · kontroll före godkännande</h3>
        <p className="mt-1 text-sm text-slate-600">Kontrollerar sparade löneutkast utan att ändra, skicka eller betala något.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {onOpenCalculator && <button type="button" onClick={onOpenCalculator} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Beräkna lön</button>}
        <button type="button" onClick={() => void refresh()} disabled={loading || checking !== null} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">{loading ? "Laddar…" : "Uppdatera utkast"}</button>
      </div>
    </header>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm text-slate-600">Löneutkast</p><strong className="mt-1 block text-2xl">{drafts.length}</strong></div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-800">Utkast med fel</p><strong className="mt-1 block text-2xl text-amber-900">{blocked.length}</strong></div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm text-slate-600">Poster hämtade</p><strong className="mt-1 block text-2xl">{rows.length}</strong></div>
    </div>

    {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {blocked.length > 0 && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-950">
      {blocked.length} löneutkast har uppgifter som måste rättas. Godkännande är även spärrat i Supabase.
      Det är inte säkert att utbetala beloppet som visas på ett sådant utkast.
    </p>}
    {!loading && rows.length === 0 && !error && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Inga löneutkast finns ännu.</p>}

    <div className="space-y-3">
      {rows.map(row => {
        const show = expanded === row.id;
        const currentCheck = freshCheck[row.id];
        const errors = currentCheck?.fel ?? row.fel ?? [];
        const blockedNow = currentCheck ? !currentCheck.kan_godkannas : !row.godkannandekontroll;
        return <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="font-bold text-slate-900">{row.employee_name}</h4>
              <p className="text-sm text-slate-600">{row.period} · Utbetalningsdag {row.payment_date} · Version {row.revision}</p>
              <p className="mt-1 text-sm text-slate-600">Bruttolön: {row.bruttolon_kr == null ? "Belopp behöver granskas" : currency.format(row.bruttolon_kr)}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold text-slate-800">{statusLabel(row.status)}</p>
              <p className={blockedNow ? "mt-1 font-semibold text-amber-800" : "mt-1 font-semibold text-slate-600"}>
                {blockedNow ? `Kontroll krävs (${errors.length} fel)` : "Grundkontrollen passerad – manuell granskning krävs"}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setExpanded(show ? null : row.id)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800">{show ? "Dölj detaljer" : "Visa fel och detaljer"}</button>
            <button type="button" onClick={() => void verifyDraft(row.id)} disabled={checking !== null} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50">{checking === row.id ? "Kontrollerar…" : "Kontrollera igen"}</button>
          </div>
          {show && <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            {errors.length > 0 ? <><p className="font-semibold text-amber-900">Måste rättas före godkännande:</p><ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">{errors.map((text, i) => <li key={i}>{text}</li>)}</ul></> : <p className="text-slate-700">Inga obligatoriska grunduppgifter saknas enligt senaste kontrollen. Kontrollera ändå skattebeslut, löneslag, belopp och kollektivavtal.</p>}
            {!row.har_skattunderlag && <p className="mt-2 text-slate-700">Skattetabell/skattebeslut har inte registrerats för utkastet.</p>}
            {currentCheck && <p className="mt-2 text-xs text-slate-500">{currentCheck.viktig_info}</p>}
          </div>}
        </article>;
      })}
    </div>

    <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
      Kontrollera skattebeslut, löneslag och belopp innan du godkänner lönen.
    </p>
  </section>;
}
