const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function smsModule() {
  const sent=[];
  const module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync('lib/sms.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,URLSearchParams,AbortSignal,btoa,console:{info(){},error(){}},require(name){if(name==='./customer-invoice')return {paidNoticeSv:'Resan är betald. OBS! Betala inte.',paidNoticeEn:'This trip has been paid for. Do not pay.',invoiceBankgiro:'Bankgiro 5370-4524'};assert.equal(name,'cloudflare:workers');return {env:{TWILIO_ACCOUNT_SID:'test',TWILIO_AUTH_TOKEN:'test',TWILIO_FROM_NUMBER:'+46700000000',ADMIN_NOTIFICATION_PHONE:'+46700000002'}};},fetch:async(url,options)=>{sent.push(new URLSearchParams(options.body));return {ok:true,status:201,json:async()=>({sid:'test'})};}});
  return {sms:module.exports,sent};
}
const booking={booking_number:123,customer_phone:'+46700000001',booking_date:'2026-10-20',pickup_time:'14:30',pickup_address:'Göteborg',dropoff_address:'Landvetter',tracking_token:'00000000-0000-0000-0000-000000000001',notes:'Flygnummer: SK123'};
test('booking and manual confirmation send immediate customer SMS',async()=>{
 const {sms,sent}=smsModule();await sms.sendBookingSms(booking,booking);await sms.sendManualBookingSms(booking);await sms.sendBookingDetailsSms(booking);
 assert.equal(sent.filter(s=>s.get('To')===booking.customer_phone).length,3);
});
test('routine status changes stay silent; scheduled reminder contains the correct time and one link',async()=>{
 const {sms,sent}=smsModule();for(const status of ['assigned','accepted','en_route','arrived','passenger_onboard','completed','cancelled'])await sms.sendBookingStatusSms(booking,status);
 assert.equal(sent.length,0);await sms.sendPickupReminderSms(booking);assert.equal(sent.length,1);assert.equal(sent[0].get('To'),booking.customer_phone);assert.match(sent[0].get('Body'),/14:30/);assert.equal((sent[0].get('Body').match(/https:\/\//g)||[]).length,1);
});
test('customer time change sends only an admin notification',async()=>{
 const {sms,sent}=smsModule();await sms.sendBookingTimeUpdateSms(booking);assert.equal(sent.length,1);assert.equal(sent[0].get('To'),'+46700000002');
});

test('paid receipt SMS carries both notices and the bankgiro',async()=>{
 const {sms,sent}=smsModule();await sms.sendPaidReceiptSms(booking,'https://example.test/k/test');
 const body=sent[0].get('Body');for(const value of ['OBS! Betala inte.','Do not pay.','Bankgiro 5370-4524','https://example.test/k/test'])assert.ok(body.includes(value));
});
