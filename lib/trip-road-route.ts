const coordinate=(v:any,max:number)=>v!=null&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Math.abs(Number(v))<=max;
const cache=new Map<string,{expires:number,value:any}>();
export async function roadRoute(points:number[][]){
 if(points.length<2||points.some(p=>!coordinate(p[0],180)||!coordinate(p[1],85)))return {state:'missing_coordinates',path:[]};
 const key=JSON.stringify(points),saved=cache.get(key);if(saved&&saved.expires>Date.now())return saved.value;
 let r:any=null;
 const coordinates=points.map(p=>p.map(Number).join(',')).join(';');
 for(const base of ['https://router.project-osrm.org','https://routing.openstreetmap.de/routed-car']){
  try{const response=await fetch(`${base}/route/v1/driving/${coordinates}?overview=simplified&geometries=geojson&alternatives=false&steps=false`,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'AvenynTaxi/1.0 info@avenyntaxi.se'},cache:'no-store'});
   const data:any=await response.json();const candidate=data.routes?.[0];
   if(response.ok&&data.code==='Ok'&&candidate&&Number.isFinite(Number(candidate.distance))&&Number.isFinite(Number(candidate.duration))&&candidate.geometry?.coordinates?.length>1){r=candidate;break;}
  }catch{}
 }
 if(!r)throw Error('Rutten kunde inte hämtas.');
 const path=(r.geometry?.coordinates||[]).filter((p:any)=>Array.isArray(p)&&coordinate(p[1],85)&&coordinate(p[0],180)).slice(0,10000).map((p:any)=>[Number(p[1]),Number(p[0])]);
 const value={state:'ready',path,kilometers:Number(r.distance)/1000,minutes:Math.ceil(Number(r.duration)/60)};
 if(cache.size>200)cache.clear();cache.set(key,{expires:Date.now()+300000,value});return value;
}
