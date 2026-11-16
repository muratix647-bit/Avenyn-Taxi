import { adminSupabase, requireSupabaseUser } from '@/lib/supabase-server';
import { partnerStatuses } from '@/lib/partner-applications';
const columns = 'id,created_at,updated_at,company,org_number,contact_name,email,phone,permit_number,vehicle_count,area,message,status,admin_note';
async function authorized(request:Request) {
 const {supabase} = await requireSupabaseUser(request);
 const {data,error} = await supabase.rpc('is_dispatch_admin');
 if(error || !data) throw new Error('Forbidden');
 return adminSupabase();
}
export async function GET(request:Request) {
 try {
  const db = await authorized(request);
  const {data,error} = await db.from('partner_applications').select(columns).order('created_at',{ascending:false}).limit(500);
  if(error) throw error;
  return Response.json({applications:data},{headers:{'Cache-Control':'no-store'}});
 } catch {return Response.json({error:'Kunde inte hämta ansökningarna. Logga in som admin.'},{status:403});}
}
export async function PATCH(request:Request) {
 try {
  const db = await authorized(request);
  const body: any = await request.json();
  if(!/^[0-9a-f-]{36}$/i.test(body.id || '') || !Object.hasOwn(partnerStatuses,body.status) || typeof body.admin_note !== 'string' || body.admin_note.length > 2000 || typeof body.updated_at !== 'string') return Response.json({error:'Ogiltiga uppgifter.'},{status:400});
  const {data,error} = await db.from('partner_applications').update({status:body.status,admin_note:body.admin_note.trim(),updated_at:new Date().toISOString()}).eq('id',body.id).eq('updated_at',body.updated_at).select(columns).maybeSingle();
  if(error) throw error;
  if(!data) return Response.json({error:'Ansökan har ändrats. Uppdatera listan.'},{status:409});
  return Response.json({application:data});
 } catch {return Response.json({error:'Kunde inte spara. Kontrollera din admininloggning.'},{status:403});}
}
