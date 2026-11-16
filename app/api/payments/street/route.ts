import {adminSupabase, requireSupabaseUser} from '@/lib/supabase-server';
import {stripeRequest} from '@/lib/stripe';
import {syncStreetPayment} from '@/lib/street-payments';
import {amountOre} from '@/lib/street-payment-validation';
const json = (data:any,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function identity(request:Request, admin=false) {
  const {user,supabase} = await requireSupabaseUser(request);
  if(admin){const role=await supabase.rpc('is_dispatch_admin');if(role.error||!role.data)throw new Error('Endast Dispatch.');return null;}
  const {data,error}=await adminSupabase().from('drivers').select('id,full_name').eq('auth_user_id',user.id).eq('approved',true).eq('active',true).is('archived_at',null).single();
  if(error||!data)throw new Error('Ett aktivt, godkänt förarkonto krävs.');return data;
}
export async function POST(request:Request){
 try{
  const driver=await identity(request);const body:any=await request.json();
  const id=String(body.id||'');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return json({error:'Ogiltig betalningsreferens.'},400);
  const amount=amountOre(body.amount);const reference=String(body.reference||'').trim();if(reference.length>120)return json({error:'Referensen får vara högst 120 tecken.'},400);
  const db=adminSupabase();
  const insert=await db.from('driver_payments').upsert({id,driver_id:driver!.id,driver_name:driver!.full_name,amount_ore:amount,reference},{onConflict:'id',ignoreDuplicates:true});if(insert.error)throw insert.error;
  const result=await db.from('driver_payments').select().eq('id',id).eq('driver_id',driver!.id).single();const row=result.data;
  if(result.error||!row)return json({error:'Betalningen hittades inte.'},404);
  if(row.payment_channel!=='payment_link')return json({error:'Betalningen tillhör Tap to Pay.'},409);
  if(row.amount_ore!==amount||row.reference!==reference)return json({error:'Beloppet ändrades. Börja en ny betalning.'},409);
  if(row.checkout_url||row.status==='paid')return json({payment:await syncStreetPayment(row)});
  if(Date.now()-new Date(row.created_at).getTime()>23*3600000)return json({error:'Försöket är för gammalt. Börja en ny betalning.'},409);
  const p=new URLSearchParams({mode:'payment',locale:'sv','payment_method_types[0]':'card','line_items[0][quantity]':'1','line_items[0][price_data][currency]':'sek','line_items[0][price_data][unit_amount]':String(amount),'line_items[0][price_data][product_data][name]':'Avenyn Taxi – resa utan bokning','metadata[street_payment_id]':id,'metadata[driver_id]':driver!.id,'payment_intent_data[metadata][street_payment_id]':id,'payment_intent_data[metadata][driver_id]':driver!.id,client_reference_id:id,success_url:'https://www.avenyntaxi.se/payment/street?session_id={CHECKOUT_SESSION_ID}',cancel_url:'https://www.avenyntaxi.se/payment/street?cancelled=1'});
  const session=await stripeRequest('/checkout/sessions',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','Idempotency-Key':`street-${id}`},body:p});
  const saved=await db.from('driver_payments').update({stripe_session_id:session.id,checkout_url:session.url,status:'pending'}).eq('id',id).eq('status','creating').select().single();if(saved.error)throw saved.error;
  return json({payment:saved.data});
 }catch(e:any){console.error('street_payment_create',e?.message);return json({error:e?.message||'Betalningen kunde inte skapas.'},400);}
}
export async function GET(request:Request){
 try{
  const params=new URL(request.url).searchParams;const sessionId=params.get('session_id');const db=adminSupabase();
  // A Stripe session ID is a secret bearer capability; expose no driver/customer details here.
  if(sessionId){if(!/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(sessionId))return json({error:'Ogiltig betalning.'},400);const {data,error}=await db.from('driver_payments').select().eq('stripe_session_id',sessionId).single();if(error||!data)return json({error:'Betalningen hittades inte.'},404);const row=await syncStreetPayment(data);return json({paid:row.status==='paid',status:row.status,amount:row.amount_ore/100});}
  const admin=params.get('scope')==='dispatch';const driver=await identity(request,admin);
  let q=db.from('driver_payments').select();q=params.get('trash')==='1'?q.not('archived_at','is',null):q.is('archived_at',null);q=q.order('created_at',{ascending:false}).limit(200);if(!admin)q=q.eq('driver_id',driver!.id);
  const {data,error}=await q;if(error)throw error;
  let syncError=false;let count=0;
  const rows=await Promise.all((data||[]).map(async row=>{if(row.status!=='pending'||count++>=20)return row;try{return await syncStreetPayment(row)}catch{syncError=true;return row;}}));
  return json({payments:rows,syncError});
 }catch(e:any){return json({error:e?.message||'Betalningarna kunde inte hämtas.'},403);}
}

// List removal never changes the processor charge or accounting history.
export async function PATCH(request:Request){
 try{
  const admin=new URL(request.url).searchParams.get('scope')==='dispatch';
  const driver=await identity(request,admin);const body:any=await request.json();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id||''))return json({error:'Ogiltig betalningsreferens.'},400);
  let patch:any;
  if(body.action==='archive')patch={archived_at:new Date().toISOString()};
  else if(body.action==='restore')patch={archived_at:null};
  else if(body.action==='edit'){
   if(typeof body.reference!=='string'||body.reference.trim().length>120)return json({error:'Referensen får vara högst 120 tecken.'},400);
   patch={reference:body.reference.trim()};
  }else return json({error:'Ogiltig åtgärd.'},400);
  let q=adminSupabase().from('driver_payments').update(patch).eq('id',body.id);
  if(!admin)q=q.eq('driver_id',driver!.id);
  const {data,error}=await q.select().maybeSingle();if(error)throw error;
  if(!data)return json({error:'Betalningen hittades inte.'},404);
  return json({payment:data});
 }catch(e:any){return json({error:e?.message||'Betalningen kunde inte uppdateras.'},403);}
}
