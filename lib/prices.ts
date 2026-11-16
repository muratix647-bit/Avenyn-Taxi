export const LANDVETTER_AIRPORT_ID="se-got-landvetter-airport";

export const LANDVETTER_AIRPORT={
  id:LANDVETTER_AIRPORT_ID,
  label:"Landvetter Airport (Göteborg Landvetter Airport)",
  primary:"Göteborg Landvetter Airport",
  secondary:"Flygplatsvägen, 438 80 Landvetter",
  lat:57.6688,
  lng:12.2923,
} as const;

export function isLandvetterAirport(value:string,id?:string){
  if(id===LANDVETTER_AIRPORT_ID)return true;
  const normalized=value.toLocaleLowerCase("sv").replace(/[,.()]/g," ").replace(/\s+/g," ").trim();
  return /landvetter\s+(airport|flygplats)|(?:airport|flygplats)\s+landvetter|gothenburg\s+airport|göteborg\s+(landvetter\s+)?(airport|flygplats)|got\s+airport|flygplatsvägen.*438\s*80|438\s*80.*(landvetter|härryda)/i.test(normalized);
}

export function allowsMeteredFallback(
  pickupAddress: string,
  dropoffAddress: string,
  pickupPlaceId?: string | null,
  dropoffPlaceId?: string | null,
) {
  if (isLandvetterAirport(pickupAddress, pickupPlaceId ?? undefined) ||
      isLandvetterAirport(dropoffAddress, dropoffPlaceId ?? undefined)) return false;
  return Boolean(pickupAddress.trim() && dropoffAddress.trim());
}
