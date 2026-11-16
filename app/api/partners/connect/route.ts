import {partnerAdmin,uuid} from '@/lib/partner-server';
export async function POST(request:Request){
 try{
  const db=await partnerAdmin(request);
  const body:any=await request.json();
  if(!uuid(body.application_id))return Response.json({error:'Välj en ansökan.'},{status:400});
  const {data:application,error:appError}=await db.from('partner_applications').select('id,company,email,status').eq('id',body.application_id).maybeSingle();
  if(appError||!application||application.status!=='approved')return Response.json({error:'Spara ansökan som godkänd först.'},{status:409});
  const {error:createError}=await db.from('taxi_partners').upsert({application_id:application.id,company:application.company,email:application.email},{onConflict:'application_id',ignoreDuplicates:true});
  if(createError)throw createError;
  const {data:partner,error:partnerError}=await db.from('taxi_partners').select('id,auth_user_id,active').eq('application_id',application.id).single();
  if(partnerError||!partner?.active)throw new Error('Åkerikontot är inaktivt.');
  let link=await db.auth.admin.generateLink({type:'invite',email:application.email,options:{data:{account_type:'partner'}}});
  if(link.error)link=await db.auth.admin.generateLink({type:'magiclink',email:application.email});
  const user=link.data?.user,properties=link.data?.properties;
  if(link.error||!user?.id||!properties?.hashed_token||!['invite','magiclink'].includes(properties.verification_type))throw new Error('Aktiveringslänken kunde inte skapas. Försök igen.');
  if(partner.auth_user_id&&partner.auth_user_id!==user.id)throw new Error('Kontots e-post har ändrats. Kontakta support.');
  const {error:bindError}=await db.from('taxi_partners').update({auth_user_id:user.id}).eq('id',partner.id);
  if(bindError)throw new Error('E-postadressen används redan av ett annat åkeri.');
  const code=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
  const expires=new Date(Date.now()+3600000).toISOString();
  const {error:inviteError}=await db.from('partner_invite_links').insert({code,partner_id:partner.id,token_hash:properties.hashed_token,verification_type:properties.verification_type,expires_at:expires});
  if(inviteError)throw inviteError;
  return Response.json({ok:true,partner_id:partner.id,activation_url:`https://avenyntaxi.se/akeri/aktivera/${code}`,email:application.email},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Kunde inte ansluta åkeriet.'},{status:400});}
}
