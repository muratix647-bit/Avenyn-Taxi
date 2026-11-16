import {adminSupabase,requireSupabaseUser} from '@/lib/supabase-server';
import {chatInput} from '@/lib/chat-input';
const headers={'Cache-Control':'no-store, private'};
export async function POST(request:Request){
 try{
  if(Number(request.headers.get('content-length')||0)>16000)return Response.json({error:'Meddelandet är för långt.'},{status:413,headers});
  const raw=await request.text();
  if(raw.length>16000)return Response.json({error:'Meddelandet är för långt.'},{status:413,headers});
  let json;try{json=JSON.parse(raw)}catch{return Response.json({error:'Ogiltigt meddelande.'},{status:400,headers});}
  const parsed=chatInput.safeParse(json);
  if(!parsed.success)return Response.json({error:'Kontrollera meddelandet och mottagaren. Högst 2 000 tecken.'},{status:400,headers});
  const v=parsed.data;
  // Sender identity always comes from a verified login, never from request JSON.
  let userId:string|null=null;
  if(v.role!=='customer'){
   try{userId=(await requireSupabaseUser(request)).user.id;}catch{return Response.json({error:'Logga in igen för att öppna meddelanden.'},{status:401,headers});}
  }
  const {data,error}=await adminSupabase().rpc('app_chat',{
   p_role:v.role,p_action:v.action,p_user_id:userId,p_tracking_token:v.trackingToken||null,
   p_booking_id:v.bookingId||null,p_driver_id:v.driverId||null,p_text:v.text||null,
   p_request_id:v.requestId||null,p_thread_id:v.threadId||null,p_before:v.before||null,p_seen:v.seen||null,
  });
  if(error){
   if(error.code==='42501')return Response.json({error:'Chatten är inte tillgänglig för den här resan eller inloggningen.'},{status:403,headers});
   if(error.message==='chat_changed')return Response.json({error:'Föraren har ändrats. Öppna chatten igen innan du skickar.'},{status:409,headers});
   if(error.message==='chat_closed')return Response.json({error:'Resan är avslutad. Du kan läsa tidigare meddelanden.'},{status:409,headers});
   if(error.message==='chat_rate_limit')return Response.json({error:'Vänta en minut innan du skickar fler meddelanden.'},{status:429,headers});
   if(error.code==='22023')return Response.json({error:'Kontrollera meddelandet.'},{status:400,headers});
   console.error('app_chat_failed',{code:error.code});
   return Response.json({error:'Chatten kunde inte laddas. Försök igen.'},{status:503,headers});
  }
  return Response.json(data,{headers});
 }catch{return Response.json({error:'Chatten kunde inte laddas. Försök igen.'},{status:503,headers});}
}
