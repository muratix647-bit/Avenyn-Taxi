"use client";
import {googleApi} from "./live-map-engine";
import {LANDVETTER_AIRPORT,isLandvetterAirport} from "./prices";
import {GOTHENBURG_CENTRAL,isGothenburgCentralSearch} from "./places";

let library: Promise<any> | undefined;
const predictions = new Map<string, any>();
function deadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("address_timeout")),ms);
    promise.then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)});
  });
}
export function warmAddressSearch() {
  if(!library) library=(async()=>{
    const response=await fetch("/api/maps/config",{signal:AbortSignal.timeout(2000)});
    if(!response.ok) throw new Error("maps_config_unavailable");
    const {browserKey}=await response.json() as {browserKey?:string};
    if(!browserKey) throw new Error("maps_key_missing");
    const maps=await deadline(googleApi(browserKey),3000);
    return maps.importLibrary("places");
  })().catch(error=>{library=undefined;throw error});
  return library;
}
export function knownAddresses(query:string): any[] {
  const q=query.trim().toLocaleLowerCase("sv").replace(/\s/g,"");
  return [
    ...(isGothenburgCentralSearch(query)?[GOTHENBURG_CENTRAL]:[]),
    ...(q.length>=2&&("landvetter".startsWith(q)||q.includes("landvetter")||q==="got")?[{...LANDVETTER_AIRPORT,primary:"Göteborg Landvetter Airport",secondary:"Flygplatsvägen, 438 80 Landvetter",kind:"airport"}]:[]),
  ];
}
// Each field owns a session; predictions contain no coordinates until selected.
export function createAddressSearch() {
  let token:any;
  return async (query:string,signal:AbortSignal):Promise<any[]>=>{
    const start=performance.now();
    try {
      const places=await deadline(warmAddressSearch(),3500);
      if(signal.aborted) throw new DOMException("Aborted","AbortError");
      token ||= new places.AutocompleteSessionToken();
      const {suggestions}=await deadline<any>(places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input:query,sessionToken:token,includedRegionCodes:["se"],language:"sv",region:"se",
        locationBias:{center:{lat:57.7089,lng:11.9746},radius:50000},
      }),2500);
      if(signal.aborted) throw new DOMException("Aborted","AbortError");
      const hits=suggestions.filter((s:any)=>s.placePrediction).map(({placePrediction:p}:any)=>{
        const id=`google:${p.placeId}`;
        predictions.set(id,{prediction:p,finish:()=>{token=undefined}});
        return {id,label:p.text.toString(),primary:p.mainText?.toString()||p.text.toString(),secondary:p.secondaryText?.toString()||"",provider:"google"};
      });
      while(predictions.size>200) predictions.delete(predictions.keys().next().value!);
      performance.measure("address-google-suggestions",{start,duration:performance.now()-start});
      return [...knownAddresses(query),...hits];
    } catch(error) {
      if(signal.aborted) throw error;
      const known=knownAddresses(query);
      if(known.length) return known;
      const response=await fetch(`/api/addresses?v=3&q=${encodeURIComponent(query)}`,{
        signal:AbortSignal.any([signal,AbortSignal.timeout(4500)]),cache:"no-store",
      });
      if(!response.ok) throw new Error("address_search_failed");
      const result=await response.json();
      performance.measure("address-fallback-suggestions",{start,duration:performance.now()-start});
      return Array.isArray(result)?result:[];
    }
  };
}
export async function resolveAddress(p:any):Promise<any> {
  if(!p.id?.startsWith("google:")) return p;
  const entry=predictions.get(p.id);
  const library=await warmAddressSearch();
  const place=entry?entry.prediction.toPlace():new library.Place({id:p.id.slice(7),requestedLanguage:"sv"});
  await deadline(place.fetchFields({fields:["location","addressComponents","formattedAddress"]}),4000);
  entry?.finish();
  if(!place.location) throw new Error("address_coordinates_missing");
  if(isLandvetterAirport(p.label)) return {...LANDVETTER_AIRPORT,primary:"Göteborg Landvetter Airport",kind:"airport"};
  const part=(type:string)=>place.addressComponents?.find((c:any)=>c.types.includes(type))?.longText;
  return {...p,lat:place.location.lat(),lng:place.location.lng(),kind:part("street_number")?"address":"place",
    components:{street:part("route"),houseNumber:part("street_number"),district:part("sublocality_level_1"),postcode:part("postal_code"),city:part("locality")||part("postal_town")}};
}
