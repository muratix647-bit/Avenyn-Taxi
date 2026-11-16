import {adminSupabase} from './supabase-server';
import {pickupAt} from './prebooking-watch';
import {driverReminderStage,driverReminderPayload} from './driver-reminder-policy';
import {sendDriverReminderPush} from './push';

export async function runDriverReminders(dryRun=false) {
 const db=adminSupabase(),now=Date.now();
 const result=await db.from('bookings').select('*').eq('status','accepted').is('archived_at',null).not('driver_id','is',null)
  .gte('booking_date',new Date(now-86400000).toISOString().slice(0,10)).lte('booking_date',new Date(now+86400000).toISOString().slice(0,10));
 if(result.error)throw result.error;
 let due=0,sent=0,failed=0;
 for(const booking of result.data||[]){
  const stage=driverReminderStage(booking,now);if(!stage)continue;
  due++;if(dryRun||due>50)continue;
  const claim=await db.from('driver_booking_reminders').insert({booking_id:booking.id,driver_id:booking.driver_id,pickup_at:new Date(pickupAt(booking)).toISOString(),stage,state:'sending'}).select('id').single();
  if(claim.error){if(claim.error.code==='23505')continue;throw claim.error;}
  try{
   const latest=await db.from('bookings').select('*').eq('id',booking.id).single();
   if(latest.error)throw latest.error;
   if(driverReminderStage(latest.data)!==stage||latest.data.driver_id!==booking.driver_id||pickupAt(latest.data)!==pickupAt(booking)){
    const cancelled=await db.from('driver_booking_reminders').update({state:'cancelled'}).eq('id',claim.data.id);if(cancelled.error)throw cancelled.error;continue;
   }
   const delivery=await sendDriverReminderPush(booking.driver_id,driverReminderPayload(latest.data,stage));
   const saved=await db.from('driver_booking_reminders').update({state:delivery.sent?'sent':'failed',sent_count:delivery.sent,error:delivery.sent?null:'no_notification_delivered',sent_at:delivery.sent?new Date().toISOString():null}).eq('id',claim.data.id);
   if(saved.error)throw saved.error;
   delivery.sent?sent++:failed++;
  }catch(error){
   // Never retry an uncertain delivery automatically: the provider may have accepted it.
   failed++;await db.from('driver_booking_reminders').update({state:'failed',error:'delivery_or_recording_failed'}).eq('id',claim.data.id);
   console.error('driver_reminder_failed',{bookingId:booking.id,stage});
  }
 }
 return {due,sent,failed,dryRun};
}
