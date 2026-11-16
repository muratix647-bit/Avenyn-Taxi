import {adminSupabase} from './supabase-server';
import {isLandvetterAirport} from './prices';
import {dynamicPercent} from './dynamic-pricing';
const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const local=(d:Date)=>fmt.format(d).replace(' ','T');
function nearby(a:number,b:number,c:number,d:number){const r=Math.PI/180;const x=Math.sin((a-c)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((b-d)*r/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(x)))<=15;}
export async function applyDynamicPrice(input:any,quote:any){
 if(quote?.total_price==null)return quote;
 // Airport addresses, canonical IDs and the airport coordinate area are exempt, including stops.
 const airport=(address:string,id:string,lat:any,lng:any)=>isLandvetterAirport(address||'',id)|| (lat!=null&&lng!=null&&Math.abs(Number(lat)-57.6688)<0.018&&Math.abs(Number(lng)-12.2923)<0.025);
 if(airport(input.pickupAddress,input.pickupPlaceId,input.pickupLat,input.pickupLng)||airport(input.dropoffAddress,input.dropoffPlaceId,input.dropoffLat,input.dropoffLng)||airport(input.stopAddress,input.stopPlaceId,input.stopLat,input.stopLng))return {...quote,dynamic_percent:0,dynamic_surcharge:0};
 const db=adminSupabase();const {data:settings,error}=await db.from('dynamic_price_settings').select('*').eq('id',true).single();if(error)throw error;
 let waiting=0,available=0;
 const now=new Date(),nowText=local(now),endText=local(new Date(now.getTime()+3600000));
 const eligible=Boolean(input.pickupTime&&input.pickupTime>=nowText&&input.pickupTime<=endText);
 if(settings.enabled&&eligible&&settings.demand_percent>0){
 const [jobs,cars]=await Promise.all([
 db.from('bookings').select('booking_date,pickup_time,pickup_lat,pickup_lng').in('status',['new','scheduled','offered']).is('archived_at',null).is('assigned_partner_id',null).gte('booking_date',nowText.slice(0,10)).lte('booking_date',endText.slice(0,10)).limit(1000),
 db.from('drivers').select('id').eq('active',true).eq('approved',true).eq('is_online',true).eq('availability_status','available').is('archived_at',null)]);
 if(!jobs.error&&!cars.error){const ids=(cars.data||[]).map(d=>d.id);const locations=ids.length?await db.from('driver_locations').select('driver_id,latitude,longitude').in('driver_id',ids).gte('updated_at',new Date(now.getTime()-180000).toISOString()):{data:[],error:null};
 if(!locations.error){waiting=(jobs.data||[]).filter(b=>{const t=b.booking_date+'T'+b.pickup_time;return t>=nowText&&t<=endText&&b.pickup_lat!=null&&b.pickup_lng!=null&&nearby(Number(input.pickupLat),Number(input.pickupLng),Number(b.pickup_lat),Number(b.pickup_lng));}).length;
 available=new Set((locations.data||[]).filter(l=>nearby(Number(input.pickupLat),Number(input.pickupLng),Number(l.latitude),Number(l.longitude))).map(l=>l.driver_id)).size;}}
 }
 const rule=dynamicPercent(settings,input.pickupTime||'',waiting,available,eligible);
 const surcharge=Math.round(Number(quote.base_price)*rule.percent/100);
 return {...quote,base_price:Number(quote.base_price)+surcharge,total_price:Number(quote.total_price)+surcharge,dynamic_base_price:Number(quote.base_price),dynamic_percent:rule.percent,dynamic_surcharge:surcharge,dynamic_reasons:rule.reasons};
}
