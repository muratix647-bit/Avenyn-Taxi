import {readFile, writeFile} from "node:fs/promises";

const WFS_URL = "https://geodata-external.sbk.goteborg.se/services/slk-administrativ-indelning-v2/wfs";
const SOURCE_URL = "https://karta.goteborg.se/?m=administrativ-indelning";
const TYPE_NAME = "slk-administrativ-indelning-v2:primaromraden";

const normalize = (value) => String(value ?? "")
  .toLocaleLowerCase("sv")
  .normalize("NFC")
  .replace(/[^a-zåäö0-9]+/gi, " ")
  .replace(/\s+/g, " ")
  .trim();

// Mapping between official municipal primary-area names and differently named
// commercial zones in the published price list. These are area relationships,
// never individual streets or addresses.
const OFFICIAL_AREA_TO_ZONE = {
  "Angereds centrum": "angered-c",
  "Frölunda Torg": "frolunda",
  "Gamlestaden": "gamlestan",
  "Grevegården": "tynnered",
  "Gårdstensberget": "gardsten",
  "Kannebäck": "tynnered",
  "Norra Biskopsgården": "biskopsgarden",
  "Norra Kortedala": "kortedala",
  "Olivedal": "linn",
  "Rambergsstaden": "ramberget",
  "Södra Biskopsgården": "biskopsgarden",
  "Södra Kortedala": "kortedala",
  "Vasastaden": "vasastan",
  "Västra Bergsjön": "bergsjon",
  "Östra Bergsjön": "bergsjon",
};

const catalog = JSON.parse(await readFile("scripts/generated-price-zone-boundaries.json", "utf8"));
const zones = catalog.results.map(({code, name}) => ({code, name}));
const zoneByName = new Map(zones.map((zone) => [normalize(zone.name), zone]));
const zoneByCode = new Map(zones.map((zone) => [zone.code, zone]));

const params = new URLSearchParams({
  service: "WFS",
  version: "2.0.0",
  request: "GetFeature",
  typeNames: TYPE_NAME,
  outputFormat: "application/json",
  srsName: "EPSG:4326",
});
let response;
for (let attempt = 1; attempt <= 4; attempt++) {
  response = await fetch(`${WFS_URL}?${params}`, {headers: {"User-Agent": "AvenynTaxiZoneBuilder/1.0 info@avenyntaxi.se"}});
  if (response.ok) break;
  if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
}
if (!response?.ok) throw new Error(`Official WFS returned ${response?.status ?? "no response"}`);
const collection = await response.json();

const grouped = new Map();
const unmatched = [];
for (const feature of collection.features ?? []) {
  const officialName = feature?.properties?.namn;
  const mappedCode = OFFICIAL_AREA_TO_ZONE[officialName];
  const zone = mappedCode ? zoneByCode.get(mappedCode) : zoneByName.get(normalize(officialName));
  if (!zone) {
    unmatched.push(officialName);
    continue;
  }
  const features = grouped.get(zone.code) ?? [];
  features.push(feature);
  grouped.set(zone.code, features);
}

const results = [...grouped.entries()].map(([code, features]) => {
  const zone = zoneByCode.get(code);
  const polygons = features.flatMap((feature) => feature.geometry.type === "MultiPolygon"
    ? feature.geometry.coordinates
    : [feature.geometry.coordinates]);
  return {
    code,
    name: zone.name,
    officialAreas: features.map((feature) => feature.properties.namn),
    geometry: {type: "MultiPolygon", coordinates: polygons},
  };
}).sort((a, b) => a.name.localeCompare(b.name, "sv"));

const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sqlRows = results.map((result) => `(${sqlLiteral(result.code)}, ${sqlLiteral(JSON.stringify(result.geometry))}::jsonb)`);
const sql = `-- Generated from Göteborgs Stads official administrative-area WFS.\n-- Updates geometry only; prices and all other production data remain unchanged.\nwith official_boundaries(code, geometry) as (\n  values\n  ${sqlRows.join(",\n  ")}\n)\nupdate public.price_zones as zone\nset boundary = extensions.st_multi(extensions.st_collectionextract(extensions.st_makevalid(extensions.st_setsrid(extensions.st_geomfromgeojson(official.geometry), 4326)), 3)),\n    updated_at = now()\nfrom official_boundaries as official\nwhere zone.code = official.code\n  and zone.active = true;\n`;

await writeFile("scripts/generated-gothenburg-municipal-boundaries.json", `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: SOURCE_URL,
  wfs: WFS_URL,
  featureType: TYPE_NAME,
  officialAreaCount: collection.features?.length ?? 0,
  matchedZoneCount: results.length,
  matchedOfficialAreaCount: results.reduce((sum, result) => sum + result.officialAreas.length, 0),
  unmatchedOfficialAreas: unmatched.sort((a, b) => a.localeCompare(b, "sv")),
  results,
}, null, 2)}\n`);
await writeFile("scripts/generated-gothenburg-municipal-boundaries.sql", sql);

console.log(JSON.stringify({
  officialAreas: collection.features?.length ?? 0,
  matchedZones: results.length,
  matchedOfficialAreas: results.reduce((sum, result) => sum + result.officialAreas.length, 0),
  unmatchedOfficialAreas: unmatched.length,
}, null, 2));
