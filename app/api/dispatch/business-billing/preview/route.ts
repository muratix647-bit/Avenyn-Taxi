import {adminSupabase,requireSupabaseUser} from '@/lib/supabase-server';
import {billingSummary} from '@/lib/business-billing';
import {businessInvoicePreview} from '@/lib/business-invoice-preview';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request){try{
 const {supabase}=await requireSupabaseUser(request);const role=await supabase.rpc('is_dispatch_admin');
 if(role.error||role.data!==true)return Response.json({error:'Endast dispatch'},{status:403,headers});
 const id=new URL(request.url).searchParams.get('booking_id')||'';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return Response.json({error:'Välj en kopplad bokning.'},{status:400,headers});
 const {data:link,error}=await adminSupabase().from('billing_booking_links').select('reference,company:billing_companies(name,org_number,invoice_email,billing_address,payment_days,approved,reference_required),booking:bookings(booking_number,booking_date,pickup_address,dropoff_address,status,payment_method,payment_status,driver_reported_payment_method,driver_reported_paid,driver_reported_amount,actual_price,fixed_price,archived_at)').eq('booking_id',id).maybeSingle();
 if(error)throw error;
 if(!link||!link.booking||!link.company)return Response.json({error:'Företagskopplingen saknas.'},{status:404,headers});
 const summary=billingSummary(link.booking,link.company,link.reference||'');
 if(!summary.ready||summary.grossOre===null)return Response.json({error:summary.reasons.join(' · ')},{status:409,headers});
 const bytes=await businessInvoicePreview(link,summary.grossOre);
 return new Response(new Uint8Array(bytes).buffer,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="avenyn-fakturautkast.pdf"'}});
 }catch(e:any){return Response.json({error:e?.message==='Logga in'?'Logga in':'Kunde inte skapa PDF-förhandsvisningen.'},{status:e?.message==='Logga in'?403:500,headers});}}
