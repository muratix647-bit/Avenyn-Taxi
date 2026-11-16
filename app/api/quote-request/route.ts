import {sendQuoteRequestEmail} from "@/lib/email";

const value=(input:unknown,max=500)=>String(input??"").trim().slice(0,max);

export async function POST(request:Request){
  try{
    const body=await request.json();
    const quote={pickup:value(body.pickup,300),destination:value(body.destination,300),pickupTime:value(body.pickupTime,40),passengers:Number(body.passengers),name:value(body.name,120),phone:value(body.phone,40),email:value(body.email,180),message:value(body.message,1500)};
    if(!quote.pickup||!quote.destination||!quote.pickupTime||!quote.name||!quote.phone||!quote.email)return Response.json({error:"Fyll i alla obligatoriska uppgifter."},{status:400});
    if(!Number.isInteger(quote.passengers)||quote.passengers<1||quote.passengers>7)return Response.json({error:"Välj mellan 1 och 7 passagerare."},{status:400});
    if(!/^\+?[0-9 ()-]{7,20}$/.test(quote.phone))return Response.json({error:"Ange ett giltigt telefonnummer."},{status:400});
    if(!/^\S+@\S+\.\S+$/.test(quote.email))return Response.json({error:"Ange en giltig e-postadress."},{status:400});
    const scheduled=new Date(quote.pickupTime);if(!Number.isFinite(scheduled.getTime()))return Response.json({error:"Ange ett giltigt datum och klockslag."},{status:400});
    const result=await sendQuoteRequestEmail(quote);
    if(!result.accepted)return Response.json({error:"Offertförfrågan kunde inte skickas. Ring gärna +46 700 315 315."},{status:502});
    return Response.json({ok:true});
  }catch(error){console.error("quote_request_failed",error);return Response.json({error:"Offertförfrågan kunde inte skickas."},{status:500})}
}
