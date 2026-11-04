"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

type EconomyMonth = {
  manad: string;
  slutforda_korningar?: number;
  markerade_betalda?: number;
  saknar_slutpris?: number;
  registrerade_slutpriser_kr?: number;
  betaldmarkerade_slutpriser_kr?: number;
  betalningsposter?: number;
  betaldmarkerat_belopp_kr?: number;
  indikativ_moms_6_procent_kr?: number;
  belopp_inkl_moms_kr?: number;
  betalda_poster?: number;
};

type DriverMonth = {
  manad: string;
  forare_id: string | null;
  slutforda_korningar: number;
  saknar_slutpris: number;
  registrerade_slutpriser_inkl_moms_kr: number;
};

type CostMonth = {
  manad: string;
  kalla: string;
  antal_poster: number;
  registrerade_belopp_kr: number;
};

type EconomyData = {
  summary: {
    slutforda_korningar: number;
    saknar_slutpris: number;
    saknar_forare: number;
    betaldmarkerade_korningar: number;
    registrerade_slutpriser_kr: number;
    betaldmarkerade_betalningsposter: number;
    betaldmarkerade_betalningar_kr: number;
    foretagskopplade_bokningar: number;
    lonekorningar: number;
    utgiftsposter: number;
    inkopsposter: number;
  };
  trips: EconomyMonth[];
  payments: EconomyMonth[];
  vat: EconomyMonth[];
  drivers: DriverMonth[];
  costs: CostMonth[];
  exceptions: Record<string, number>;
  invoiceCandidates: number;
  generatedAt: string;
};

function amount(value: number | undefined | null) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function integer(value: number | undefined | null) {
  return new Intl.NumberFormat("sv-SE").format(Number(value ?? 0));
}

function monthLabel(value: string) {
  return value ? value.slice(0, 7) : "–";
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-left text-slate-700">
          <tr>
            {headers.map((header) => (
              <th key={header} className="whitespace-nowrap px-3 py-3 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, i) => (
              <tr key={i} className="border-t border-slate-100">
                {row.map((cell, j) => (
                  <td key={j} className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} className="px-3 py-6 text-slate-500">
                Inga registrerade uppgifter för denna rapport.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

export default function EkonomiPage() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<EconomyData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setError("Supabase-inställningarna saknas i Admin.");
      setAuthReady(true);
      return;
    }
    const supabase = createClient(url, key);
    let active = true;
    setClient(supabase);
    void supabase.auth.getSession().then(({ data: result }) => {
      if (!active) return;
      setSession(result.session ?? null);
      setAuthReady(true);
    }).catch(() => {
      if (active) {
        setError("Kunde inte kontrollera inloggningen.");
        setAuthReady(true);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const load = useCallback(async (supabase: SupabaseClient) => {
    setLoading(true);
    setError("");
    try {
      // RPC validates auth.uid() and the active Admin/Dispatch role in PostgreSQL.
      // No secret or service-role key is sent to the browser.
      const { data: result, error: apiError } = await supabase.rpc("avenyn_economy_dashboard");
      if (apiError) throw apiError;
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        throw new Error("Ogiltigt rapportresultat.");
      }
      setData(result as EconomyData);
    } catch (err) {
      setData(null);
      const message = err instanceof Error ? err.message : "";
      setError(
        /denied|permission|42501|not authorized/i.test(message)
          ? "Du saknar behörighet till Ekonomi. Kontakta administratören."
          : "Kunde inte läsa rapporterna från Supabase. Kontrollera anslutningen."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!client || !session) {
      setData(null);
      return;
    }
    void load(client);
  }, [client, session, load]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
              Avenyn Taxi · Admin
            </p>
            <h1 className="text-3xl font-bold">Ekonomi</h1>
            <p className="mt-1 text-sm text-slate-500">
              Skrivskyddade rapporter · Endast behöriga administratörer
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
              Tillbaka till Admin
            </a>
            <button
              type="button"
              onClick={() => client && void load(client)}
              disabled={!client || !session || loading}
              className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? "Uppdaterar..." : "Uppdatera rapporter"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-7">
        {!authReady && <p className="text-slate-600">Kontrollerar inloggningen...</p>}
        {authReady && !session && !error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            Logga in via Admin först för att se ekonomirapporterna.
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900">
            {error}
          </div>
        )}
        {session && loading && !data && <p>Laddar ekonomirapporter...</p>}
        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Slutförda körningar" value={integer(data.summary.slutforda_korningar)} />
              <Metric label="Registrerade slutpriser" value={amount(data.summary.registrerade_slutpriser_kr)} />
              <Metric label="Betaldmarkerade betalningsposter" value={amount(data.summary.betaldmarkerade_betalningar_kr)} />
              <Metric label="Saknar slutpris" value={integer(data.summary.saknar_slutpris)} />
              <Metric label="Körningar utan förare" value={integer(data.summary.saknar_forare)} />
              <Metric label="Företagskopplade bokningar" value={integer(data.summary.foretagskopplade_bokningar)} />
              <Metric label="Registrerade lönekörningar" value={integer(data.summary.lonekorningar)} />
              <Metric label="Fakturakandidater" value={integer(data.invoiceCandidates)} />
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Beloppen är operativa underlag, inte bankavstämd omsättning eller färdig bokföring.
              Momskalkylen förutsätter 6 % moms på samtliga markerade betalningar och är inte en momsdeklaration.
              Löneunderlagen är inte lönebesked. Fakturor skickas aldrig automatiskt härifrån.
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Panel title="Slutförda körningar per månad">
                <Table
                  headers={["Månad", "Körningar", "Betaldmarkerade", "Saknar slutpris", "Registrerat slutpris"]}
                  rows={(data.trips || []).map((r) => [
                    monthLabel(r.manad),
                    integer(r.slutforda_korningar),
                    integer(r.markerade_betalda),
                    integer(r.saknar_slutpris),
                    amount(r.registrerade_slutpriser_kr),
                  ])}
                />
              </Panel>
              <Panel title="Betaldmarkerade betalningar">
                <Table
                  headers={["Månad", "Poster", "Belopp"]}
                  rows={(data.payments || []).map((r) => [
                    monthLabel(r.manad),
                    integer(r.betalningsposter),
                    amount(r.betaldmarkerat_belopp_kr),
                  ])}
                />
              </Panel>
              <Panel title="Preliminär moms · 6 % på betalningsposter">
                <Table
                  headers={["Månad", "Bruttobelopp", "Beräknad moms"]}
                  rows={(data.vat || []).map((r) => [
                    monthLabel(r.manad),
                    amount(r.belopp_inkl_moms_kr),
                    amount(r.indikativ_moms_6_procent_kr),
                  ])}
                />
              </Panel>
              <Panel title="Körningar att kontrollera">
                <Table
                  headers={["Kontrollpunkt", "Antal"]}
                  rows={Object.entries(data.exceptions || {}).map(([name, value]) => [
                    name.replaceAll("_", " "),
                    integer(value),
                  ])}
                />
              </Panel>
              <Panel title="Förarunderlag · inte lönebesked">
                <Table
                  headers={["Månad", "Förare ID", "Körningar", "Saknar pris", "Registrerat pris"]}
                  rows={(data.drivers || []).map((r) => [
                    monthLabel(r.manad),
                    r.forare_id ? r.forare_id.slice(0, 8) : "Ej tilldelad",
                    integer(r.slutforda_korningar),
                    integer(r.saknar_slutpris),
                    amount(r.registrerade_slutpriser_inkl_moms_kr),
                  ])}
                />
              </Panel>
              <Panel title="Kostnader och inköp">
                <Table
                  headers={["Månad", "Källa", "Poster", "Belopp"]}
                  rows={(data.costs || []).map((r) => [
                    monthLabel(r.manad),
                    r.kalla,
                    integer(r.antal_poster),
                    amount(r.registrerade_belopp_kr),
                  ])}
                />
              </Panel>
            </div>
            <p className="text-xs text-slate-500">
              Senaste databasrapport: {data.generatedAt ? new Date(data.generatedAt).toLocaleString("sv-SE") : "–"}.
              Rapporterna använder de befintliga Supabase-tabellerna och ändrar inga uppgifter.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
