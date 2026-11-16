const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function moduleUnderTest(path,context={}) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,...context});
 return exports;
}
const {confirmedAmount,paymentBlocked}=moduleUnderTest('lib/booking-payment-sms.ts');
test('requires a confirmed price, prioritizes the reported fare, excludes cancelled, archived, refunded and paid trips',()=>{
 assert.equal(confirmedAmount({estimated_price:600}),0);
 assert.equal(confirmedAmount({fixed_price:500,actual_price:400,driver_reported_amount:350}),350);
 for(const row of [{status:'cancelled'},{archived_at:'today'},{payment_status:'paid'},{payment_status:'refunded'},{driver_reported_paid:true}]) assert.ok(paymentBlocked(row));
 assert.equal(paymentBlocked({status:'completed'}),'');
});
test('SMS addresses the customer and includes the booking, quoted price and branded payment link',async()=>{
 let request;
 const {sendBookingPaymentSms}=moduleUnderTest('lib/sms.ts',{require:()=>({env:{TWILIO_ACCOUNT_SID:'test',TWILIO_AUTH_TOKEN:'test',TWILIO_FROM_NUMBER:'+46000000000'}}),btoa,URLSearchParams,AbortSignal,console:{info(){},error(){}},fetch:async(url,opts)=>{request=opts.body;return {ok:true,json:async()=>({sid:'fake'})}}});
 const result=await sendBookingPaymentSms({booking_number:42,customer_phone:'0700000000',tracking_token:'00000000-0000-4000-8000-000000000000',booking_date:'2026-11-12',pickup_time:'13:00'},430);
 assert.equal(result.accepted,true);assert.equal(request.get('To'),'+46700000000');
 assert.match(request.get('Body'),/#42/);assert.match(request.get('Body'),/430 kr/);assert.match(request.get('Body'),/https:\/\/avenyntaxi.se\/r\/[A-Za-z0-9_-]{22}\?belopp=43000#betala/);
});
test('dispatch checks admin, destination, amount and issued invoices before sending',async()=>{
 let admin=false,invoice=false,sends=0;
 const booking={id:'test',status:'completed',tracking_token:'token',customer_phone:'0700000000',fixed_price:430};
 const db={from(table){
  const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:booking}),limit:async()=>({data:invoice?[{id:'invoice'}]:[]})};return q;
 }};
 const sms=moduleUnderTest('lib/sms.ts',{require:()=>({env:{}})});
 const {POST}=moduleUnderTest('app/api/dispatch/route.ts',{Response,require:name=>{
  if (name.endsWith('supabase-server')) return {requireSupabaseUser:async()=>({user:{},supabase:{rpc:async()=>({data:admin})}}),adminSupabase:()=>db};
  if(name.endsWith('booking-payment-sms'))return moduleUnderTest('lib/booking-payment-sms.ts');
  if(name.endsWith('customer-sms-monitor'))return {sendCustomerSmsOnce:async(id,kind,key,cb)=>cb(booking)};
  if(name.endsWith('/sms'))return {...sms,sendBookingPaymentSms:async()=>{sends++;return {accepted:true}}};
  return {};
 }});
 const send=(extra={})=>POST({json:async()=>({action:'send_payment_sms',bookingId:booking.id,amount:430,phone:booking.customer_phone,...extra})});
 assert.equal((await send()).status,403);admin=true;
 assert.equal((await send({phone:'0701111111'})).status,409);
 assert.equal((await send({amount:500})).status,409);
 invoice=true;assert.equal((await send()).status,409);
 const copy=()=>send({action:'copy_payment_link',phone:null});
 assert.equal((await copy()).status,409);
 invoice=false;admin=false;assert.equal((await copy()).status,403);
 admin=true;assert.match((await (await copy()).json()).url,/\?belopp=43000#betala$/);
 assert.equal(sends,0);invoice=false;assert.equal((await send()).status,200);assert.equal(sends,1);
});
test('SMS checkout verifies booking token and quote, reuses the same open Stripe session',async()=>{
 const booking={id:'demo',tracking_token:'private',status:'completed',actual_price:430};
 let row=null,creates=0;
 const db={from(table){
  let patch,insert;
  const q={select:()=>q,eq:()=>q,in:()=>q,limit:async()=>({data:[]}),
   update:value=>{patch=value;return q},insert:value=>{insert=value;return q},
   then:resolve=>{if(patch)Object.assign(row,patch);return resolve({error:null})},
   maybeSingle:async()=>({data:table==='bookings'?booking:row}),
   single:async()=>{if(row)return {error:{code:'23505'}};row={id:'request',...insert};return {data:row}}
  };return q;
 }};
 const stripe={createCheckoutSession:async options=>{assert.equal(options.amountSek,430);creates++;return {id:'cs_test',url:'https://example.test/pay'}},retrieveCheckoutSession:async()=>({status:'open',url:'https://example.test/pay'})};
 const {POST}=moduleUnderTest('app/api/payments/checkout/route.ts',{Response,URL,console,require:name=>name.endsWith('stripe')?stripe:name.endsWith('supabase-server')?{adminSupabase:()=>db}:moduleUnderTest('lib/booking-payment-sms.ts')});
 const open=(extra={})=>POST({url:'https://example.test/api/payments/checkout',json:async()=>({bookingId:'demo',trackingToken:'private',quotedOre:43000,...extra})});
 assert.equal((await open({trackingToken:'wrong'})).status,403);assert.equal((await open({quotedOre:100})).status,409);
 assert.equal((await open()).status,200);assert.equal((await (await open()).json()).url,'https://example.test/pay');assert.equal(creates,1);
 booking.driver_reported_paid=true;assert.equal((await open()).status,409);
});
