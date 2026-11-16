import {partnerAccount} from '@/lib/partner-server';
import {resourceRequestSchema} from '@/lib/partner-resource-validation';
export async function GET(request:Request){
 try{const {db,partner}=await partnerAccount(request);const {data,error}=await db.from('partner_resource_requests').select('id,kind,details,status,review_note,created_at').eq('partner_id',partner.id).order('created_at',{ascending:false}).limit(200);if(error)throw error;return Response.json({registrations:data},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Kunde inte hämta registreringarna.'},{status:403});}
}
export async function POST(request:Request){
 try{
  const {db,partner}=await partnerAccount(request);
  const raw=await request.text();if(raw.length>8000)return Response.json({error:'För mycket information.'},{status:413});
  const parsed=resourceRequestSchema.safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'Kontrollera alla uppgifter och försök igen.'},{status:400});
  const {count,error:countError}=await db.from('partner_resource_requests').select('id',{head:true,count:'exact'}).eq('partner_id',partner.id).eq('status','pending');if(countError)throw countError;
  if((count||0)>=100)return Response.json({error:'Du har redan 100 registreringar som väntar. Kontakta Avenyn Taxi.'},{status:429});
  const {error}=await db.from('partner_resource_requests').insert({...parsed.data,partner_id:partner.id});
  if(error?.code==='23505')return Response.json({error:'Det finns redan en registrering med dessa uppgifter som väntar på granskning.'},{status:409});if(error)throw error;
  return Response.json({ok:true});
 }catch{return Response.json({error:'Registreringen kunde inte sparas. Kontrollera din inloggning och försök igen.'},{status:400});}
}
