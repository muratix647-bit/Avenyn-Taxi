import {sendContactEmail} from "@/lib/email";

export async function POST(request:Request){
  try{
    const body=await request.json();
    const name=String(body?.name||"").trim();
    const email=String(body?.email||"").trim();
    const phone=String(body?.phone||"").trim();
    const message=String(body?.message||"").trim();
    if(!name||!email||!message||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      return Response.json({error:"Fyll i namn, giltig e-post och meddelande."},{status:400});
    }
    if(name.length>120||email.length>200||phone.length>50||message.length>3000){
      return Response.json({error:"Meddelandet är för långt."},{status:400});
    }
    const result=await sendContactEmail({name,email,phone,message});
    if(!result.accepted)return Response.json({error:"Meddelandet kunde inte skickas. Ring eller mejla oss direkt."},{status:502});
    return Response.json({ok:true});
  }catch{
    return Response.json({error:"Meddelandet kunde inte skickas."},{status:400});
  }
}
