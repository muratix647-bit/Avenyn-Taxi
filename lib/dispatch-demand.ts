export type DemandBooking = {status?:string; pickup_time?:string; pickup_lat?:number|string|null; pickup_lng?:number|string|null; assigned_partner_id?:string|null; driver_id?:string|null; archived_at?:string|null};
export type DemandCar = {lat:number|string;lng:number|string;online?:boolean|null;availability_status?:string|null;updated_at?:string|null};
const localTime = (d:Date) => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(d).replace(' ','T');
export function demandZones(bookings:DemandBooking[],cars:DemandCar[],now:number){
 const start=localTime(new Date(now)),end=localTime(new Date(now+3600000));
 const cells=new Map<string,{lat:number;lng:number;waiting:number}>();
 for(const b of bookings){
  if(!['new','scheduled','offered'].includes(b.status||'')||b.archived_at||b.driver_id||b.assigned_partner_id||!b.pickup_time||b.pickup_time<start||b.pickup_time>end)continue;
  if(b.pickup_lat==null||b.pickup_lng==null||String(b.pickup_lat).trim()===''||String(b.pickup_lng).trim()==='')continue;
  const lat=Number(b.pickup_lat),lng=Number(b.pickup_lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180)continue;
  const y=Math.floor(lat/0.027),x=Math.floor(lng/0.05),key=`${y}:${x}`;
  const cell=cells.get(key)||{lat:(y+.5)*.027,lng:(x+.5)*.05,waiting:0};cell.waiting++;cells.set(key,cell);
 }
 return [...cells].map(([id,cell])=>{
  const available=cars.filter(c=>{const age=now-Date.parse(c.updated_at||'');if(!c.online||c.availability_status!=='available'||!Number.isFinite(age)||age< -60000||age>180000)return false;
   const lat=Number(c.lat),lng=Number(c.lng);return Math.hypot((lat-cell.lat)*111.2,(lng-cell.lng)*111.2*Math.cos(cell.lat*Math.PI/180))<=3;
  }).length;
  const level=cell.waiting>=3&&cell.waiting>available?'high':cell.waiting>=2?'medium':'low';
  return {id,...cell,available,level,color:level==='high'?'#dc2626':level==='medium'?'#f97316':'#eab308'};
 });
}
