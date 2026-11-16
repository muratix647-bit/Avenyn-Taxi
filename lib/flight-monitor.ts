import {flightSmsEvent} from './customer-sms-policy';
import {sendCustomerSmsOnce} from './customer-sms-monitor';
import { env } from "cloudflare:workers";
import { adminSupabase } from "./supabase-server";
import { sendFlightAlertEmail } from "./email";
import { sendFlightAlertSms } from "./sms";

type FlightDirection = "arrivals" | "departures";

const SWEDAVIA_BASE = "https://api.swedavia.se/flightinfo/v2/GOT";
const TIME_ZONE = "Europe/Stockholm";

export const flightNumberFromNotes = (notes: unknown) => {
  const match = String(notes || "").match(
    /flyg(?:nummer)?\s*[:#-]?\s*([a-z0-9]{2,3}\s?\d{1,4}[a-z]?)/i,
  );
  return match?.[1]?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "";
};

export const normalizeFlightNumber = (value: unknown) =>
  String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const isLandvetter = (value: unknown) =>
  /(?:göteborg\s+)?landvetter|got\s*(?:airport|flygplats)/i.test(
    String(value || ""),
  );

export const bookingFlightDirection = (booking: any): FlightDirection =>
  isLandvetter(booking?.dropoff_address ?? booking?.destination) &&
  !isLandvetter(booking?.pickup_address ?? booking?.pickup)
    ? "departures"
    : "arrivals";

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const firstText = (...values: unknown[]) =>
  values.map(text).find(Boolean) || "";

const timestamp = (value: unknown) => {
  const candidate = text(value);
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : null;
};

function normalizeFlight(row: any, direction: FlightDirection) {
  const time = direction === "departures" ? row?.departureTime : row?.arrivalTime;
  const location = row?.locationAndStatus ?? {};
  const baggage = row?.baggage ?? {};
  return {
    flightNumber: normalizeFlightNumber(
      firstText(
        row?.flightId,
        row?.flightNumber,
        row?.marketingFlightNumber,
        row?.operatingFlightNumber,
      ),
    ),
    scheduledUtc: timestamp(time?.scheduledUtc ?? row?.scheduledUtc),
    estimatedUtc: timestamp(time?.estimatedUtc ?? row?.estimatedUtc),
    actualUtc: timestamp(time?.actualUtc ?? row?.actualUtc),
    statusCode: firstText(location?.flightLegStatus, row?.statusCode),
    status: firstText(
      location?.flightLegStatusSwedish,
      location?.flightLegStatusEnglish,
      row?.status,
    ),
    gate: firstText(location?.gate, row?.gate),
    baggageClaim: firstText(
      baggage?.baggageClaimUnit,
      baggage?.claimUnit,
      row?.baggageClaimUnit,
    ),
    firstBagUtc: timestamp(
      baggage?.estimatedFirstBagUtc ??
        baggage?.firstBagEstimatedUtc ??
        baggage?.estimatedDeliveryUtc ??
        baggage?.baggageClaimTime?.estimatedUtc ??
        row?.estimatedFirstBagUtc,
    ),
  };
}

async function fetchFlight(
  flightNumber: string,
  direction: FlightDirection,
  date: string,
) {
  if (!env.SWEDAVIA_API_KEY)
    throw new Error("SWEDAVIA_API_KEY_MISSING");
  const response = await fetch(`${SWEDAVIA_BASE}/${direction}/${date}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
    headers: {
      "Ocp-Apim-Subscription-Key": env.SWEDAVIA_API_KEY,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const detail = (await response.text())
      .replaceAll(String(env.SWEDAVIA_API_KEY), "[REDACTED]")
      .slice(0, 300);
    throw new Error(`SWEDAVIA_HTTP_${response.status}: ${detail || response.statusText}`);
  }
  const raw: any = await response.json();
  const wanted = normalizeFlightNumber(flightNumber);
  const rows = Array.isArray(raw?.flights) ? raw.flights : [];
  return rows
    .map((row: any) => normalizeFlight(row, direction))
    .find((flight: any) => flight.flightNumber === wanted) || null;
}

const localTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: TIME_ZONE,
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "okänd tid";

const isCancelled = (flight: any) =>
  /cnl|can|instäl|borttagen|cancel/i.test(
    `${flight?.statusCode || flight?.last_status_code || ""} ${flight?.status || flight?.last_status || ""}`,
  );

function changedMessage(previous: any, flight: any, direction: FlightDirection) {
  if (!previous?.last_status_code && isCancelled(flight))
    return `Ditt flyg har blivit inställt`;
  if (
    !previous?.last_checked_at &&
    flight?.scheduledUtc &&
    flight?.estimatedUtc &&
    Math.abs(Date.parse(flight.estimatedUtc) - Date.parse(flight.scheduledUtc)) >= 60_000
  ) {
    const action = direction === "departures" ? "avgår" : "ankommer";
    return `Ditt flyg har ändrat tid och ${action} nu ${localTime(flight.estimatedUtc)}`;
  }
  if (!isCancelled(previous) && isCancelled(flight))
    return `Ditt flyg har blivit inställt`;
  const oldTime = previous?.last_estimated_utc || previous?.last_scheduled_utc;
  const newTime = flight?.estimatedUtc || flight?.scheduledUtc;
  if (oldTime && newTime && Math.abs(Date.parse(newTime) - Date.parse(oldTime)) >= 60_000) {
    const action = direction === "departures" ? "avgår" : "ankommer";
    return `Ditt flyg har ändrat tid och ${action} nu ${localTime(newTime)}`;
  }
  return "";
}

function monitorValues(flight: any) {
  return {
    last_scheduled_utc: flight.scheduledUtc,
    last_estimated_utc: flight.estimatedUtc,
    last_actual_utc: flight.actualUtc,
    last_status_code: flight.statusCode,
    last_status: flight.status,
    last_gate: flight.gate,
    last_baggage_claim: flight.baggageClaim,
    last_first_bag_utc: flight.firstBagUtc,
    last_snapshot: flight,
    last_checked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function upsertFlightMonitorForBooking(booking: any) {
  const supabase = adminSupabase();
  const flightNumber = normalizeFlightNumber(
    booking?.flight_number || flightNumberFromNotes(booking?.notes),
  );
  if (!flightNumber) {
    if (booking?.id)
      await supabase
        .from("booking_flight_monitors")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("booking_id", booking.id);
    return null;
  }
  const direction = bookingFlightDirection(booking);
  const row = {
    booking_id: booking.id,
    flight_number: flightNumber,
    direction,
    flight_date: booking.booking_date,
    active: !["completed", "cancelled"].includes(booking.status),
    updated_at: new Date().toISOString(),
  };
  const result = await supabase
    .from("booking_flight_monitors")
    .upsert(row, { onConflict: "booking_id" })
    .select()
    .single();
  if (result.error) throw result.error;
  return result.data;
}

async function checkMonitor(monitor: any, booking: any) {
  const supabase = adminSupabase();
  const flight = await fetchFlight(
    monitor.flight_number,
    monitor.direction,
    monitor.flight_date,
  );
  if (!flight) {
    await supabase
      .from("booking_flight_monitors")
      .update({
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", monitor.id);
    return { found: false, alerted: false };
  }
  const message = changedMessage(monitor, flight, monitor.direction);
  const eventKey = [
    flight.statusCode || "status",
    flight.estimatedUtc || flight.scheduledUtc || "time",
  ].join("-").replace(/[^a-z0-9-]/gi, "");
  let alerted = false;
  if (message) {
    const [email] = await Promise.all([
      sendFlightAlertEmail(booking, {
        flightNumber: monitor.flight_number,
        message,
        eventKey,
      }).catch(() => ({ accepted: false })),
    ]);
    alerted = Boolean(email.accepted);
  }
  const smsEvent=flightSmsEvent(flight,monitor.direction);
  if(smsEvent){
    const sms=await sendCustomerSmsOnce(booking.id,'flight_alert',`${monitor.flight_number}:${monitor.flight_date}:${smsEvent.key}`,latest=>sendFlightAlertSms(latest,{flightNumber:monitor.flight_number,message:smsEvent.message}));
    alerted=alerted||sms.accepted;
  }
  const update = await supabase
    .from("booking_flight_monitors")
    .update({
      ...monitorValues(flight),
      ...(message ? { last_notified_at: new Date().toISOString() } : {}),
    })
    .eq("id", monitor.id);
  if (update.error) throw update.error;
  return { found: true, alerted, message: message || null };
}

export async function syncFlightForBooking(booking: any) {
  const monitor = await upsertFlightMonitorForBooking(booking);
  if (!monitor || !monitor.active) return { monitored: false };
  return { monitored: true, ...(await checkMonitor(monitor, booking)) };
}

export async function runFlightMonitorBatch() {
  const supabase = adminSupabase();
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { data, error } = await supabase
    .from("booking_flight_monitors")
    .select("*,bookings(*)")
    .eq("active", true)
    .gte("flight_date", from)
    .order("flight_date", { ascending: true })
    .limit(150);
  if (error) throw error;
  const summary = { checked: 0, found: 0, alerted: 0, failed: 0 };
  for (const monitor of data || []) {
    const booking = Array.isArray((monitor as any).bookings)
      ? (monitor as any).bookings[0]
      : (monitor as any).bookings;
    if (!booking || ["completed", "cancelled"].includes(booking.status)) {
      await supabase
        .from("booking_flight_monitors")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("id", (monitor as any).id);
      continue;
    }
    summary.checked += 1;
    try {
      const result = await checkMonitor(monitor, booking);
      if (result.found) summary.found += 1;
      if (result.alerted) summary.alerted += 1;
    } catch (error) {
      summary.failed += 1;
      console.error("flight_monitor_check_failed", {
        bookingNumber: booking.booking_number,
        flightNumber: (monitor as any).flight_number,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return summary;
}
