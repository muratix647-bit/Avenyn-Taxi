"use client";


import {AppText} from "@/components/app-language";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, PlaneLanding, PlaneTakeoff, RefreshCw } from "lucide-react";

type Flight = {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  airline: string;
  scheduledUtc: string | null;
  estimatedUtc: string | null;
  actualUtc: string | null;
  delayMinutes: number;
  statusCode: string;
  status: string;
  terminal: string;
  gate: string;
  gateAction: string;
  checkInStatus: string;
  checkInDeskFrom: string;
  checkInDeskTo: string;
  baggageClaim: string;
  firstBagUtc: string | null;
  baggageStatus: string;
  updatedUtc: string | null;
  direction: "arrival" | "departure";
};

const normalizeFlightNumber = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "");

const findFlightNumber = (notes: string) => {
  const match = notes.match(
    /flyg(?:nummer)?\s*[:#-]?\s*([a-z0-9]{2,3}\s?\d{1,4}[a-z]?)/i,
  );
  return match?.[1]?.toUpperCase().replace(/\s+/g, "") || "";
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

const isLandvetter = (value: string | null | undefined) =>
  /(?:göteborg\s+)?landvetter|got\s*(?:airport|flygplats)/i.test(value || "");

function flightState(flight: Flight, isDeparture: boolean) {
  const status = `${flight.statusCode} ${flight.status}`.toLocaleLowerCase(
    "sv",
  );
  if (/^(cnl|can|del)$/i.test(flight.statusCode.trim()) || /instäl|borttagen|cancel/.test(status))
    return { tone: "cancelled", label: "Inställt" };
  if (flight.actualUtc)
    return {
      tone: "landed",
      label: `${isDeparture ? "Avgått" : "Landat"} ${localTime(flight.actualUtc)}`,
    };
  if (flight.delayMinutes > 0)
    return {
      tone: "delayed",
      label: `Försenat ${flight.delayMinutes} min`,
    };
  return { tone: "ontime", label: flight.status || "I tid" };
}

export default function DriverFlightCard({
  notes,
  flightNumber: suppliedFlightNumber,
  pickupTime,
  accessToken,
  trackingToken,
  pickupAddress,
  destinationAddress,
  flightType,
}: {
  notes?: string | null;
  flightNumber?: string | null;
  pickupTime?: string | null;
  accessToken?: string;
  trackingToken?: string;
  pickupAddress?: string | null;
  destinationAddress?: string | null;
  flightType?: "arrivals" | "departures";
}) {
  const flightNumber = useMemo(
    () => suppliedFlightNumber || findFlightNumber(notes || ""),
    [notes, suppliedFlightNumber],
  );
  const date = String(pickupTime || "").slice(0, 10);
  const type =
    flightType ||
    (isLandvetter(destinationAddress) && !isLandvetter(pickupAddress)
      ? "departures"
      : "arrivals");
  const isDeparture = type === "departures";
  const [flight, setFlight] = useState<Flight | null>(null);
  const [loading, setLoading] = useState(Boolean(flightNumber));
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!flightNumber) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) params.set("date", date);
      params.set("type", type);
      if (trackingToken) params.set("trackingToken", trackingToken);
      const query = params.toString();
      const response = await fetch(
        `/api/swedavia/arrivals${query ? `?${query}` : ""}`,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {},
        },
      );
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          payload?.error || "Flyginformationen kunde inte hämtas.",
        );
      const match = (payload.flights || []).find(
        (item: Flight) =>
          normalizeFlightNumber(item.flightNumber) ===
          normalizeFlightNumber(flightNumber),
      );
      if (!match) {
        setFlight(null);
        setError(`Ingen liveinformation hittades för ${flightNumber}.`);
        return;
      }
      setFlight(match);
    } catch (reason: any) {
      setFlight(null);
      setError(reason?.message || "Flyginformationen kunde inte hämtas.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, date, flightNumber, trackingToken, type]);

  useEffect(() => {
    if (!flightNumber) return;
    load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, [flightNumber, load]);

  if (!flightNumber) return null;
  const state = flight ? flightState(flight, isDeparture) : null;
  const checkInDesk = flight
    ? flight.checkInDeskFrom &&
      flight.checkInDeskTo &&
      flight.checkInDeskFrom !== flight.checkInDeskTo
      ? `${flight.checkInDeskFrom}–${flight.checkInDeskTo}`
      : flight.checkInDeskFrom || flight.checkInDeskTo || "—"
    : "—";
  const FlightIcon = isDeparture ? PlaneTakeoff : PlaneLanding;

  return (
    <section
      className="driverFlightCard"
      aria-label={`Flyginformation ${flightNumber}`}
    >
      <div className="driverFlightHead">
        <div>
          <small><AppText text={"LANDVETTER ·"} />{<AppText text={isDeparture ? "AVGÅNG" : "ANKOMST"} />} <AppText text={"LIVE"} /></small>
          <strong>
            <FlightIcon /> {<AppText text={flightNumber} />}
          </strong>
        </div>
        {state && (
          <span
            className={`driverFlightStatus driverFlightStatus--${state.tone}`}
          >
            {<AppText text={state.label} />}
          </span>
        )}
      </div>

      {flight ? (
        <>
          <div className="driverFlightOrigin">
            <span>{<AppText text={isDeparture ? "Till" : "Från"} />}</span>
            <b>{<AppText text={(isDeparture ? flight.destination : flight.origin) || "—"} />}</b>
            <small>{<AppText text={flight.airline || "Flygbolag saknas"} />}</small>
          </div>
          <dl className="driverFlightFacts">
            <div>
              <dt><AppText text={"Planerad"} />{<AppText text={isDeparture ? "avgång" : "ankomst"} />}</dt>
              <dd>{<AppText text={localTime(flight.scheduledUtc)} />}</dd>
            </div>
            <div>
              <dt><AppText text={"Beräknad"} /></dt>
              <dd>{<AppText text={localTime(flight.estimatedUtc)} />}</dd>
            </div>
            <div>
              <dt><AppText text={"Faktisk"} /></dt>
              <dd>{<AppText text={localTime(flight.actualUtc)} />}</dd>
            </div>
            <div>
              <dt><AppText text={"Terminal"} /></dt>
              <dd>{<AppText text={flight.terminal || "—"} />}</dd>
            </div>
            <div>
              <dt><AppText text={"Gate"} /></dt>
              <dd>{<AppText text={flight.gate || "—"} />}</dd>
            </div>
            {isDeparture ? (
              <>
                <div>
                  <dt><AppText text={"Checka in vid"} /></dt>
                  <dd>{<AppText text={checkInDesk === "—" ? "—" : `Disk ${checkInDesk}`} />}</dd>
                </div>
                <div>
                  <dt><AppText text={"Incheckning"} /></dt>
                  <dd>{<AppText text={flight.checkInStatus || "—"} />}</dd>
                </div>
              </>
            ) : (
              <>
                <div>
                  <dt><AppText text={"Bagageband"} /></dt>
                  <dd>{<AppText text={flight.baggageClaim || "Ej publicerat"} />}</dd>
                </div>
                <div>
                  <dt><AppText text={"Första bagaget väntas"} /></dt>
                  <dd>{<AppText text={flight.firstBagUtc ? localTime(flight.firstBagUtc) : flight.baggageStatus || "Ej publicerat"} />}</dd>
                </div>
              </>
            )}
          </dl>
          <div className="driverFlightUpdated">
            <span>
              <Clock3 /> <AppText text={"Uppdaterad"} />{<AppText text={localTime(flight.updatedUtc, true)} />}
            </span>
            <button type="button" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? "spinning" : ""} />
              <AppText text={"Uppdatera"} /></button>
          </div>
        </>
      ) : (
        <div className="driverFlightEmpty">
          <span>{<AppText text={loading ? "Hämtar flyginformation…" : error} />}</span>
          {!loading && (
            <button type="button" onClick={load}>
              <AppText text={"Försök igen"} /></button>
          )}
        </div>
      )}
    </section>
  );
}
