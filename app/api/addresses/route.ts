import {LANDVETTER_AIRPORT} from "../../../lib/prices";
import {GOTHENBURG_CENTRAL,isGothenburgCentralSearch} from "../../../lib/places";
import {identifyZone,matchTrustedArea,type PriceZone} from "../../../lib/geo-zones";
import {publicSupabase} from "../../../lib/supabase-server";
import {reverseAreaHierarchy} from "../../../lib/reverse-area";

const headers={"User-Agent":"AvenynTaxi/1.0 info@avenyntaxi.se"};
const responseHeaders={"Cache-Control":"public, max-age=60, s-maxage=1800, stale-while-revalidate=86400"};
const searchCache=new Map<string,{expires:number;places:any[]}>();
const normalized=(value:string)=>value.toLocaleLowerCase("sv").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[.,]/g," ").replace(/\s+/g," ").trim();

const correctedSearch=(value:string)=>value.replace(/\b(?:murmästaregatan|murmastaregatan|murnästaregatan|murnastaregatan)\b/gi,"Murmästaregatan");

const structured=(primary:string,secondary:string,details:Record<string,unknown>)=>({
  ...details,
  primary,
  secondary,
  label:[primary,secondary].filter(Boolean).join(", "),
});

const photonPlace=(feature:any,zones:PriceZone[])=>{
  if(!feature)return null;
  const p=feature.properties||{},lng=Number(feature.geometry?.coordinates?.[0]),lat=Number(feature.geometry?.coordinates?.[1]);
  const street=[p.street||p.name,p.housenumber].filter(Boolean).join(" ");
  const primary=street||p.name||p.district||"";
  const locality=p.city||p.locality||p.county||p.state||"";
  const isMurmastaregatan=normalized(p.street||p.name||"")==="murmastaregatan"&&normalized(locality).includes("goteborg");
  const district=isMurmastaregatan?"Utby":p.district;
  const postcode=isMurmastaregatan?"415 74":p.postcode;
  const secondary=[district&&district!==primary?district:null,postcode,locality].filter(Boolean).filter((v:string,i:number,a:string[])=>a.indexOf(v)===i).join(", ");
  const zone=identifyZone(zones,lat,lng,[p.district,p.locality,p.name,p.street,p.city,p.county,primary,secondary]);
  return structured(primary,secondary,{id:p.osm_id?`photon:${p.osm_type||"place"}:${p.osm_id}`:undefined,lat,lng,area:zone?.name,kind:p.housenumber?"address":"place",components:{street:p.street,houseNumber:p.housenumber,district,postcode,city:locality}});
};

const nominatimPlace=(result:any,zones:PriceZone[])=>{
  const a=result.address||{},lat=Number(result.lat),lng=Number(result.lon);
  const street=[a.road||a.pedestrian||a.residential||a.amenity||a.building,a.house_number].filter(Boolean).join(" ");
  const primary=street||result.name||a.neighbourhood||a.suburb||"";
  const locality=a.city||a.town||a.village||a.municipality||a.county||"";
  const isMurmastaregatan=normalized(a.road||"")==="murmastaregatan"&&normalized(locality).includes("goteborg");
  const district=isMurmastaregatan?"Utby":a.neighbourhood||a.suburb||a.quarter;
  const postcode=isMurmastaregatan?"415 74":a.postcode;
  const secondary=[district,postcode,locality].filter(Boolean).filter((v:string,i:number,x:string[])=>x.indexOf(v)===i).join(", ");
  const zone=identifyZone(zones,lat,lng,[a.neighbourhood,a.suburb,a.quarter,a.city_district,a.road,a.city,a.town,a.village,a.municipality,a.county,primary,secondary]);
  return structured(primary,secondary,{id:result.osm_id?`nominatim:${result.osm_type||"place"}:${result.osm_id}`:undefined,lat,lng,area:zone?.name,kind:a.house_number?"address":"place",components:{street:a.road,houseNumber:a.house_number,district,postcode,city:locality}});
};

const localityScore=(place:any,q:string)=>{
  const label=normalized(place.label||"");
  const near=/goteborg|molndal|partille|harryda|kungalv|lerum|ale|kungsbacka|tjorn|smogen|stenungsund|varberg|vastra gotaland|halland/.test(label);
  const exactStreet=normalized(place.primary||"").startsWith(normalized(q));
  return (place.id===GOTHENBURG_CENTRAL.id?100:0)+(near?20:0)+(exactStreet?8:0)+(place.kind==="address"?5:0)+(place.area?2:0);
};

async function zones(){
  try{
    const {data,error}=await publicSupabase().from("price_zones").select("code,name,aliases,boundary").eq("active",true);
    if(error)throw error;
    return (data||[]) as PriceZone[];
  }catch(error){
    console.error("address_price_zones_unavailable",error);
    return [] as PriceZone[];
  }
}

async function fetchJson(url:string,timeoutMs=3500){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{headers,cache:"no-store",signal:controller.signal});
    if(!response.ok)throw new Error(`geocoder_${response.status}`);
    return await response.json();
  }finally{clearTimeout(timeout)}
}

const isLandvetterSearch=(q:string)=>{
  const value=normalized(q).replace(/\s/g,"");
  return value.length>=2&&(
    "landvetter".startsWith(value)||
    "landvetterflygplats".includes(value)||
    "goteborglandvetterairport".includes(value)||
    value==="got"||
    /^flyg(plats(en)?)?$/.test(value)
  );
};

const specialPlaces=(q:string)=>[
  ...(isGothenburgCentralSearch(q)?[GOTHENBURG_CENTRAL]:[]),
  ...(isLandvetterSearch(q)?[{...LANDVETTER_AIRPORT,primary:"Göteborg Landvetter Airport",secondary:"Flygplatsvägen, 438 80 Landvetter",label:"Göteborg Landvetter Airport (GOT), Flygplatsvägen, 438 80 Landvetter",kind:"airport",placeType:"airport"}]:[]),
];

export async function GET(req:Request){
  const u=new URL(req.url),rawQuery=u.searchParams.get("q")?.trim()||"",q=correctedSearch(rawQuery);
  const hasCoordinates=u.searchParams.has("lat")&&u.searchParams.has("lng");
  const lat=Number(u.searchParams.get("lat")),lng=Number(u.searchParams.get("lng"));
  if(hasCoordinates&&Number.isFinite(lat)&&Number.isFinite(lng)){
    const started=performance.now();
    const catalogPromise=Promise.race([zones(),new Promise<PriceZone[]>(resolve=>setTimeout(()=>resolve([]),800))]);
    const hierarchyPromise=reverseAreaHierarchy(lat,lng).catch(()=>({values:[] as string[],primary:null}));
    const catalog=await catalogPromise;
    try{
      const place=await Promise.any([
        fetchJson(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`,5000).then((j:any)=>photonPlace((j.features||[]).find((f:any)=>f.properties?.street)||j.features?.[0],catalog)),
        fetchJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=sv`,5000).then((j:any)=>nominatimPlace(j,catalog)),
      ].map((provider)=>provider.then((result)=>result?.primary?result:Promise.reject(new Error("empty_reverse_result")))));
      const hierarchy=await hierarchyPromise;
      const zone=identifyZone(catalog,lat,lng,hierarchy.values)??matchTrustedArea(catalog,lat,lng,hierarchy.values);
      return Response.json({...place,lat,lng,area:zone?.name,structuredArea:hierarchy.primary,areaHierarchy:hierarchy.values},{headers:{"Cache-Control":"no-store","Server-Timing":`reverse;dur=${Math.round(performance.now()-started)}`}});
    }catch{}
    return Response.json({error:"Gatuadressen kunde inte hittas."},{status:502,headers:{"Cache-Control":"no-store"}});
  }
  if(q.length<2)return Response.json([],{headers:responseHeaders});
  const cacheKey=normalized(q),cached=searchCache.get(cacheKey);
  if(cached&&cached.expires>Date.now())return Response.json(cached.places,{headers:responseHeaders});
  const started=performance.now();
  // Pricing is calculated separately; slow zone metadata must not hold up suggestions.
  const catalogPromise=Promise.race([zones(),new Promise<PriceZone[]>(resolve=>setTimeout(()=>resolve([]),800))]);
  try{
    // Photon supports type-ahead. Bias towards Gothenburg without appending a
    // city name that can exclude destinations elsewhere on the west coast.
    const base="https://photon.komoot.io/api/?limit=12&lang=en&lat=57.7089&lon=11.9746&countrycode=SE&q=";
    const [result,catalog]:any=await Promise.all([fetchJson(base+encodeURIComponent(q),3000),catalogPromise]);
    const combined=(result.features||[]).map((f:any)=>photonPlace(f,catalog));
    const providerHits=combined
      .filter((place:any)=>place?.label&&Number.isFinite(place.lat)&&Number.isFinite(place.lng));

    const candidates=[...specialPlaces(q),...providerHits];
    const seen=new Set<string>();
    const hits=candidates.filter((place:any)=>place?.label&&Number.isFinite(place.lat)&&Number.isFinite(place.lng)).sort((a:any,b:any)=>localityScore(b,q)-localityScore(a,q)).filter((place:any)=>{const key=`${normalized(place.label)}:${place.lat.toFixed(5)}:${place.lng.toFixed(5)}`;if(seen.has(key))return false;seen.add(key);return true}).slice(0,10);
    if(hits.length)searchCache.set(cacheKey,{expires:Date.now()+30*60*1000,places:hits});
    if(searchCache.size>200)searchCache.delete(searchCache.keys().next().value as string);
    return Response.json(hits,{headers:{...(hits.length?responseHeaders:{"Cache-Control":"no-store"}),"Server-Timing":`address;dur=${Math.round(performance.now()-started)}`,"X-Address-Provider":"photon"}});
  }catch{
    const known=specialPlaces(q);
    return Response.json(known.length?known:{error:"Adressökningen svarar inte just nu. Försök igen."},{status:known.length?200:503,headers:{"Cache-Control":"no-store"}});
  }
}
