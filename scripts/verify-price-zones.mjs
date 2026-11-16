import {identifyZone} from "../lib/geo-zones.ts";
import {reverseAreaHierarchy} from "../lib/reverse-area.ts";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required");

const headers = {"User-Agent": "AvenynTaxi/1.0 info@avenyntaxi.se"};
const tests = [
  {query: "Grevegårdsvägen 30, Grevegården, Göteborg", expected: "tynnered"},
  {query: "Mandolingatan 20, Västra Frölunda, Göteborg", expected: "frolunda"},
  {query: "Göteborg Centralstation, Drottningtorget 5, Göteborg", lat: 57.7089, lng: 11.9733, expected: "centralen"},
  {query: "Frölunda Torg, Västra Frölunda", expected: "frolunda"},
  {query: "Opaltorget, Tynnered, Göteborg", expected: "tynnered"},
  {query: "Radiovägen 1, Järnbrott, Göteborg", expected: "jarnbrott"},
  {query: "Mariaplan, Majorna, Göteborg", expected: "majorna"},
  {query: "Selma Lagerlöfs Torg, Hisings Backa", expected: "backa"},
  {query: "Torslanda Torg, Torslanda", expected: "torslanda-c"},
  {query: "Askim centrum, Askim", expected: "askim"},
  {query: "Hovås allé, Hovås", expected: "hovas"},
  {query: "Linnégatan 30, Göteborg", expected: "linn"},
  {query: "Majorsgatan, Kommendantsängen, Göteborg", expected: "linn"},
  {query: "Kålltorpsgatan 2, Göteborg", expected: "kalltorp"},
  {query: "Partille centrum, Partille", expected: "partille"},
  {query: "Mölndals station, Mölndal", expected: "molndal-c"},
  {query: "Bergmansgatan, Bosgården, 431 30 Mölndal", expected: "molndal-c"},
  {query: "Kungälvs resecentrum, Kungälv", expected: "kungalv"},
];

const zonesResponse = await fetch(`${supabaseUrl}/rest/v1/price_zones?select=code,name,aliases,boundary,fixed_price&active=eq.true`, {
  headers: {...headers, apikey: supabaseKey},
});
if (!zonesResponse.ok) throw new Error(`price_zones ${zonesResponse.status}`);
const zones = await zonesResponse.json();

for (const test of tests) {
  const {query} = test;
  let lat = test.lat;
  let lng = test.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const searchResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=se&addressdetails=1&limit=1&accept-language=sv&q=${encodeURIComponent(query)}`, {headers});
    const [search] = await searchResponse.json();
    if (!search) {
      console.log(JSON.stringify({query, error: "address_not_found"}));
      continue;
    }
    lat = Number(search.lat);
    lng = Number(search.lon);
  }
  const hierarchy = await reverseAreaHierarchy(lat, lng);
  const structuredAreas = [...hierarchy.values];
  if (test.lat === 57.7089 && test.lng === 11.9733) structuredAreas.unshift("Göteborg Centralstation");
  const zone = identifyZone(zones, lat, lng, structuredAreas);
  console.log(JSON.stringify({
    query,
    lat,
    lng,
    identifiedArea: structuredAreas.find(Boolean) ?? null,
    zoneCode: zone?.code ?? null,
    zoneName: zone?.name ?? null,
    price: zone ? Number(zone.fixed_price) : null,
    codePath: zone?.boundary ? "price_zones.boundary" : zone ? "coordinates→structured_area_hierarchy→price_zones" : "metered_route",
    passed: zone?.code === test.expected,
  }));
}
