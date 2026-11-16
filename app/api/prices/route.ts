import {companyBookingAccess} from '@/lib/company-portal';
import {selectCompanyRate} from '@/lib/company-pricing';
import {EconomyError} from '@/lib/economy-server';
import {signQuote} from '@/lib/quote-token';
import { publicSupabase } from "../../../lib/supabase-server";
import { quoteTrip } from "../../../lib/quote-server";
import { isLandvetterAirport } from "../../../lib/prices";

const n = (value: string | null) => value === null || value === "" ? null : Number(value);

export async function GET(req: Request) {
  const started=performance.now();
  try {
    const url = new URL(req.url);
    const supabase = publicSupabase();
    const settingsQuery = supabase.from("fare_settings").select("child_seat_surcharge,large_vehicle_surcharge,updated_at").eq("id", true).maybeSingle();
    const settingsPromise = Promise.resolve(settingsQuery).then(({data: settingsRow}) => ({
      childSeatSurcharge: Number(settingsRow?.child_seat_surcharge ?? 100),
      largeVehicleSurcharge: Number(settingsRow?.large_vehicle_surcharge ?? 300),
      updatedAt: settingsRow?.updated_at ?? null,
    }));
    if (url.searchParams.get("catalog") === "1") {
      const { data, error } = await supabase.from("price_zones").select("code,name,region,fixed_price").eq("active", true).order("name");
      if (error) throw error;
      return Response.json({ settings: await settingsPromise, fixedPrices: (data ?? []).map((row) => ({ code: row.code, locality: row.name, region: row.region, destination: "landvetter", price: Number(row.fixed_price), active: true })) });
    }
    const pickup = url.searchParams.get("pickup")?.trim() || "";
    const destination = url.searchParams.get("destination")?.trim() || "";
    const requestKey = url.searchParams.get("requestKey") || null;
    if (!pickup || !destination) return Response.json({ settings: await settingsPromise, quote: null, requestKey });
    const quoteInput = {
      pickupAddress: pickup,
      dropoffAddress: destination,
      pickupLat: n(url.searchParams.get("pickupLat")),
      pickupLng: n(url.searchParams.get("pickupLng")),
      dropoffLat: n(url.searchParams.get("destinationLat")),
      dropoffLng: n(url.searchParams.get("destinationLng")),
      stopAddress: url.searchParams.get("stop"),
      stopLat: n(url.searchParams.get("stopLat")),
      stopLng: n(url.searchParams.get("stopLng")),
      stopPlaceId: url.searchParams.get("stopId"),
      stopArea: url.searchParams.get("stopArea"),
      pickupPlaceId: url.searchParams.get("pickupId"),
      dropoffPlaceId: url.searchParams.get("destinationId"),
      pickupArea: url.searchParams.get("pickupArea"),
      dropoffArea: url.searchParams.get("destinationArea"),
      carType: url.searchParams.get("carType") || "standard",
      childSeats: Number(url.searchParams.get("childSeats") || 0),
      pickupTime: url.searchParams.get("pickupTime") || undefined,
    };
    const corporate=url.searchParams.get('companyId')?await companyBookingAccess(req,{companyId:url.searchParams.get('companyId')},false):null;
    const rate=corporate?selectCompanyRate(corporate.company.contract_rates,quoteInput):null;
    const [normal, settings] = await Promise.all([rate?Promise.resolve({total_price:rate.price,base_price:rate.price,zone_name:rate.from+' → '+rate.to,reason:'company_contract',zone_code:null}):quoteTrip(quoteInput), settingsPromise]);
    const row:any=normal;
    if(corporate&&row?.total_price!=null)row.company_pricing={company_id:corporate.companyId,booker_id:corporate.userId,base:Number(row.total_price),total:Number(row.total_price),rate_id:rate?.id||null,label:rate?'Avtalspris':'Ordinarie bokningspris',extras:[]};
    const quoteToken=row?.total_price==null?null:await signQuote(quoteInput,row);
    const airportRoute = isLandvetterAirport(pickup, url.searchParams.get("pickupId") || undefined) !== isLandvetterAirport(destination, url.searchParams.get("destinationId") || undefined);
    const quote = row?.total_price == null ? null : { companyPrice:!!rate,quoteToken,dynamicPercent:row.dynamic_percent||0,dynamicSurcharge:row.dynamic_surcharge||0, area: row.zone_name, code: row.zone_code, price: Number(row.base_price), totalPrice: Number(row.total_price), type: row.reason === "estimated_route" ? "estimated" : row.reason === "metered_route" ? "metered" : "fixed", distanceKm: row.distance_km == null ? null : Number(row.distance_km), durationMinutes: row.duration_minutes == null ? null : Number(row.duration_minutes), bookingType: row.booking_type ?? null, destination: airportRoute ? "landvetter" : "route", destinationLabel: airportRoute ? "Landvetter Airport (Göteborg Landvetter Airport)" : destination };
    return Response.json({ settings, quote, reason: row?.reason ?? "manual_quote_required", requestKey }, { headers: { "Cache-Control": "no-store", "Server-Timing": `quote;dur=${Math.round(performance.now()-started)}` } });
  } catch (error) {
    if(error instanceof EconomyError)return Response.json({error:error.message},{status:error.status});
    console.error("price_quote_failed", error);
    return Response.json({ error: "Priset kunde inte hämtas. Kontakta oss för fast pris." }, { status: 503 });
  }
}
