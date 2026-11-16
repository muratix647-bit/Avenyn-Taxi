import {adminSupabase} from '@/lib/supabase-server';
import {stripeRequest} from '@/lib/stripe';
import {amountOre} from '@/lib/street-payment-validation';
import {terminalDriver,terminalLocation,syncTerminalPayment} from '@/lib/terminal-payments';
import {terminalPaymentMatches} from '@/lib/terminal-payment-validation';
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const uuid=(v:unknown)=>typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
async function owned(id:string,driverId:string) {
 const {data,error}=await adminSupabase().from('driver_payments').select().eq('id',id).eq('driver_id',driverId).eq('payment_channel','tap_to_pay').single();
 if(error||!data)throw new Error('Betalningen hittades inte för denna förare.');return data;
}
export async function GET(request:Request){
 try{const driver=await terminalDriver(request);const id=new URL(request.url).searchParams.get('id');
  if(id){if(!uuid(id))return json({error:'Ogiltig betalning.'},400);return json({payment:await syncTerminalPayment(await owned(id,driver.id))});}
  return json({locationId:await terminalLocation(),merchant:'Avenyn Taxi'});
 }catch(e:any){return json({error:e?.message||'Tap to Pay är inte tillgängligt.'},400);}
}
export async function POST(request:Request){
 try{
  const driver=await terminalDriver(request);const body:any=await request.json();
  const locationId=await terminalLocation();
  if(body.action==='connection_token'){
   const token=await stripeRequest('/terminal/connection_tokens',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({location:locationId})});
   return json({secret:token.secret});
  }
  if(body.action!=='create'||!uuid(body.id))return json({error:'Ogiltig betalningsbegäran.'},400);
  const amount=amountOre(body.amount);const reference=String(body.reference||'').trim();
  if(reference.length>120)return json({error:'Referensen får vara högst 120 tecken.'},400);
  const db=adminSupabase();const insert=await db.from('driver_payments').upsert({id:body.id,driver_id:driver.id,driver_name:driver.full_name,amount_ore:amount,reference,payment_channel:'tap_to_pay'},{onConflict:'id',ignoreDuplicates:true});
  if(insert.error)throw insert.error;
  let row=await owned(body.id,driver.id);
  if(row.amount_ore!==amount||row.reference!==reference)return json({error:'Beloppet ändrades. Återuppta eller avbryt den pågående betalningen först.'},409);
  if(row.status==='paid'||row.status==='expired')return json({payment:row});
  // Never create a fresh charge for an old/uncertain attempt after Stripe's idempotency window.
  if(!row.stripe_payment_intent_id && Date.now()-new Date(row.created_at).getTime()>23*3600000)return json({error:'Betalningsförsöket är för gammalt. Kontakta trafikledningen för kontroll i Stripe.'},409);
  let intent;
  if(row.stripe_payment_intent_id)intent=await stripeRequest(`/payment_intents/${row.stripe_payment_intent_id}`);
  else {
   intent=await stripeRequest('/payment_intents',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','Idempotency-Key':`avenyn-tap-${row.id}`},body:new URLSearchParams({amount:String(amount),currency:'sek','payment_method_types[]':'card_present',capture_method:'automatic',description:'Avenyn Taxi – Tap to Pay','metadata[street_payment_id]':row.id,'metadata[driver_id]':driver.id})});
   if(intent.livemode!==true)throw new Error('Stripe är i testläge. En testbetalning får inte registreras som en riktig betalning.');
   const save=await db.from('driver_payments').update({stripe_payment_intent_id:intent.id,status:'pending'}).eq('id',row.id).eq('driver_id',driver.id).eq('status','creating').select().maybeSingle();
   if(save.error)throw save.error;row=save.data||await owned(row.id,driver.id);
  }
  if(!terminalPaymentMatches(row,intent))throw new Error('Betalningsuppgifterna stämmer inte med Stripe.');
  if(intent.status==='succeeded'||intent.status==='canceled')return json({payment:await syncTerminalPayment(row)});
  if(!['requires_payment_method','requires_confirmation'].includes(intent.status))return json({error:'Betalningen behandlas. Uppdatera status innan du försöker igen.',payment:row},409);
  return json({payment:row,clientSecret:intent.client_secret,locationId});
 }catch(e:any){return json({error:e?.message||'Betalningen kunde inte startas.'},400);}
}
export async function DELETE(request:Request){
 try{const driver=await terminalDriver(request);const body:any=await request.json();if(!uuid(body.id))return json({error:'Ogiltig betalning.'},400);
  let row=await syncTerminalPayment(await owned(body.id,driver.id));
  if(row.status==='paid'||row.status==='expired')return json({payment:row});
  if(!row.stripe_payment_intent_id)return json({error:'Återuppta betalningen för att kontrollera den innan den avbryts.'},409);
  await stripeRequest(`/payment_intents/${row.stripe_payment_intent_id}/cancel`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','Idempotency-Key':`avenyn-tap-cancel-${row.id}`},body:new URLSearchParams({cancellation_reason:'requested_by_customer'})});
  return json({payment:await syncTerminalPayment(row)});
 }catch(e:any){return json({error:e?.message||'Kunde inte avbryta. Kontrollera betalningsstatus.'},409);}
}
