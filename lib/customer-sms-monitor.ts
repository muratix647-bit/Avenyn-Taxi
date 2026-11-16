import {adminSupabase} from './supabase-server';
import {sendPickupReminderSms,type SmsResult} from './sms';
import {reminderDue} from './customer-sms-policy';
import {pickupAt} from './prebooking-watch';

// Claim before contacting the provider. An ambiguous timeout is never auto-retried.
export async function sendCustomerSmsOnce(bookingId:string,kind:string,eventKey:string,send:(booking:any)=>Promise<SmsResult>) {
 const db=adminSupabase();
 const claim=await db.from('customer_sms_deliveries').insert({booking_id:bookingId,kind,event_key:eventKey,state:'sending'}).select('id').single();
 if(claim.error){
  if(claim.error.code!=='23505')throw claim.error;
  if(kind!=='booking_confirmation' && kind!=='payment_link' && kind!=='paid_receipt')return {accepted:false,reason:'already_processed'};
  const existing=await db.from('customer_sms_deliveries').select('id,state,provider_id,error').eq('booking_id',bookingId).eq('kind',kind).eq('event_key',eventKey).single();
  if(existing.error)throw existing.error;
  if(existing.data.state==='sent')return {accepted:true,providerId:existing.data.provider_id,reason:'already_sent'};
  // Only a definite rejection is safe to retry. A timeout may already have sent the SMS.
  if(existing.data.state!=='failed'||!['invalid_phone','sms_not_configured','provider_rejected','booking_read_failed','booking_changed'].includes(existing.data.error))return {accepted:false,reason:'confirmation_pending_review'};
  const retry=await db.from('customer_sms_deliveries').update({state:'sending',error:null}).eq('id',existing.data.id).eq('state','failed').select('id').maybeSingle();
  if(retry.error)throw retry.error;
  if(!retry.data)return {accepted:false,reason:'confirmation_pending_review'};
  claim.data=retry.data;
 }
 const latest=await db.from('bookings').select('*').eq('id',bookingId).single();
 let result:SmsResult;
 if(latest.error)result={accepted:false,reason:'booking_read_failed'};
 else if(latest.data.archived_at||latest.data.status==='cancelled'||(latest.data.status==='completed' && kind!=='payment_link' && kind!=='paid_receipt'))result={accepted:false,reason:'booking_inactive'};
 else result=await send(latest.data).catch(()=>({accepted:false,reason:'send_failed'}));
 const saved=await db.from('customer_sms_deliveries').update({state:result.accepted?'sent':'failed',provider_id:result.providerId||null,error:result.reason||null,sent_at:result.accepted?new Date().toISOString():null}).eq('id',claim.data.id);
 if(saved.error)throw saved.error;
 return result;
}
export async function runCustomerSmsReminders(dryRun=false){
 const db=adminSupabase(),now=Date.now();
 const rows=await db.from('bookings').select('*').is('archived_at',null).not('status','in','(completed,cancelled,passenger_onboard)').gte('booking_date',new Date(now-86400000).toISOString().slice(0,10)).lte('booking_date',new Date(now+86400000).toISOString().slice(0,10));
 if(rows.error)throw rows.error;
 let due=0,sent=0,failed=0;
 for(const booking of rows.data||[]){
  if(!reminderDue(booking,now))continue;
  due++;if(dryRun||due>50)continue;
  const result=await sendCustomerSmsOnce(booking.id,'pickup_reminder',new Date(pickupAt(booking)).toISOString(),async latest=>reminderDue(latest)&&pickupAt(latest)===pickupAt(booking)?sendPickupReminderSms(latest):{accepted:false,reason:'pickup_changed_or_not_due'});
  if(result.accepted)sent++;else if(result.reason!=='already_processed')failed++;
 }
 return {due,sent,failed,dryRun};
}
