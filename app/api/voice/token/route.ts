import { authorizeVoice,voiceReady,voiceConfig } from "@/lib/voice-server";
import { voiceIdentity,voiceJwt } from "@/lib/voice-security";
export async function POST(request:Request){
  if(!voiceReady()) return Response.json({error:"Appsamtal är inte aktiverade ännu."},{status:503});
  try {
    const raw=await request.text();if(raw.length>1024) throw new Error("invalid");
    const {booking,role}=await authorizeVoice(request,JSON.parse(raw));
    const c=voiceConfig();const identity=voiceIdentity(booking.id,booking.driver_id,role);
    return Response.json({token:await voiceJwt(c.account,c.key,c.secret,c.app,identity),identity},{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"Samtalet kräver en aktiv bokning och rätt deltagare."},{status:403,headers:{"Cache-Control":"no-store"}});}
}
