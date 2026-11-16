import {GET as tracking} from '../route';
const cache=new Map<string,{expires:number;value:any}>();
const coordinate=(v:unknown,max:number)=>v!=null&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Math.abs(Number(v))<=max;
export async function GET(request:Request,context:{params:Promise<{token:string}>}) {
 const response=await tracking(request,context);if(!response.ok)return response;
 const trip:any=await response.json();
 const reply=(value:any)=>Response.json(value,{headers:{'Cache-Control':'no-store'}});
 if(trip.status==='arrived')return reply({state:'arrived'});
 if(!['assigned','accepted','en_route'].includes(trip.status))return reply({state:'not_en_route'});
 if(!trip.location_updated||Date.now()-Date.parse(trip.location_updated)>120000)return reply({state:'stale'});
 if(!coordinate(trip.driver_lat,85)||!coordinate(trip.driver_lng,180)||!coordinate(trip.pickup_lat,85)||!coordinate(trip.pickup_lng,180))return reply({state:'unavailable'});
 const {token}=await context.params;
 const key=token+':'+trip.status+':'+trip.pickup_lat+':'+trip.pickup_lng;
 const saved=cache.get(key);if(saved&&saved.expires>Date.now())return reply(saved.value);
 try {
  const url=`https://router.project-osrm.org/route/v1/driving/${Number(trip.driver_lng)},${Number(trip.driver_lat)};${Number(trip.pickup_lng)},${Number(trip.pickup_lat)}?overview=simplified&geometries=geojson&alternatives=false&steps=false`;
  const routeResponse=await fetch(url,{signal:AbortSignal.timeout(5000),headers:{'User-Agent':'AvenynTaxi/1.0 info@avenyntaxi.se'}});
  const data:any=await routeResponse.json();const seconds=Number(data?.routes?.[0]?.duration);const meters=Number(data?.routes?.[0]?.distance);
  if(!routeResponse.ok||data.code!=='Ok'||!Number.isFinite(seconds)||seconds<0||!Number.isFinite(meters)||meters<0)throw new Error('route unavailable');
  const geometry=data?.routes?.[0]?.geometry?.coordinates;
  const path=Array.isArray(geometry)?geometry.filter((p:any)=>Array.isArray(p)&&coordinate(p[1],85)&&coordinate(p[0],180)).slice(0,10000).map((p:any)=>[Number(p[1]),Number(p[0])]):[];
  const calculated=Date.now();const value={state:'estimate',path,kilometers:meters/1000,minutes:Math.max(1,Math.ceil(seconds/60)),arrivalAt:new Date(calculated+seconds*1000).toISOString(),calculatedAt:new Date(calculated).toISOString()};
  if(cache.size>500)cache.clear();cache.set(key,{expires:calculated+15000,value});return reply(value);
 }catch{return reply({state:'unavailable'});}
}
