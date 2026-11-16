import { adminSupabase } from "@/lib/supabase-server";
import { lateCancellation } from "@/lib/booking-policy";
import { upsertFlightMonitorForBooking } from "@/lib/flight-monitor";
import { sendAssignedBookingPush } from "@/lib/push";
const cancellable=["new","scheduled","confirmed","offered","assigned","accepted","en_route","arrived"];
export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Ogiltig begäran'},{status:403});
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))return Response.json({error:'Ogiltig reselänk'},{status:400});
 let input:any;try{input=await request.json();}catch{return Response.json({error:'Ogiltiga uppgifter'},{status:400});}
 if(input.confirm!==true)return Response.json({error:'Bekräfta avbokningen.'},{status:400});
 const db=adminSupabase();
 const found=await db.from('bookings').select('*').eq('tracking_token',token).is('archived_at',null).maybeSingle();
 const booking=found.data;
 if(found.error)return Response.json({error:'Bokningen kunde inte hämtas. Försök igen.'},{status:503});
 if(!booking)return Response.json({error:'Bokningen hittades inte.'},{status:404});
 if(booking.status==='cancelled')return Response.json({ok:true});
 if(!cancellable.includes(booking.status))return Response.json({error:'Resan har startat eller avslutats. Kontakta trafikledningen.'},{status:409});
 if(['paid','refunded'].includes(booking.payment_status))return Response.json({error:'Resan är betald. Ring 0700-315 315 för avbokning och eventuell återbetalning.'},{status:409});
 const fee=lateCancellation(booking);
 if(fee&&input.acceptFee!==true)return Response.json({error:'Avbokning sker inom 24 timmar. Ladda om resan och bekräfta avgiften enligt bokningsvillkoren.'},{status:409});
 const now=new Date().toISOString();
 let update=db.from('bookings').update({status:'cancelled',cancelled_at:now,updated_at:now}).eq('id',booking.id).eq('tracking_token',token).eq('updated_at',booking.updated_at).in('status',cancellable).is('archived_at',null);
 update=booking.payment_status==null?update.is('payment_status',null):update.eq('payment_status',booking.payment_status);
 const result=await update.select('*').maybeSingle();
 if(result.error||!result.data)return Response.json({error:'Bokningen ändrades samtidigt. Ladda om och försök igen.'},{status:409});
 await Promise.allSettled([upsertFlightMonitorForBooking(result.data),sendAssignedBookingPush(booking.id)]);
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
