const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function setup(user){
 const calls=[];
 const rows=[{id:'own',customer_email:'customer@example.test',drivers:{full_name:'Assigned driver'},booking_date:'2026-11-16',pickup_time:'10:00',status:'completed'}, {id:'admin-own',customer_email:'admin@example.test',drivers:null,booking_date:'2026-11-16',pickup_time:'11:00',status:'completed'}];
 let owner;
 const q={select(v){calls.push(['select',v]);return q},eq(k,v){calls.push(['eq',k,v]);owner=v;return q},order(){return q},async limit(){return {data:rows.filter(r=>r.customer_email===owner),error:null}}};
 const deps={'../../../lib/supabase-server':{requireSupabaseUser:async()=>{if(!user)throw Error('Logga in');return {user}},adminSupabase:()=>({from:()=>q})},'@/lib/booking-policy':{timeChangesClosed:()=>false},'@/lib/booking-options':{storedStop:()=>({label:''})},'../../../lib/flight-monitor':{flightNumberFromNotes:()=>null}};
 const m={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/customer-bookings/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,require:k=>deps[k]||{},Response,Request,URL,console});
 return {get:m.exports.GET,calls};
}
test('customer sees own trips and assigned driver; request parameters cannot select another customer',async()=>{
 const {get,calls}=setup({id:'customer',email:'CUSTOMER@example.test'});
 const res=await get(new Request('https://example.test/api/customer-bookings?customer_email=admin@example.test'));
 assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');
 const body=await res.json();assert.deepEqual(body.bookings.map(b=>b.id),['own']);assert.equal(body.bookings[0].driverName,'Assigned driver');
 assert.deepEqual(calls,[['select','*,drivers!bookings_driver_id_fkey(full_name)'],['eq','customer_email','customer@example.test']]);
});
test('administrator in customer portal is scoped to own email, including unassigned bookings',async()=>{
 const {get}=setup({id:'admin',email:'admin@example.test'});
 const res=await get(new Request('https://example.test/api/customer-bookings'));
 assert.equal(res.status,200);const body=await res.json();assert.deepEqual(body.bookings.map(b=>b.id),['admin-own']);assert.equal(body.bookings[0].driverName,null);
});
test('unauthenticated account cannot query bookings',async()=>{
 const {get,calls}=setup(null);assert.equal((await get(new Request('https://example.test/api/customer-bookings'))).status,401);assert.equal(calls.length,0);
});
test('account without email cannot query bookings',async()=>{
 const {get,calls}=setup({id:'no-email'});assert.equal((await get(new Request('https://example.test/api/customer-bookings'))).status,401);assert.equal(calls.length,0);
});
