import {writeFile} from "node:fs/promises";

const supabaseUrl=process.env.SUPABASE_URL;
const supabaseKey=process.env.SUPABASE_PUBLISHABLE_KEY;
if(!supabaseUrl||!supabaseKey)throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required");

const headers={"User-Agent":"AvenynTaxiZoneBuilder/1.0 info@avenyntaxi.se"};
const normalize=value=>String(value??"").toLocaleLowerCase("sv").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9åäö]+/g," ").trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const queryName=name=>name.replace(/\s+C$/," centrum").replace(/\bind\.?\b/i,"industriområde").replace(/\bOmr\b/i,"område");
const polygonTypes=new Set(["Polygon","MultiPolygon"]);

const zonesResponse=await fetch(`${supabaseUrl}/rest/v1/price_zones?select=code,name,aliases,boundary&active=eq.true&order=name`,{headers:{...headers,apikey:supabaseKey}});
if(!zonesResponse.ok)throw new Error(`price_zones ${zonesResponse.status}`);
const zones=await zonesResponse.json();
const results=[];

for(let index=0;index<zones.length;index++){
  const zone=zones[index];
  if(zone.boundary){results.push({code:zone.code,name:zone.name,status:"existing"});continue;}
  const aliases=[zone.name,...(zone.aliases||[])].map(normalize).filter(Boolean);
  const params=new URLSearchParams({format:"jsonv2",countrycodes:"se",addressdetails:"1",polygon_geojson:"1",limit:"8",bounded:"1",viewbox:"10.3,58.4,13.5,56.4",q:`${queryName(zone.name)}, Västra Götaland`});
  try{
    const response=await fetch(`https://nominatim.openstreetmap.org/search?${params}`,{headers});
    const candidates=response.ok?await response.json():[];
    const accepted=(Array.isArray(candidates)?candidates:[]).filter(candidate=>{
      if(!polygonTypes.has(candidate.geojson?.type))return false;
      const names=[candidate.name,candidate.address?.neighbourhood,candidate.address?.suburb,candidate.address?.quarter,candidate.address?.town,candidate.address?.city,candidate.address?.village].map(normalize);
      if(!names.some(name=>aliases.includes(name)))return false;
      const county=normalize(candidate.address?.county||candidate.display_name);
      return county.includes("vastra gotaland");
    });
    const candidate=accepted[0];
    results.push(candidate?{code:zone.code,name:zone.name,status:"generated",osmType:candidate.osm_type,osmId:candidate.osm_id,displayName:candidate.display_name,geojson:candidate.geojson}:{code:zone.code,name:zone.name,status:"missing"});
  }catch(error){results.push({code:zone.code,name:zone.name,status:"error",error:String(error)});}
  console.log(`${index+1}/${zones.length} ${zone.name}: ${results.at(-1).status}`);
  await sleep(1100);
}

await writeFile("scripts/generated-price-zone-boundaries.json",JSON.stringify({generatedAt:new Date().toISOString(),source:"OpenStreetMap/Nominatim",results},null,2)+"\n");
const summary=Object.groupBy(results,row=>row.status);
console.log(JSON.stringify(Object.fromEntries(Object.entries(summary).map(([key,value])=>[key,value.length]))));
