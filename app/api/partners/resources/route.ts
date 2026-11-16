import {partnerAdmin,uuid} from '@/lib/partner-server';
export async function GET(request:Request){
 try{
  const db=await partnerAdmin(request);
  const results=await Promise.all([
   db.from('taxi_partners').select('id,application_id,company,email,active'),
   db.from('drivers').select('id,full_name').is('archived_at',null),
   db.from('vehicles').select('id,name,registration_number').eq('active',true),
   db.from('partner_drivers').select('driver_id,partner_id,created_at'),
   db.from('partner_vehicles').select('vehicle_id,partner_id'),
  ]);
  if(results.some(r=>r.error))throw new Error('Kunde inte hämta åkerierna.');
  return Response.json({partners:results[0].data,drivers:results[1].data,vehicles:results[2].data,driver_links:results[3].data,vehicle_links:results[4].data},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Kunde inte hämta åkerierna. Logga in som admin.'},{status:403});}
}
export async function POST(request:Request){
 try{
  const db=await partnerAdmin(request);const body:any=await request.json();
  if(!uuid(body.partner_id)||!uuid(body.resource_id)||!['driver','vehicle'].includes(body.kind))return Response.json({error:'Välj åkeri och förare eller bil.'},{status:400});
  const {data:partner,error:partnerError}=await db.from('taxi_partners').select('id').eq('id',body.partner_id).eq('active',true).maybeSingle();
  if(partnerError||!partner)throw new Error('Åkeriet är inte anslutet.');
  let resource=db.from(body.kind==='driver'?'drivers':'vehicles').select('id').eq('id',body.resource_id);
  resource=body.kind==='driver'?resource.is('archived_at',null):resource.eq('active',true);
  const {data,error:resourceError}=await resource.maybeSingle();
  if(resourceError||!data)throw new Error('Föraren eller bilen är inte aktiv.');
  const column=body.kind==='driver'?'driver_id':'vehicle_id';
  const {error}=await db.from(body.kind==='driver'?'partner_drivers':'partner_vehicles').insert({partner_id:body.partner_id,[column]:body.resource_id});
  if(error?.code==='23505')return Response.json({error:'Föraren eller bilen är redan kopplad till ett åkeri. Uppdatera listan.'},{status:409});
  if(error)throw error;
  return Response.json({ok:true});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Kunde inte koppla uppgifterna.'},{status:400});}
}
