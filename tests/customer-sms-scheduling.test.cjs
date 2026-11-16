const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>imports[n],Date,Intl,Number,String,Map,Set,console});return exports;}
const time=load('lib/prebooking-watch.ts');const {reminderDue,flightSmsEvent}=load('lib/customer-sms-policy.ts',{'./prebooking-watch':time});
const b={booking_date:'2026-10-25',pickup_time:'07:30:00',status:'new'};
assert.equal(time.pickupAt(b),Date.parse('2026-10-25T06:30:00Z'));
assert.equal(reminderDue(b,Date.parse('2026-10-25T05:29:59Z')),false,'No SMS before 06:30 Swedish winter time');
assert.equal(reminderDue(b,Date.parse('2026-10-25T05:30:00Z')),true,'Send at 06:30 Swedish winter time');
assert.equal(reminderDue(b,Date.parse('2026-10-25T06:30:00Z')),false,'Never remind after pickup');
assert.equal(reminderDue({...b,status:'cancelled'},Date.parse('2026-10-25T05:30:00Z')),false);
assert.equal(reminderDue({...b,archived_at:'yes'},Date.parse('2026-10-25T05:30:00Z')),false);
const summer={...b,booking_date:'2026-07-25'};assert.equal(reminderDue(summer,Date.parse('2026-07-25T04:30:00Z')),true);
const f={scheduledUtc:'2026-10-25T12:00:00Z',estimatedUtc:'2026-10-25T12:00:00Z',status:'Planerad'};
assert.equal(flightSmsEvent(f,'arrivals'),null);assert.equal(flightSmsEvent({...f,estimatedUtc:'2026-10-25T11:50:00Z'},'arrivals'),null);
assert.match(flightSmsEvent({...f,estimatedUtc:'2026-10-25T12:05:00Z'},'arrivals').message,/försenat/);
assert.equal(flightSmsEvent({...f,status:'Inställt'},'arrivals').key,'cancelled');
assert.equal(flightSmsEvent({...f,actualUtc:'2026-10-25T12:05:00Z',estimatedUtc:'2026-10-25T12:05:00Z'},'arrivals'),null);
(async()=>{
 const claims=new Set();let sends=0;let inactive=false;
 const db={from:table=>{let row;const q={insert:r=>{row=r;return q},select:()=>q,eq:()=>q,single:async()=>{if(table==='bookings')return {data:{status:inactive?'cancelled':'new'}};const k=JSON.stringify(row);if(claims.has(k))return {error:{code:'23505'}};claims.add(k);return {data:{id:'claim'}}},update:()=>({eq:async()=>({error:null})})};return q;}};
 const {sendCustomerSmsOnce}=load('lib/customer-sms-monitor.ts',{'./supabase-server':{adminSupabase:()=>db},'./sms':{},'./customer-sms-policy':{},'./prebooking-watch':time});
 const send=async()=>{sends++;return {accepted:true,providerId:'mock'}};
 await Promise.all([sendCustomerSmsOnce('b','pickup_reminder','time',send),sendCustomerSmsOnce('b','pickup_reminder','time',send)]);assert.equal(sends,1,'Concurrent monitor ticks must not duplicate SMS');
 inactive=true;await sendCustomerSmsOnce('cancelled','pickup_reminder','time',send);assert.equal(sends,1,'Recheck cancellation after claim');
 console.log('PASS: Swedish summer/winter time, one-hour boundary, overdue/cancelled exclusion, only delayed/cancelled flights, concurrent deduplication');
})();
