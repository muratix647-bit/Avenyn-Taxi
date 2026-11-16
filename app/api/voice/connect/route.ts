import { voiceReady,voiceConfig,voiceBooking } from "@/lib/voice-server";
import { parseVoiceIdentity,validTwilioSignature,voiceIdentity } from "@/lib/voice-security";
const reject=()=>new Response('<Response><Reject reason="rejected"/></Response>',{headers:{"Content-Type":"text/xml","Cache-Control":"no-store"}});
export async function POST(request:Request){
  if(!voiceReady()) return reject();
  try {
    const c=voiceConfig();const raw=await request.text();if(raw.length>16384)return reject();
    const p=new URLSearchParams(raw);
    if(!await validTwilioSignature(c.auth,c.webhook,p,request.headers.get("x-twilio-signature")||""))return new Response("Forbidden",{status:403});
    if(p.get("AccountSid")!==c.account)return reject();
    const caller=parseVoiceIdentity(p.get("From")||"");if(!caller)return reject();
    const booking=await voiceBooking(caller.bookingId);
    if(booking.driver_id.toLowerCase()!==caller.driverId.toLowerCase())return reject();
    const recipient=voiceIdentity(booking.id,booking.driver_id,caller.role==="driver"?"customer":"driver");
    // Recipient is derived exclusively from the booking. No phone numbers or client-supplied targets.
    return new Response(`<Response><Dial timeout="25" timeLimit="1800"><Client>${recipient}</Client></Dial></Response>`,{headers:{"Content-Type":"text/xml","Cache-Control":"no-store"}});
  } catch {return reject();}
}
