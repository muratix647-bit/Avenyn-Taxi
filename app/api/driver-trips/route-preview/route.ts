import {roadRoute} from '@/lib/trip-road-route';
import {requireSupabaseUser} from '@/lib/supabase-server';
const coordinate=(v:any,max:number)=>v!=null&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Math.abs(Number(v))<=max;
export async function GET(request:Request){try{
 const {supabase}=await requireSupabaseUser(request);const id=new URL(request.url).searchParams.get('bookingId');
 const mine=await supabase.rpc('driver_my_bookings');if(mine.error)throw mine.error;
 let booking=(mine.data||[]).find((b:any)=>b.id===id);
 if(!booking){const pool=await supabase.rpc('driver_prebooking_pool');if(pool.error)throw pool.error;booking=(pool.data||[]).find((b:any)=>b.id===id);}
 if(!booking)return Response.json({error:'Körningen är inte tillgänglig.'},{status:403});
 if(!coordinate(booking.pickup_lat,85)||!coordinate(booking.pickup_lng,180)||!coordinate(booking.dropoff_lat,85)||!coordinate(booking.dropoff_lng,180))return Response.json({state:'missing_coordinates',path:[]});
 const stop=booking.price_breakdown;const points=[[booking.pickup_lng,booking.pickup_lat],...(stop?.stop_address&&coordinate(stop.stop_lat,85)&&coordinate(stop.stop_lng,180)?[[stop.stop_lng,stop.stop_lat]]:[]),[booking.dropoff_lng,booking.dropoff_lat]];
 const query=new URL(request.url).searchParams;
 const originLat=query.get('originLat'),originLng=query.get('originLng');
 const canNavigate=['accepted','en_route','arrived','passenger_onboard'].includes(booking.status);
 const approach=query.get('phase')==='pickup'&&canNavigate;
 const destination=query.get('phase')==='destination'&&canNavigate;
 const originValid=coordinate(originLat,85)&&coordinate(originLng,180);
 const remaining=points.slice(1);
 const routePoints=destination&&originValid?[[Number(originLng),Number(originLat)],...remaining]:approach&&coordinate(originLat,85)&&coordinate(originLng,180)?[[Number(originLng),Number(originLat)],points[0]]:points;
 const value=await roadRoute(routePoints);return Response.json(value,{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({state:'unavailable',path:[]},{headers:{'Cache-Control':'no-store'}})}}
