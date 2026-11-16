import {applyDynamicPrice} from './dynamic-pricing-server';
import { publicSupabase } from "./supabase-server";
import { fixedZoneResultAllowed, identifyZone, matchTrustedArea, type PriceZone } from "./geo-zones";
import { GOTHENBURG_CENTRAL_ID } from "./places";
import { reverseAreaHierarchy } from "./reverse-area";
import { allowsMeteredFallback, isLandvetterAirport } from "./prices";

type QuoteInput = {
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  stopAddress?: string | null;
  stopLat?: number | null;
  stopLng?: number | null;
  stopPlaceId?: string | null;
  stopArea?: string | null;
  pickupPlaceId?: string | null;
  dropoffPlaceId?: string | null;
  pickupArea?: string | null;
  dropoffArea?: string | null;
  carType?: string;
  childSeats?: number;
  pickupTime?: string;
};

async function trustedArea(input: QuoteInput, airportIsDropoff: boolean) {
  const supabase = publicSupabase();
  const lat = Number(airportIsDropoff ? input.pickupLat : input.dropoffLat);
  const lng = Number(airportIsDropoff ? input.pickupLng : input.dropoffLng);
  const placeId = airportIsDropoff ? input.pickupPlaceId : input.dropoffPlaceId;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 54 || lat > 70 || lng < 8 || lng > 25) return null;
  // Independent remote reads start together; retain all district evidence.
  const [{data: zones, error}, hierarchy] = await Promise.all([
    supabase.from("price_zones").select("code,name,aliases,boundary")
      .eq("active", true).eq("destination_code", "se-got-landvetter-airport"),
    reverseAreaHierarchy(lat, lng),
  ]);
  if (error) throw error;
  const catalog = (zones ?? []) as PriceZone[];
  // Fare evidence comes from the server lookup, never editable address text.
  const structuredValues = placeId === GOTHENBURG_CENTRAL_ID
    ? ["Göteborg Centralstation", ...hierarchy.values]
    : hierarchy.values;
  const spatial = identifyZone(catalog, lat, lng, structuredValues);
  const structured = spatial ?? matchTrustedArea(catalog, lat, lng, hierarchy.values);
  console.info("price_zone_identified", {
    lat,
    lng,
    method: spatial ? "structured_area" : structured ? "trusted_district_polygon_gap" : "unmatched",
    code: structured?.code ?? null,
    name: structured?.name ?? null,
    structuredAreas: hierarchy.values,
  });
  return structured?.name ?? null;
}

function isRejectedCentral(row: any, input: QuoteInput, airportIsDropoff: boolean) {
  const placeId = airportIsDropoff ? input.pickupPlaceId : input.dropoffPlaceId;
  const lat = Number(airportIsDropoff ? input.pickupLat : input.dropoffLat);
  const lng = Number(airportIsDropoff ? input.pickupLng : input.dropoffLng);
  if (fixedZoneResultAllowed(row?.zone_code, row?.zone_name, placeId === GOTHENBURG_CENTRAL_ID, lat, lng)) return false;
  console.warn("price_zone_rejected", {
    code: row?.zone_code ?? null,
    name: row?.zone_name ?? null,
    reason: "central_requires_station_place_id_and_coordinates",
  });
  return true;
}

function stockholmTime(value?: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value ?? "");
  if (!match) return null;
  const wanted = match.slice(1).map(Number);
  const target = Date.UTC(wanted[0], wanted[1] - 1, wanted[2], wanted[3], wanted[4]);
  let instant = target;
  const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    instant += target - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  }
  return instant;
}

async function roadRoute(input: QuoteInput) {
  const hasStop = Boolean(input.stopAddress?.trim());
  const rawCoordinates = [
    input.pickupLng,
    input.pickupLat,
    ...(hasStop ? [input.stopLng, input.stopLat] : []),
    input.dropoffLng,
    input.dropoffLat,
  ];
  if (rawCoordinates.some((value) => value === null || value === undefined)) return null;
  const coordinates = rawCoordinates.map(Number);
  if (!coordinates.every(Number.isFinite)) return null;
  const pickupLng = Number(input.pickupLng), pickupLat = Number(input.pickupLat),
    dropoffLng = Number(input.dropoffLng), dropoffLat = Number(input.dropoffLat),
    stopLng = Number(input.stopLng), stopLat = Number(input.stopLat);
  const approximateRoute = () => {
    const radians = (value: number) => value * Math.PI / 180;
    const direct = (startLatValue: number, startLngValue: number, endLatValue: number, endLngValue: number) => {
      const deltaLat = radians(endLatValue - startLatValue);
      const deltaLng = radians(endLngValue - startLngValue);
      const startLatRadians = radians(startLatValue);
      const endLatRadians = radians(endLatValue);
      const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(startLatRadians) * Math.cos(endLatRadians) * Math.sin(deltaLng / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    const directKm = hasStop
      ? direct(pickupLat, pickupLng, stopLat, stopLng) + direct(stopLat, stopLng, dropoffLat, dropoffLng)
      : direct(pickupLat, pickupLng, dropoffLat, dropoffLng);
    if (!Number.isFinite(directKm) || directKm < 0.2) return null;
    const distanceKm = directKm * 1.3;
    return { distanceKm, durationMinutes: Math.max(5, distanceKm / 32 * 60), estimated: true };
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const routeCoordinates = hasStop
      ? `${pickupLng},${pickupLat};${stopLng},${stopLat};${dropoffLng},${dropoffLat}`
      : `${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}`;
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${routeCoordinates}?overview=false&alternatives=false&steps=false`, { cache: "no-store", signal: controller.signal, headers: { "User-Agent": "AvenynTaxi/1.0 info@avenyntaxi.se" } });
    if (!response.ok) return approximateRoute();
    const result: any = await response.json();
    const route = result?.routes?.[0];
    const distanceKm = Number(route?.distance) / 1000;
    const durationMinutes = Number(route?.duration) / 60;
    return Number.isFinite(distanceKm) && Number.isFinite(durationMinutes) && distanceKm > 0 && durationMinutes > 0 ? { distanceKm, durationMinutes, estimated: false } : approximateRoute();
  } catch { return approximateRoute(); }
  finally { clearTimeout(timeout); }
}

async function quoteBaseTrip(input: QuoteInput) {
  const supabase = publicSupabase();
  const params = (areaHint: string | null) => ({
    p_pickup_address: input.pickupAddress,
    p_dropoff_address: input.dropoffAddress,
    p_pickup_lat: input.pickupLat ?? null,
    p_pickup_lng: input.pickupLng ?? null,
    p_dropoff_lat: input.dropoffLat ?? null,
    p_dropoff_lng: input.dropoffLng ?? null,
    p_pickup_place_id: input.pickupPlaceId ?? null,
    p_dropoff_place_id: input.dropoffPlaceId ?? null,
    p_area_hint: areaHint,
    p_car_type: input.carType ?? "standard",
    p_child_seats: input.childSeats ?? 0,
  });

  const airportFrom = isLandvetterAirport(input.pickupAddress, input.pickupPlaceId ?? undefined);
  const airportTo = isLandvetterAirport(input.dropoffAddress, input.dropoffPlaceId ?? undefined);
  const airportIsDropoff = airportTo && !airportFrom;
  const calculatedAirportFixedPrice = airportFrom !== airportTo;
  if (airportFrom !== airportTo) {
    const area = await trustedArea(input, airportTo);
    if (area) {
      const second = await supabase.rpc("avenyn_quote", params(area));
      if (second.error) throw second.error;
      if (second.data?.[0]?.total_price != null && !isRejectedCentral(second.data[0], input, airportTo)) return second.data[0];
    }
  }
  const first = await supabase.rpc("avenyn_quote", params(null));
  if (first.error) throw first.error;
  let row = first.data?.[0];
  if (row?.total_price != null) {
    if (!isRejectedCentral(row, input, airportIsDropoff)) return row;
    row = { ...row, zone_code: null, zone_name: null, base_price: null, total_price: null, reason: "manual_quote_required" };
  }
  // Zone fares always win. Outside the catalogue, offer a signed, upfront
  // fixed airport fare using the existing route tariff, never a running meter.
  if (!calculatedAirportFixedPrice && !allowsMeteredFallback(input.pickupAddress, input.dropoffAddress, input.pickupPlaceId, input.dropoffPlaceId)) return row;
  const [route, settings] = await Promise.all([
    roadRoute(input),
    supabase.from("fare_settings").select("child_seat_surcharge,large_vehicle_surcharge,instant_start_fee,prebooked_start_fee,price_per_km,instant_price_per_hour,prebooked_price_per_hour").eq("id", true).maybeSingle(),
  ]);
  if (!route) return row;
  if (settings.error) throw settings.error;
  const pickupAt = stockholmTime(input.pickupTime);
  const isPrebooked = pickupAt !== null && pickupAt - Date.now() > 60 * 60 * 1000;
  const base = Number(isPrebooked ? settings.data?.prebooked_start_fee ?? 50 : settings.data?.instant_start_fee ?? 60);
  const perKm = Number(settings.data?.price_per_km ?? 15);
  const perHour = Number(isPrebooked ? settings.data?.prebooked_price_per_hour ?? 720 : settings.data?.instant_price_per_hour ?? 300);
  const perMinute = perHour / 60;
  const large = String(input.carType ?? "standard").toLowerCase() === "large" ? Number(settings.data?.large_vehicle_surcharge ?? 300) : 0;
  const child = Math.max(0, Math.min(3, Number(input.childSeats) || 0)) * Number(settings.data?.child_seat_surcharge ?? 100);
  const calculatedRoutePrice = Math.round(base + route.distanceKm * perKm + route.durationMinutes * perMinute);
  const routePrice = isPrebooked && route.distanceKm <= 4 ? Math.max(400, calculatedRoutePrice) : calculatedRoutePrice;
  return { zone_code: null, zone_name: null, base_price: routePrice, large_surcharge: large, child_seat_surcharge: child, total_price: routePrice + large + child, reason: calculatedAirportFixedPrice ? "calculated_fixed_landvetter" : route.estimated ? "estimated_route" : "metered_route", route_estimated: route.estimated, distance_km: route.distanceKm, duration_minutes: route.durationMinutes, booking_type: isPrebooked ? "prebooking" : "instant" };
}

async function quoteBeforeDynamic(input: QuoteInput) {
  const hasStop = Boolean(input.stopAddress?.trim());
  if (!hasStop) return quoteBaseTrip(input);

  const directInput: QuoteInput = {
    ...input,
    stopAddress: null,
    stopLat: null,
    stopLng: null,
    stopPlaceId: null,
    stopArea: null,
  };
  const [baseQuote, directRoute, viaStopRoute] = await Promise.all([
    quoteBaseTrip(directInput),
    roadRoute(directInput),
    roadRoute(input),
  ]);
  if (baseQuote?.total_price == null || !directRoute || !viaStopRoute) return null;

  const extraDistanceKm = Math.max(0, viaStopRoute.distanceKm - directRoute.distanceKm);
  const stopSurcharge = Math.round(extraDistanceKm * 35);
  return {
    ...baseQuote,
    base_price: Number(baseQuote.base_price) + stopSurcharge,
    total_price: Number(baseQuote.total_price) + stopSurcharge,
    direct_distance_km: directRoute.distanceKm,
    direct_duration_minutes: directRoute.durationMinutes,
    via_distance_km: viaStopRoute.distanceKm,
    via_duration_minutes: viaStopRoute.durationMinutes,
    stop_extra_distance_km: extraDistanceKm,
    stop_surcharge: stopSurcharge,
  };
}

export async function quoteTrip(input:QuoteInput){
 if(input.pickupTime==='now')input={...input,pickupTime:new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).replace(' ','T')};
 const quote=await quoteBeforeDynamic(input);
 const airport=[input.pickupAddress,input.dropoffAddress,input.stopAddress].some(a=>isLandvetterAirport(a||'')) || [[input.pickupLat,input.pickupLng],[input.dropoffLat,input.dropoffLng],[input.stopLat,input.stopLng]].some(([lat,lng])=>lat!=null&&lng!=null&&Math.abs(Number(lat)-57.6688)<.018&&Math.abs(Number(lng)-12.2923)<.025);
 if(quote?.booking_type==='instant'&&quote.total_price!=null&&!airport){const reduction=Math.round(Number(quote.base_price)*.2);quote.base_price=Number(quote.base_price)-reduction;quote.total_price=Number(quote.total_price)-reduction;quote.instant_discount_percent=20;}
 return applyDynamicPrice(input,quote);
}
