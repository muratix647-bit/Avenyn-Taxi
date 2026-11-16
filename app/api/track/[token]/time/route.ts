import { adminSupabase } from "@/lib/supabase-server";
import { pickupAt } from "@/lib/prebooking-watch";
import { sendBookingTimeUpdateSms } from "@/lib/sms";
import { sendAssignedBookingPush } from "@/lib/push";
const editable=["new","scheduled","offered","assigned","accepted"];
export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const origin=request.headers.get('origin');
 if(origin && origin!==new URL(request.url).origin)return Response.json({error:'Ogiltig begäran'},{status:403});
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))return Response.json({error:'Ogiltig reselänk'},{status:400});
 let input:any;try{input=await request.json();}catch{return Response.json({error:'Ogiltiga uppgifter'},{status:400});}
 const date=String(input.date||''),time=String(input.time||'');
 const at=pickupAt({booking_date:date,pickup_time:time});
 const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!Number.isFinite(at)||local.format(new Date(at)).replace(' ', 'T')!==`${date}T${time}`||at<Date.now()+60000)return Response.json({error:'Välj ett giltigt datum och en framtida tid.'},{status:400});
 const db=adminSupabase();const found=await db.from('bookings').select('*').eq('tracking_token',token).is('archived_at',null).maybeSingle();const booking=found.data;
 if(found.error||!booking)return Response.json({error:'Bokningen hittades inte'},{status:404});
 if(!editable.includes(booking.status))return Response.json({error:'Föraren har redan påbörjat hämtningen. Ring föraren eller trafikledningen för att ändra tiden.'},{status:409});
 if(`${booking.booking_date}T${String(booking.pickup_time).slice(0,5)}`!==input.previous)return Response.json({error:'Bokningen har ändrats. Ladda om och försök igen.'},{status:409});
 if(booking.booking_date===date&&String(booking.pickup_time).slice(0,5)===time)return Response.json({ok:true});
 const result=await db.from('bookings').update({booking_date:date,pickup_time:time,updated_at:new Date().toISOString()}).eq('id',booking.id).eq('updated_at',booking.updated_at).in('status',editable).is('archived_at',null).select('*').maybeSingle();
 if(result.error||!result.data)return Response.json({error:'Bokningen ändrades samtidigt. Ladda om och försök igen.'},{status:409});
 const notices=await Promise.allSettled([sendBookingTimeUpdateSms(result.data),sendAssignedBookingPush(booking.id,true)]);
 const sms=notices[0];const notified=sms.status==='fulfilled'&&sms.value.every((r:any)=>r.accepted);
 return Response.json({ok:true,pickup_time:`${date}T${time}`,message:notified?'Tiden är uppdaterad. Trafikledningen har meddelats.':'Tiden är uppdaterad i bokningen. SMS kunde inte skickas till alla mottagare; kontakta trafikledningen vid behov.'},{headers:{'Cache-Control':'no-store'}});
}
