export type PriceZone = {
  code: string;
  name: string;
  aliases: string[] | null;
  boundary?: unknown;
};

type Position = [number, number];
type Geometry = {type: "Polygon" | "MultiPolygon"; coordinates: Position[][] | Position[][][]};

const normalize = (value: unknown) => String(value ?? "")
  .toLocaleLowerCase("sv")
  .normalize("NFC")
  .replace(/[^a-zåäö0-9]+/gi, " ")
  .replace(/\s+/g, " ")
  .trim();

// Unambiguous geocoder subareas whose public names differ from the commercial
// area names in Avenyn Taxi's existing price-zone catalogue. These are area
// relationships, never street/address exceptions.
const STRUCTURED_AREA_PARENTS: Record<string, string> = {
  "bosgården": "mölndal c",
  "grevegården": "tynnered",
  "kannebäck": "tynnered",
  "kommendantsängen": "linné",
  "olivedal": "linné",
};

export const CENTRAL_STATION = {lat: 57.7089, lng: 11.9733, radiusMeters: 650};

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fallbackAllowedAtPosition(zone: PriceZone, lat?: number, lng?: number) {
  const isCentral = normalize(zone.code) === "centralen" || normalize(zone.name) === "centralen";
  if (!isCentral) return true;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return isGothenburgCentralPosition(Number(lat), Number(lng));
}

export function isGothenburgCentralPosition(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return distanceMeters(lat, lng, CENTRAL_STATION.lat, CENTRAL_STATION.lng) <= CENTRAL_STATION.radiusMeters;
}

export function fixedZoneResultAllowed(zoneCode: unknown, zoneName: unknown, isCentralPlace: boolean, lat: number, lng: number) {
  const isCentral = normalize(zoneCode) === "centralen" || normalize(zoneName) === "centralen";
  return !isCentral || (isCentralPlace && isGothenburgCentralPosition(lat, lng));
}

function parseWktRing(value: string): Position[] {
  return value.split(",").map((pair) => pair.trim().split(/\s+/).slice(0, 2).map(Number) as Position).filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
}

// PostGIS geometry columns arrive from the Data API as HEXEWKB, not GeoJSON.
function parseHexBoundary(hex: string): Geometry | null {
  try {
    const bytes = Uint8Array.from(hex.match(/../g)!, pair => parseInt(pair, 16));
    const data = new DataView(bytes.buffer); let offset = 0;
    const read = (depth = 0): Geometry => {
      if (depth > 1) throw new Error("nested_geometry");
      const order = data.getUint8(offset++);
      if (order !== 0 && order !== 1) throw new Error("byte_order");
      const little = order === 1;
      const uint = () => { const n = data.getUint32(offset, little); offset += 4; return n; };
      const float = () => { const n = data.getFloat64(offset, little); offset += 8; if (!Number.isFinite(n)) throw new Error("coordinate"); return n; };
      const raw = uint(), base = raw & 0x0fffffff;
      const type = base % 1000;
      const dimensions = 2 + ((raw & 0x80000000) || Math.floor(base / 1000) === 1 || Math.floor(base / 1000) === 3 ? 1 : 0)
        + ((raw & 0x40000000) || Math.floor(base / 1000) === 2 || Math.floor(base / 1000) === 3 ? 1 : 0);
      if ((raw & 0x20000000) && uint() !== 4326) throw new Error("unsupported_srid");
      const count = uint();
      if (count > bytes.length / 4) throw new Error("invalid_count");
      if (type === 3) {
        const rings: Position[][] = [];
        for (let r = 0; r < count; r++) {
          const size = uint();
          if (size > (bytes.length - offset) / (dimensions * 8)) throw new Error("invalid_ring");
          const ring: Position[] = [];
          for (let i = 0; i < size; i++) {
            ring.push([float(), float()]);
            for (let d = 2; d < dimensions; d++) float();
          }
          rings.push(ring);
        }
        return {type:"Polygon",coordinates:rings};
      }
      if (type !== 6) throw new Error("unsupported_geometry");
      const polygons: Position[][][] = [];
      for (let i = 0; i < count; i++) {
        const polygon = read(depth + 1);
        if (polygon.type !== "Polygon") throw new Error("invalid_polygon");
        polygons.push(polygon.coordinates as Position[][]);
      }
      return {type:"MultiPolygon",coordinates:polygons};
    };
    const result = read();
    return offset === bytes.length ? result : null;
  } catch { return null; }
}

function parseBoundary(value: unknown): Geometry | null {
  if (!value) return null;
  if (typeof value === "object") {
    const candidate = (value as any).type === "Feature" ? (value as any).geometry : value;
    if ((candidate as any)?.type === "Polygon" || (candidate as any)?.type === "MultiPolygon") return candidate as Geometry;
    return null;
  }
  const text = String(value).trim().replace(/^SRID=4326;/i, "");
  if (!text) return null;
  if (/^(?:[0-9a-f]{2})+$/i.test(text)) return parseHexBoundary(text);
  if (text.startsWith("{")) {
    try { return parseBoundary(JSON.parse(text)); } catch { return null; }
  }
  const type = text.match(/^\s*(MULTIPOLYGON|POLYGON)/i)?.[1]?.toUpperCase();
  if (!type) return null;
  const body = text.slice(text.indexOf("(")).replace(/^\(+|\)+$/g, "");
  if (type === "POLYGON") {
    const rings = body.split(/\)\s*,\s*\(/).map((ring) => parseWktRing(ring.replace(/[()]/g, "")));
    return {type: "Polygon", coordinates: rings};
  }
  const polygons = body.split(/\)\s*\)\s*,\s*\(\s*\(/).map((polygon) =>
    polygon.split(/\)\s*,\s*\(/).map((ring) => parseWktRing(ring.replace(/[()]/g, ""))),
  );
  return {type: "MultiPolygon", coordinates: polygons};
}

function inRing(point: Position, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    // Match PostGIS ST_Covers: include the edges, including hole boundaries.
    const cross = (point[0]-xi)*(yj-yi)-(point[1]-yi)*(xj-xi);
    if (Math.abs(cross) < 1e-12 && point[0] >= Math.min(xi,xj) && point[0] <= Math.max(xi,xj)
      && point[1] >= Math.min(yi,yj) && point[1] <= Math.max(yi,yj)) return -1;
    const crosses = (yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside ? 1 : 0;
}

function inPolygon(point: Position, polygon: Position[][]) {
  return Boolean(polygon[0]?.length) && inRing(point, polygon[0]) !== 0 && !polygon.slice(1).some((hole) => inRing(point, hole) === 1);
}

export function boundaryContains(boundary: unknown, lat: number, lng: number) {
  const geometry = parseBoundary(boundary);
  if (!geometry) return false;
  const point: Position = [lng, lat];
  return geometry.type === "Polygon"
    ? inPolygon(point, geometry.coordinates as Position[][])
    : (geometry.coordinates as Position[][][]).some((polygon) => inPolygon(point, polygon));
}

export function matchZoneByPosition(zones: PriceZone[], lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Prefer the smallest enclosing zone, as the database quote function does.
  const ringArea = (ring: Position[]) => Math.abs(ring.reduce((sum,p,i)=>{
    const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];
  },0))/2;
  const polygonArea = (rings: Position[][]) => ringArea(rings[0]??[]) - rings.slice(1).reduce((sum,r)=>sum+ringArea(r),0);
  return zones.flatMap(zone=>{
    const geometry=parseBoundary(zone.boundary);if(!geometry)return [];
    const polygons=geometry.type==="Polygon"?[geometry.coordinates as Position[][]]:geometry.coordinates as Position[][][];
    if(!polygons.some(p=>inPolygon([lng,lat],p)))return [];
    return [{zone,area:polygons.reduce((sum,p)=>sum+polygonArea(p),0)}];
  }).sort((a,b)=>a.area-b.area||a.zone.code.localeCompare(b.zone.code))[0]?.zone??null;
}

export function matchZoneWithoutBoundary(zones: PriceZone[], values: unknown[], lat?: number, lng?: number) {
  const direct = values.map(normalize).filter(Boolean);
  const candidates = Array.from(new Set(direct.flatMap((value) => [value, normalize(STRUCTURED_AREA_PARENTS[value])].filter(Boolean))));
  const matches = zones.filter((zone) => !zone.boundary && fallbackAllowedAtPosition(zone, lat, lng)).flatMap((zone) => {
    const names = [zone.name, ...(zone.aliases ?? [])].map(normalize).filter(Boolean);
    return candidates.flatMap((candidate, candidateIndex) => names.map((name) => {
      if (candidate === name) return {zone, score: 100000 - candidateIndex * 100 + name.length};
      return null;
    }).filter((match): match is {zone: PriceZone; score: number} => match !== null));
  });
  matches.sort((a, b) => b.score - a.score);
  return matches[0]?.zone ?? null;
}

export function identifyZone(zones: PriceZone[], lat: number, lng: number, values: unknown[] = []) {
  // Centralstation is the only point-like zone. It must be explicitly named and
  // inside the station guard; it is never a general Göteborg fallback.
  const central = values.map(normalize).includes("göteborg centralstation")
    ? zones.find((zone) => normalize(zone.code) === "centralen" && fallbackAllowedAtPosition(zone, lat, lng))
    : null;
  if (central) return central;

  // An exact structured district without its own polygon is more specific
  // than a broader surrounding municipal polygon (for example Backatorp
  // inside Backa). Otherwise the official polygon remains authoritative.
  return matchZoneWithoutBoundary(zones, values, lat, lng) ?? matchZoneByPosition(zones, lat, lng);
}

/** Server-only evidence: use coordinate-derived district names to fill polygon
 * coverage gaps. Never pass free address text or client-provided area hints. */
export function matchTrustedArea(zones: PriceZone[], lat: number, lng: number, serverAreas: string[]) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 54 || lat > 70 || lng < 8 || lng > 25) return null;
  const candidates = zones
    .filter(zone => normalize(zone.code) !== "centralen" && normalize(zone.name) !== "centralen")
    .map(zone => ({...zone, boundary: null}));
  return matchZoneWithoutBoundary(candidates, serverAreas, lat, lng);
}
