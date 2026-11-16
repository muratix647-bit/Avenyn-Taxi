import {adminSupabase} from '@/lib/supabase-server';
import {pickupAt,prebookingRisk} from '@/lib/prebooking-watch';
import {sendPrebookingAdminAlert} from '@/lib/sms';
export async function runPrebookingMonitor(dryRun=false) {
 const db=adminSupabase(); const now=Date.now();
 const {data,error}=await db.from('bookings').select('*').is('archived_at',null).not('status','in','(completed,cancelled,en_route,arrived,passenger_onboard)').gte('booking_date',new Date(now-86400000).toISOString().slice(0,10)).lte('booking_date',new Date(now+86400000).toISOString().slice(0,10));
 if(error) throw error;
 let due=0,sent=0,failed=0;
 for(const b of data||[]) {
  const risk=prebookingRisk(b,now);if(!risk)continue;due++;
  if(dryRun||due>20)continue;
  const key={booking_id:b.id,pickup_at:new Date(pickupAt(b)).toISOString(),stage:risk.stage};
  const claim=await db.from('booking_prebooking_alerts').insert({...key,state:'sending'}).select('id').single();
  if(claim.error){if(claim.error.code==='23505')continue;throw claim.error;}
  const {data:latest,error:readError}=await db.from('bookings').select('*').eq('id',b.id).single();
  if(readError)throw readError;
  const current=prebookingRisk(latest,Date.now());
  if(!current||current.stage!==risk.stage||pickupAt(latest)!==pickupAt(b)){await db.from('booking_prebooking_alerts').update({state:'cancelled'}).eq('id',claim.data.id);continue;}
  const result=await sendPrebookingAdminAlert(latest,risk.message);
  const saved=await db.from('booking_prebooking_alerts').update({state:result.accepted?'sent':'failed',provider_id:result.providerId||null,error:result.reason||null,sent_at:result.accepted?new Date().toISOString():null}).eq('id',claim.data.id);
  if(saved.error)throw saved.error;
  result.accepted?sent++:failed++;
 }
 return {due,sent,failed,dryRun};
}
