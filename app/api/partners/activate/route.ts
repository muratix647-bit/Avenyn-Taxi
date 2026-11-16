import {adminSupabase,publicSupabase} from '@/lib/supabase-server';
export async function POST(request:Request){
 try{
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new Error('Ogiltig begäran.');
  const body:any=await request.json();
  if(typeof body.code!=='string'||!/^[a-f0-9]{64}$/.test(body.code))throw new Error('Länken är ogiltig.');
  const db=adminSupabase();const now=new Date().toISOString();
  const {data:link,error}=await db.from('partner_invite_links').select('partner_id,token_hash,verification_type').eq('code',body.code).gt('expires_at',now).is('claimed_at',null).maybeSingle();
  if(error||!link)throw new Error('Länken har gått ut eller använts. Be Avenyn Taxi om en ny.');
  const {data:partner,error:partnerError}=await db.from('taxi_partners').select('id,auth_user_id,application_id').eq('id',link.partner_id).eq('active',true).maybeSingle();
  if(partnerError||!partner)throw new Error('Åkerikontot är inte aktivt.');
  const {data:application,error:applicationError}=await db.from('partner_applications').select('status').eq('id',partner.application_id).maybeSingle();
  if(applicationError||application?.status!=='approved')throw new Error('Åkeriet är inte längre godkänt.');
  const {data:claimed,error:claimError}=await db.from('partner_invite_links').update({claimed_at:now}).eq('code',body.code).is('claimed_at',null).select('code').maybeSingle();
  if(claimError||!claimed)throw new Error('Länken har redan använts.');
  const {data,error:verifyError}=await publicSupabase().auth.verifyOtp({token_hash:link.token_hash,type:link.verification_type as 'invite'|'magiclink'});
  if(verifyError||!data.session||data.user?.id!==partner.auth_user_id)throw new Error('Länken kunde inte aktiveras. Be om en ny.');
  return Response.json({session:{access_token:data.session.access_token,refresh_token:data.session.refresh_token},needs_password:link.verification_type==='invite'},{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Kunde inte aktivera kontot.'},{status:400});}
}
