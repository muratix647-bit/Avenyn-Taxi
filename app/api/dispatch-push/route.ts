import {env} from 'cloudflare:workers';
import {adminSupabase} from '@/lib/supabase-server';
import {sendAssignedBookingPush} from '@/lib/push';
export async function POST(request:Request){
 const secret=String((env as any).FLIGHT_MONITOR_SECRET||'');
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({error:'Unauthorized'},{status:401});
 const body:any=await request.json().catch(()=>({}));
 if(typeof body.prebookingId==='string')return Response.json(await sendAssignedBookingPush(body.prebookingId,false,true));
 if(typeof body.offerId!=='string')return Response.json({error:'Invalid offer'},{status:400});
 const db=adminSupabase();const {data:o,error}=await db.from('booking_driver_offers').select('booking_id,driver_id,status,expires_at').eq('id',body.offerId).maybeSingle();
 if(error)return Response.json({error:'Read failed'},{status:503});
 if(!o||o.status!=='offered'||Date.parse(o.expires_at)<=Date.now())return Response.json({skipped:true});
 const {data:b}=await db.from('bookings').select('driver_id,status').eq('id',o.booking_id).single();
 if(b?.driver_id!==o.driver_id||b?.status!=='offered')return Response.json({skipped:true});
 return Response.json(await sendAssignedBookingPush(o.booking_id));
}
