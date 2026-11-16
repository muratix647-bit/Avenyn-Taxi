import {adminSupabase,requireSupabaseUser} from '@/lib/supabase-server';
export async function partnerAdmin(request:Request){
 const {supabase}=await requireSupabaseUser(request);
 const {data,error}=await supabase.rpc('is_dispatch_admin');
 if(error||!data)throw new Error('Endast admin kan göra detta.');
 return adminSupabase();
}
export async function partnerAccount(request:Request){
 const {user}=await requireSupabaseUser(request);
 const db=adminSupabase();
 const {data,error}=await db.from('taxi_partners').select('id,company,email,created_at,application_id').eq('auth_user_id',user.id).eq('active',true).maybeSingle();
 if(error||!data)throw new Error('Ditt konto är inte anslutet till ett aktivt åkeri.');
 const {data:application,error:applicationError}=await db.from('partner_applications').select('status').eq('id',data.application_id).maybeSingle();
 if(applicationError||application?.status!=='approved')throw new Error('Åkeriets ansökan är inte längre godkänd. Kontakta Avenyn Taxi.');
 return {db,partner:data};
}
export const uuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
