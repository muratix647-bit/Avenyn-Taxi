import {syncTerminalPayment} from './terminal-payments';
import { adminSupabase } from './supabase-server';
import { retrieveCheckoutSession, stripeRequest } from './stripe';
import { confirmedStreetPayment } from './street-payment-validation';
export async function syncStreetPayment(row: any) {
  if (row.payment_channel === 'tap_to_pay') return syncTerminalPayment(row);
  if (!row.stripe_session_id || row.status === 'paid' || row.status === 'expired') return row;
  const session = await retrieveCheckoutSession(row.stripe_session_id);
  let update: any = null;
  if (confirmedStreetPayment(row, session)) {
    // Charge creation is the processor's payment timestamp, not the time this page was opened.
    const intent = await stripeRequest(`/payment_intents/${encodeURIComponent(session.payment_intent)}?expand[]=latest_charge`);
    if (!intent.latest_charge?.created) throw new Error('Betalningstiden kunde inte verifieras.');
    update = {status:'paid', paid_at:new Date(intent.latest_charge.created * 1000).toISOString()};
  } else if (session.status === 'expired') update = {status:'expired'};
  if (!update) return row;
  const {data,error} = await adminSupabase().from('driver_payments').update(update).eq('id',row.id).neq('status','paid').select().maybeSingle();
  if (error) throw error;
  return data || row;
}
