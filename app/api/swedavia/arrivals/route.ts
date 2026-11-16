import { env } from "cloudflare:workers";
import {
  adminSupabase,
  requireSupabaseUser,
} from "../../../../lib/supabase-server";

const AIRPORT = "GOT";
const TIME_ZONE = "Europe/Stockholm";
const SWEDAVIA_BASE = "https://api.swedavia.se/flightinfo/v2";
type FlightType = "arrivals" | "departures";

type CachedResponse = {
  expiresAt: number;
  payload: ReturnType<typeof normalizePayload>;
};

const cache = new Map<string, CachedResponse>();

function stockholmDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstText(...values: unknown[]) {
  return values.map(text).find(Boolean) || "";
}

function timestamp(value: unknown) {
  const candidate = text(value);
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : null;
}

function flightNumber(row: any) {
  return firstText(
    row?.flightId,
    row?.flightNumber,
    row?.marketingFlightNumber,
    row?.operatingFlightNumber,
  );
}

function isLandvetter(value: unknown) {
  return /(?:göteborg\s+)?landvetter|got\s*(?:airport|flygplats)/i.test(
    String(value || ""),
  );
}

function normalizeFlight(
  row: any,
  fallbackUpdatedUtc: string,
  flightType: FlightType,
) {
  const time =
    flightType === "departures" ? row?.departureTime : row?.arrivalTime;
  const scheduledUtc = timestamp(time?.scheduledUtc ?? row?.scheduledUtc);
  const estimatedUtc = timestamp(time?.estimatedUtc ?? row?.estimatedUtc);
  const actualUtc = timestamp(time?.actualUtc ?? row?.actualUtc);
  const comparisonUtc = actualUtc || estimatedUtc;
  const delayMinutes =
    scheduledUtc && comparisonUtc
      ? Math.max(
          0,
          Math.round(
            (Date.parse(comparisonUtc) - Date.parse(scheduledUtc)) / 60000,
          ),
        )
      : 0;
  const location = row?.locationAndStatus ?? {};
  const baggage = row?.baggage ?? {};
  const checkIn = row?.checkIn ?? {};
  return {
    id: firstText(
      row?.flightId,
      row?.id,
      `${flightNumber(row)}-${scheduledUtc}`,
    ),
    flightNumber: flightNumber(row),
    origin: firstText(
      row?.departureAirportSwedish,
      row?.departureAirportEnglish,
      row?.departureAirportIata,
      row?.from?.airportSwedish,
      row?.from?.airportEnglish,
      row?.from?.iata,
    ),
    originIata: firstText(row?.departureAirportIata, row?.from?.iata),
    destination: firstText(
      row?.arrivalAirportSwedish,
      row?.arrivalAirportEnglish,
      row?.arrivalAirportIata,
      row?.to?.airportSwedish,
      row?.to?.airportEnglish,
      row?.to?.iata,
    ),
    destinationIata: firstText(row?.arrivalAirportIata, row?.to?.iata),
    airline: firstText(
      row?.airlineOperator?.name,
      row?.airline?.name,
      row?.airlineOperator?.iata,
    ),
    scheduledUtc,
    estimatedUtc,
    actualUtc,
    delayMinutes,
    statusCode: firstText(location?.flightLegStatus, row?.statusCode),
    status: firstText(
      location?.flightLegStatusSwedish,
      location?.flightLegStatusEnglish,
      row?.status,
    ),
    terminal: firstText(location?.terminal, row?.terminal),
    gate: firstText(location?.gate, row?.gate),
    gateAction: firstText(
      location?.gateActionSwedish,
      location?.gateActionEnglish,
      location?.gateAction,
    ),
    gateOpenUtc: timestamp(location?.gateOpenUtc),
    gateCloseUtc: timestamp(location?.gateCloseUtc),
    checkInStatus: firstText(
      checkIn?.checkInStatusSwedish,
      checkIn?.checkInStatusEnglish,
      checkIn?.checkInStatus,
    ),
    checkInDeskFrom: firstText(checkIn?.checkInDeskFrom),
    checkInDeskTo: firstText(checkIn?.checkInDeskTo),
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
    baggageStatus: firstText(
      baggage?.baggageStatusSwedish,
      baggage?.statusSwedish,
      baggage?.baggageStatusEnglish,
      baggage?.statusEnglish,
      baggage?.status,
    ),
    updatedUtc:
      timestamp(
        row?.lastUpdatedUtc ??
          row?.updatedUtc ??
          row?.lastUpdated ??
          location?.lastUpdatedUtc,
      ) || fallbackUpdatedUtc,
    direction: flightType === "departures" ? "departure" : "arrival",
  };
}

function normalizePayload(
  raw: any,
  requestedDate: string,
  flightType: FlightType,
  fetchedAt = new Date().toISOString(),
) {
  const rows = Array.isArray(raw?.flights) ? raw.flights : [];
  const topLevelUpdated =
    timestamp(raw?.lastUpdatedUtc ?? raw?.updatedUtc ?? raw?.lastUpdated) ||
    fetchedAt;
  const flights = rows
    .map((row: any) => normalizeFlight(row, topLevelUpdated, flightType))
    .filter((flight: any) => flight.flightNumber && flight.scheduledUtc)
    .sort(
      (a: any, b: any) =>
        Date.parse(a.scheduledUtc) - Date.parse(b.scheduledUtc),
    );
  return {
    airport: AIRPORT,
    type: flightType,
    date: requestedDate,
    timeZone: TIME_ZONE,
    fetchedAt,
    numberOfFlights: flights.length,
    flights,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const trackingToken = url.searchParams.get("trackingToken") || "";
  const bookingId = url.searchParams.get("bookingId") || "";
  let customerDate = "";
  let customerFlightType: FlightType | "" = "";
  if (/^[0-9a-f-]{36}$/i.test(trackingToken)) {
    const booking = await adminSupabase()
      .from("bookings")
      .select("booking_date,pickup_address,dropoff_address")
      .eq("tracking_token", trackingToken)
      .maybeSingle();
    if (booking.error || !booking.data)
      return Response.json(
        { error: "Bokningen hittades inte", code: "TRACKING_LINK_INVALID" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    customerDate = String(booking.data.booking_date || "");
    customerFlightType =
      isLandvetter(booking.data.dropoff_address) &&
      !isLandvetter(booking.data.pickup_address)
        ? "departures"
        : "arrivals";
  } else if (bookingId) {
    try {
      const { user } = await requireSupabaseUser(request);
      const email = String(user.email || "").trim().toLowerCase();
      const booking = await adminSupabase()
        .from("bookings")
        .select("booking_date,pickup_address,dropoff_address")
        .eq("id", bookingId)
        .eq("customer_email", email)
        .maybeSingle();
      if (booking.error || !booking.data)
        return Response.json(
          { error: "Bokningen hittades inte", code: "CUSTOMER_BOOKING_FORBIDDEN" },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
      customerDate = String(booking.data.booking_date || "");
      customerFlightType =
        isLandvetter(booking.data.dropoff_address) &&
        !isLandvetter(booking.data.pickup_address)
          ? "departures"
          : "arrivals";
    } catch (error: any) {
      return Response.json(
        { error: error?.message || "Logga in", code: "LOGIN_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
  } else {
    try {
      const { supabase, user } = await requireSupabaseUser(request);
      const { data: allowed } = await supabase.rpc("is_dispatch_admin");
      if (!allowed) {
        const driver = await supabase
          .from("drivers")
          .select("id")
          .eq("auth_user_id", user.id)
          .eq("approved", true)
          .eq("active", true)
          .is("archived_at", null)
          .maybeSingle();
        if (driver.error || !driver.data)
          return Response.json(
            { error: "Endast dispatch eller förare", code: "STAFF_ONLY" },
            { status: 403, headers: { "Cache-Control": "no-store" } },
          );
      }
    } catch (error: any) {
      return Response.json(
        { error: error?.message || "Logga in", code: "LOGIN_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  const now = Date.now();
  const requestedDate = customerDate || url.searchParams.get("date") || "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : stockholmDate();
  const requestedType = url.searchParams.get("type");
  const flightType: FlightType =
    customerFlightType ||
    (requestedType === "departures" ? "departures" : "arrivals");
  const cacheKey = `${flightType}:${date}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return Response.json(cached.payload, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!env.SWEDAVIA_API_KEY) {
    console.error("swedavia_api_error", {
      code: "SWEDAVIA_API_KEY_MISSING",
      airport: AIRPORT,
    });
    return Response.json(
      {
        error: "Swedavia FlightInfo är inte konfigurerat.",
        code: "SWEDAVIA_API_KEY_MISSING",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const response = await fetch(
      `${SWEDAVIA_BASE}/${AIRPORT}/${flightType}/${date}`,
      {
        headers: {
          "Ocp-Apim-Subscription-Key": env.SWEDAVIA_API_KEY,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const body = (await response.text())
        .replaceAll(env.SWEDAVIA_API_KEY, "[REDACTED]")
        .slice(0, 500);
      const requestId = firstText(
        response.headers.get("apim-request-id"),
        response.headers.get("x-request-id"),
      );
      console.error("swedavia_api_error", {
        code: `SWEDAVIA_HTTP_${response.status}`,
        status: response.status,
        statusText: response.statusText,
        requestId: requestId || undefined,
        response: body,
        airport: AIRPORT,
        type: flightType,
        date,
      });
      return Response.json(
        {
          error: `Swedavia kunde inte hämta dagens ${flightType === "departures" ? "avgångar" : "ankomster"}.`,
          code: `SWEDAVIA_HTTP_${response.status}`,
          status: response.status,
          requestId: requestId || null,
          detail: body || response.statusText,
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const lastModified =
      timestamp(response.headers.get("last-modified")) ||
      new Date().toISOString();
    const payload = normalizePayload(
      await response.json(),
      date,
      flightType,
      lastModified,
    );
    cache.set(cacheKey, { expiresAt: now + 30_000, payload });
    console.info("swedavia_flights_loaded", {
      airport: AIRPORT,
      type: flightType,
      date,
      flights: payload.numberOfFlights,
      fetchedAt: payload.fetchedAt,
    });
    return Response.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: any) {
    console.error("swedavia_api_error", {
      code: "SWEDAVIA_FETCH_FAILED",
      message: error?.message || String(error),
      airport: AIRPORT,
      type: flightType,
      date,
    });
    return Response.json(
      {
        error: "Swedavia kunde inte nås.",
        code: "SWEDAVIA_FETCH_FAILED",
        detail: error?.message || String(error),
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
