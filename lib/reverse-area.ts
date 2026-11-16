export type StructuredArea = {
  values: string[];
  primary: string | null;
  details: Record<string, unknown>;
};

const headers = {"User-Agent": "AvenynTaxi/1.0 info@avenyntaxi.se"};
const AREA_FIELDS = ["neighbourhood", "suburb", "quarter", "hamlet", "isolated_dwelling", "city_district", "town", "village", "city"] as const;
// Postal locality fills gaps where the geocoder only supplies a municipality.
// 427 50 is Billdal, including Spårhaga/Hällesås across municipal borders.
// Source: https://billdal.se/boende/omraden/sparhaga/
const POSTAL_LOCALITIES: Record<string, string> = {"42750": "Billdal"};
const cache = new Map<string, {expires: number; value: StructuredArea}>();
const pending = new Map<string, Promise<StructuredArea>>();
const unique = (values: unknown[]) => Array.from(new Set(values
  .map(value => typeof value === "string" ? value.trim() : "")
  .filter(value => value && !/\b(kommun|municipality|län|county)$/i.test(value))));

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {headers, cache: "no-store", signal: controller.signal});
    if (!response.ok) return null;
    return await response.json() as any;
  } catch { return null; }
  finally { clearTimeout(timeout); }
}

export function areaHierarchyFromResults(photon: any, detail: any, district: any): StructuredArea {
  const feature = photon?.features?.find((item: any) => item?.properties?.street) ?? photon?.features?.[0];
  const properties = feature?.properties ?? {};
  const addresses = [detail?.address ?? {}, {neighbourhood: properties.district, suburb: properties.locality, city: properties.city}, district?.address ?? {}];
  const postalLocality = POSTAL_LOCALITIES[String(detail?.address?.postcode ?? properties.postcode ?? "").replace(/\s/g, "")];
  // Local districts precede towns. Counties, state names, road names and a
  // municipality are not evidence for a town-centre fare.
  const values = unique([...AREA_FIELDS.flatMap(field => addresses.map(address => address[field])), postalLocality]);
  return {values, primary: values[0] ?? null, details: detail?.address ?? properties};
}

/** Resolve both the street locality and the broader district concurrently. */
export async function reverseAreaHierarchy(lat: number, lng: number): Promise<StructuredArea> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {values: [], primary: null, details: {}};
  const key = `${lat},${lng}`; // Never merge nearby points across a zone boundary.
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (pending.has(key)) return pending.get(key)!;
  const request = (async () => {
    const started = performance.now();
    const base = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=sv`;
    const [photon, detail, district] = await Promise.all([
      // Photon rejects lang=sv with HTTP 400. Default language preserves local names.
      fetchJson(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`),
      fetchJson(`${base}&zoom=18`),
      fetchJson(`${base}&zoom=13`),
    ]);
    const value = areaHierarchyFromResults(photon, detail, district);
    console.info("price_area_lookup", {durationMs: Math.round(performance.now()-started), photon: Boolean(photon), detail: Boolean(detail), district: Boolean(district)});
    // Never keep a partial/failed lookup: retry it on the next quote.
    if (detail && district && value.values.length) {
      cache.set(key, {expires: Date.now()+10*60*1000, value});
      if (cache.size > 500) cache.delete(cache.keys().next().value!);
    }
    return value;
  })();
  pending.set(key, request);
  try { return await request; } finally { pending.delete(key); }
}
