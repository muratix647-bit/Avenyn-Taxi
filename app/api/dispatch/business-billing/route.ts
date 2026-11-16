import {adminSupabase,requireSupabaseUser} from '@/lib/supabase-server';
import {billingSummary,normalizeCompany} from '@/lib/business-billing';
const fields='price_breakdown,id,booking_number,customer_name,customer_email,customer_phone,pickup_time,passengers,luggage_count,child_seats,car_type,invoice_stop:price_breakdown->>stop_address,pickup_address,dropoff_address,booking_date,status,payment_method,payment_status,driver_reported_payment_method,driver_reported_paid,driver_reported_amount,actual_price,fixed_price,archived_at';
async function authorize(request:Request){
 const {supabase,user}=await requireSupabaseUser(request);
 const {data,error}=await supabase.rpc('is_dispatch_admin');
 if(error||data!==true)throw new Error('Endast dispatch');
 return {db:adminSupabase(),user};
}
function fail(e:any){const auth=['Logga in','Endast dispatch'].includes(e?.message);return Response.json({error:auth?e.message:'Kunde inte läsa eller spara fakturaunderlaget. Försök igen.'},{status:auth?403:500,headers:{'Cache-Control':'no-store'}});}
export async function GET(request:Request){try{
 const {db}=await authorize(request);
 const [companies,links,bookings]=await Promise.all([
 db.from('billing_companies').select('*').order('name').limit(500),
 db.from('billing_booking_links').select('*,company:billing_companies(*),booking:bookings('+fields+')').order('created_at',{ascending:false}).limit(500),
 db.from('bookings').select(fields).is('archived_at',null).order('created_at',{ascending:false}).limit(200)]);
 for(const r of [companies,links,bookings])if(r.error)throw r.error;
 const selected=new URL(request.url).searchParams.get('booking');
 if(selected&&/^[0-9a-f-]{36}$/i.test(selected)){
  if(!bookings.data.some(b=>b.id===selected)){
   const extra=await db.from('bookings').select(fields).eq('id',selected).is('archived_at',null).maybeSingle();
   if(extra.error)throw extra.error;if(extra.data)bookings.data.unshift(extra.data);
  }
  if(!links.data.some(l=>l.booking_id===selected)){
   const extra=await db.from('billing_booking_links').select('*,company:billing_companies(*),booking:bookings('+fields+')').eq('booking_id',selected).maybeSingle();
   if(extra.error)throw extra.error;if(extra.data)links.data.unshift(extra.data);
  }
 }
 return Response.json({companies:companies.data,bookings:bookings.data,links:(links.data||[]).map((l:any)=>({...l,summary:billingSummary(l.booking,l.company,l.reference)}))},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}}
export async function POST(request:Request){try{
 const {db,user}=await authorize(request);const body: any=await request.json();
 if(!body || typeof body!=="object" || Array.isArray(body)) return Response.json({error:"Ogiltigt underlag"},{status:400});
 if(body.action==='save_company'){
 let values;try{values=normalizeCompany(body.company||{});}catch(e:any){return Response.json({error:e.message},{status:400});}
 const row={...values,updated_at:new Date().toISOString(),updated_by:user.id};
 const result=body.company.id?await db.from('billing_companies').update(row).eq('id',body.company.id).select('id').single():await db.from('billing_companies').insert({...row,created_by:user.id}).select('id').single();
 if(result.error?.code==='23505')return Response.json({error:'Organisationsnumret finns redan. Redigera det befintliga företaget.'},{status:409});
 if(result.error)throw result.error;
 return Response.json({ok:true});
 }
 if(body.action==='link_booking'){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(!uuid.test(body.booking_id||'')||!uuid.test(body.company_id||''))return Response.json({error:'Välj bokning och företag.'},{status:400});
 const [c,b]=await Promise.all([db.from('billing_companies').select('id,approved,reference_required').eq('id',body.company_id).single(),db.from('bookings').select('id').eq('id',body.booking_id).single()]);
 const reference=String(body.reference||'').trim().slice(0,160);
 if(c.error||b.error||!c.data.approved)return Response.json({error:'Bokningen måste finnas och företaget vara godkänt för faktura.'},{status:400});
 if(c.data.reference_required&&!reference)return Response.json({error:'Företaget kräver en kundreferens.'},{status:400});
 const r=await db.from('billing_booking_links').upsert({booking_id:body.booking_id,company_id:body.company_id,reference,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:'booking_id'});
 if(r.error)throw r.error;return Response.json({ok:true});
 }
 return Response.json({error:'Okänd åtgärd'},{status:400});
 }catch(e){return fail(e);}}
