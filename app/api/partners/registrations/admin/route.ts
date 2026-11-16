import {partnerAdmin,uuid} from '@/lib/partner-server';
export async function GET(request:Request){
 try{const db=await partnerAdmin(request);const {data,error}=await db.from('partner_resource_requests').select('id,partner_id,kind,details,status,resource_id,review_note,created_at,partner:taxi_partners(company)').order('created_at',{ascending:false}).limit(500);if(error)throw error;return Response.json({registrations:data},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Endast admin kan läsa registreringarna.'},{status:403});}
}
export async function POST(request:Request){
 try{const db=await partnerAdmin(request);const body:any=await request.json();if(!uuid(body.id)||typeof body.approve!=='boolean'||typeof body.note!=='string'||body.note.length>1000)return Response.json({error:'Ogiltig granskning.'},{status:400});const {data,error}=await db.rpc('review_partner_resource',{p_id:body.id,p_approve:body.approve,p_note:body.note});if(error)return Response.json({error:error.message},{status:409});return Response.json({ok:true,resource_id:data});}catch{return Response.json({error:'Kunde inte behandla registreringen. Logga in som admin.'},{status:403});}
}
