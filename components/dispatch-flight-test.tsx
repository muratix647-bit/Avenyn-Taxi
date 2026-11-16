"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, MapPin, PlaneLanding, RefreshCw, Search } from "lucide-react";

type Flight = {
  id: string;
  flightNumber: string;
  origin: string;
  originIata: string;
  airline: string;
  scheduledUtc: string | null;
  estimatedUtc: string | null;
  actualUtc: string | null;
  delayMinutes: number;
  statusCode: string;
  status: string;
  terminal: string;
  gate: string;
  baggageClaim: string;
  updatedUtc: string | null;
};

type Arrivals = {
  date: string;
  fetchedAt: string;
  numberOfFlights: number;
  flights: Flight[];
};

const localTime = (value: string | null, withDate = false) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    ...(withDate ? { day: "numeric", month: "short" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const normalizedFlightNumber = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "");

function flightState(flight: Flight) {
  const status = `${flight.statusCode} ${flight.status}`.toLocaleLowerCase("sv");
  if (/cnl|can|del|instäl|borttagen|cancel/.test(status))
    return { tone: "cancelled", label: "Inställt" };
  if (flight.actualUtc)
    return {
      tone: "landed",
      label: `Landat ${localTime(flight.actualUtc)}`,
    };
  if (flight.delayMinutes > 0)
    return {
      tone: "delayed",
      label: `Försenat ${flight.delayMinutes} min`,
    };
  return { tone: "ontime", label: flight.status || "I tid" };
}

function closestFlight(flights: Flight[]) {
  const now = Date.now();
  return (
    [...flights].sort((a, b) => {
      const aTime = Date.parse(a.estimatedUtc || a.scheduledUtc || "");
      const bTime = Date.parse(b.estimatedUtc || b.scheduledUtc || "");
      return Math.abs(aTime - now) - Math.abs(bTime - now);
    })[0] || null
  );
}

export default function DispatchFlightTest({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<Arrivals | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchMessage, setSearchMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/swedavia/arrivals", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          [payload.code, payload.detail || payload.error]
            .filter(Boolean)
            .join(" · ") || "Swedavia kunde inte hämtas.",
        );
      }
      setData(payload);
      setSelectedId((current) => {
        if (payload.flights.some((flight: Flight) => flight.id === current))
          return current;
        return closestFlight(payload.flights)?.id || "";
      });
    } catch (reason: any) {
      setError(reason?.message || "Swedavia kunde inte hämtas.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => data?.flights.find((flight) => flight.id === selectedId) || null,
    [data, selectedId],
  );
  const state = selected ? flightState(selected) : null;

  const search = () => {
    const needle = normalizedFlightNumber(query);
    const found = data?.flights.find(
      (flight) => normalizedFlightNumber(flight.flightNumber) === needle,
    );
    if (!needle) {
      setSearchMessage("Skriv ett flygnummer.");
      return;
    }
    if (!found) {
      setSearchMessage(`Inget inkommande flyg ${query.trim()} hittades idag.`);
      return;
    }
    setSelectedId(found.id);
    setSearchMessage("");
  };

  return (
    <section className="flightTest" aria-labelledby="flight-test-title">
      <div className="flightTestHead">
        <div>
          <small>SWEDAVIA FLIGHTINFO · GOT</small>
          <h2 id="flight-test-title">
            <PlaneLanding /> Flygtest · Landvetter live
          </h2>
          <p>
            Dagens inkommande flyg · tider i svensk lokal tid
            {data ? ` · ${data.numberOfFlights} flyg` : ""}
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "spinning" : ""} />
          {loading ? "Hämtar…" : "Uppdatera live"}
        </button>
      </div>

      <div className="flightTestControls">
        <label>
          <span>Sök flygnummer</span>
          <div className="flightSearch">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") search();
              }}
              placeholder="Exempel: SK 443"
              autoComplete="off"
            />
            <button type="button" onClick={search} disabled={!data || loading}>
              <Search /> Sök flyg
            </button>
          </div>
        </label>
        <label>
          <span>Välj bland dagens ankomster</span>
          <select
            value={selectedId}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setSearchMessage("");
            }}
            disabled={!data?.flights.length || loading}
          >
            {!data?.flights.length && <option>Inga flyg tillgängliga</option>}
            {data?.flights.map((flight) => (
              <option value={flight.id} key={flight.id}>
                {flight.flightNumber} · {flight.origin || "Okänd avgångsort"} ·{" "}
                {localTime(flight.scheduledUtc)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(error || searchMessage) && (
        <div className="flightTestError" role="alert">
          {error || searchMessage}
        </div>
      )}

      {selected && state && (
        <article className="flightResult">
          <div className="flightIdentity">
            <div>
              <span>Flygnummer</span>
              <strong>{selected.flightNumber}</strong>
            </div>
            <span className={`flightStatus flightStatus--${state.tone}`}>
              {state.label}
            </span>
          </div>
          <div className="flightRoute">
            <MapPin />
            <div>
              <span>Från</span>
              <b>
                {selected.origin || "—"}
                {selected.originIata ? ` (${selected.originIata})` : ""}
              </b>
              <small>{selected.airline || "Flygbolag saknas"}</small>
            </div>
          </div>
          <dl className="flightFacts">
            <div>
              <dt>Planerad ankomst</dt>
              <dd>{localTime(selected.scheduledUtc)}</dd>
            </div>
            <div>
              <dt>Beräknad ankomst</dt>
              <dd>{localTime(selected.estimatedUtc)}</dd>
            </div>
            <div>
              <dt>Faktisk ankomst</dt>
              <dd>{localTime(selected.actualUtc)}</dd>
            </div>
            <div>
              <dt>Försening</dt>
              <dd>{selected.delayMinutes} min</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{state.label}</dd>
            </div>
            <div>
              <dt>Gate</dt>
              <dd>{selected.gate || "—"}</dd>
            </div>
            <div>
              <dt>Bagageband</dt>
              <dd>{selected.baggageClaim || "—"}</dd>
            </div>
            <div>
              <dt>Senast uppdaterad</dt>
              <dd>
                <Clock3 /> {localTime(selected.updatedUtc, true)}
              </dd>
            </div>
          </dl>
        </article>
      )}
    </section>
  );
}
