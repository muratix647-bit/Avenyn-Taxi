import {env} from 'cloudflare:workers';
import {adminSupabase, requireSupabaseUser} from './supabase-server';
import {stripeRequest} from './stripe';
import {confirmedTerminalPayment, terminalPaymentMatches} from './terminal-payment-validation';
export async function terminalDriver(request: Request) {
  const {user} = await requireSupabaseUser(request);
  const {data,error} = await adminSupabase().from('drivers').select('id,full_name')
    .eq('auth_user_id',user.id).eq('approved',true).eq('active',true).is('archived_at',null).single();
  if(error || !data) throw new Error('Ett aktivt, godkänt förarkonto krävs.');
  return data;
}
async function fetchTerminalLocation() {
  const configured = (env as any).STRIPE_TERMINAL_LOCATION_ID;
  if(configured) {
    if(!/^tml_[A-Za-z0-9]+$/.test(configured)) throw new Error('Betalningsplatsen behöver konfigureras av Avenyn Taxi.');
    const location = await stripeRequest(`/terminal/locations/${configured}`);
    if(location.deleted || location.address?.country !== 'SE') throw new Error('Tap to Pay kräver en svensk betalningsplats.');
    return location.id as string;
  }
  const result = await stripeRequest('/terminal/locations?limit=100');
  const locations = (result.data || []).filter((l:any)=>!l.deleted && l.address?.country==='SE');
  if(result.has_more || locations.length!==1) throw new Error('Avenyn Taxi behöver välja en svensk betalningsplats i Stripe Terminal innan Tap to Pay kan startas.');
  return locations[0].id as string;
}
// Cache only merchant location configuration, never driver authorization,
// payment state, card data or connection tokens. Rotate on account/config changes.
let locationCache:{account:string;configured:string;expires:number;value:string}|null=null;
export async function terminalLocation() {
 const account=String(env.STRIPE_SECRET_KEY||'');
 const configured=String((env as any).STRIPE_TERMINAL_LOCATION_ID||'');
 if(!account)return fetchTerminalLocation();
 if(locationCache&&locationCache.account===account&&locationCache.configured===configured&&locationCache.expires>Date.now())return locationCache.value;
 const value=await fetchTerminalLocation();
 locationCache={account,configured,expires:Date.now()+30000,value};
 return value;
}
export async function syncTerminalPayment(row: any) {
  if(row.payment_channel !== 'tap_to_pay' || !row.stripe_payment_intent_id || row.status==='paid' || row.status==='expired') return row;
  const intent = await stripeRequest(`/payment_intents/${encodeURIComponent(row.stripe_payment_intent_id)}?expand[]=latest_charge`);
  if(!terminalPaymentMatches(row,intent)) throw new Error('Betalningen kunde inte verifieras mot Stripe.');
  let update:any = null;
  if(confirmedTerminalPayment(row,intent)) {
    const charge=intent.latest_charge;
    if(!charge?.created || charge.status!=='succeeded' || charge.amount!==row.amount_ore) throw new Error('Betalningens kvitto kunde inte verifieras.');
    update={status:'paid',paid_at:new Date(charge.created*1000).toISOString(),receipt_url:charge.receipt_url || null};
  } else if(intent.status==='canceled') update={status:'expired'};
  if(!update)return row;
  const {data,error}=await adminSupabase().from('driver_payments').update(update).eq('id',row.id).neq('status','paid').select().maybeSingle();
  if(error)throw error;
  return data || row;
}
