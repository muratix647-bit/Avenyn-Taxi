import {partnerAdmin,uuid} from '@/lib/partner-server';
export async function POST(request:Request){
 try{const db=await partnerAdmin(request);const b:any=await request.json();
 if(!uuid(b.bookingId)||(b.partnerId!==null&&!uuid(b.partnerId))||typeof b.updatedAt!=='string')return Response.json({error:'Välj bokning och åkeri.'},{status:400});
 const result=await db.rpc('admin_delegate_partner_booking',{p_booking_id:b.bookingId,p_partner_id:b.partnerId,p_expected_updated_at:b.updatedAt});
 if(result.error)return Response.json({error:result.error.message},{status:409});
 return Response.json({ok:true});
 }catch{return Response.json({error:'Kunde inte tilldela körningen. Logga in som admin.'},{status:403});}
}
