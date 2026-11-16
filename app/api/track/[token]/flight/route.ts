import {adminSupabase} from '@/lib/supabase-server';
import {flightNumberFromNotes,upsertFlightMonitorForBooking} from '@/lib/flight-monitor';
import {replaceFlightNumber} from '@/lib/customer-flight';
const editable=['new','scheduled','offered','assigned','accepted','en_route','arrived'];
export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Ogiltig begäran'},{status:403});
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))return Response.json({error:'Ogiltig reselänk'},{status:400});
 let input:any;try{input=await request.json();}catch{return Response.json({error:'Ogiltiga uppgifter'},{status:400});}
 const flight=String(input.flightNumber??'').trim().toUpperCase().replace(/\s+/g,'');
 if(flight&&!/^[A-Z0-9]{2,3}[0-9]{1,4}[A-Z]?$/.test(flight))return Response.json({error:'Ange flygnummer, till exempel SK140 eller FR1234.'},{status:400});
 const db=adminSupabase();
 const found=await db.from('bookings').select('*').eq('tracking_token',token).is('archived_at',null).maybeSingle();
 if(found.error||!found.data)return Response.json({error:'Bokningen hittades inte'},{status:404});
 const booking=found.data;
 if(!editable.includes(booking.status))return Response.json({error:'Resan har påbörjats eller avslutats. Kontakta oss för hjälp.'},{status:409});
 if((flightNumberFromNotes(booking.notes)||'')!==String(input.previous||''))return Response.json({error:'Flygnumret har ändrats. Ladda om sidan och försök igen.'},{status:409});
 const result=await db.from('bookings').update({notes:replaceFlightNumber(booking.notes,flight),updated_at:new Date().toISOString()}).eq('id',booking.id).eq('tracking_token',token).eq('updated_at',booking.updated_at).in('status',editable).is('archived_at',null).select('*').maybeSingle();
 if(result.error||!result.data)return Response.json({error:'Bokningen ändrades samtidigt. Ladda om sidan och försök igen.'},{status:409});
 let monitoring=true;try{await upsertFlightMonitorForBooking(result.data);}catch{monitoring=false;}
 return Response.json({ok:true,flightNumber:flight||null,message:monitoring?'Flygnumret är sparat.': 'Flygnumret är sparat. Automatisk flygbevakning kunde inte uppdateras; kontakta oss vid försening.'},{headers:{'Cache-Control':'no-store'}});
}
