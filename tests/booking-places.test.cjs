const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const m={exports:{}};let calls=0,quote=true;
const db={rpc:async()=>{calls++;return {data:[{id:'booking',booking_number:100,price:250,status:'new',tracking_token:'track'}]}},from(){const q={select(){return q},eq(){return q},single:async()=>({data:{price_breakdown:{}}}),update(){return {eq:async()=>({error:null})}}};return q}};
const deps={'@/lib/pets':{validatePet:async(_db,value)=>value||null,petText:p=>p?.label||''},'@/lib/quote-token':{readQuote:async()=>quote?{id:'quote',quote:{total_price:250}}:null},'@/lib/booking-policy':{POLICY_VERSION:'test'},'@/lib/booking-options':{paymentMethods:['Kort'],stopBreakdown:()=>({})},'../../../lib/supabase-server':{adminSupabase:()=>db},'../../../lib/email':{sendBookingEmails:async()=>({sent:true})},'../../../lib/sms':{sendBookingSms:async()=>({accepted:true})},'../../../lib/flight-monitor':{syncFlightForBooking:async()=>({})}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/bookings/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,require:k=>{if(k in deps)return deps[k];throw Error(k)},Response,Request,Date,Number,Promise,console});
const input={policyVersion:'test',pickup:'Nils Ericson Terminalen',destination:'Liseberg',pickupLat:57.71,pickupLng:11.97,destinationLat:57.69,destinationLng:11.99,customerName:'Test',customerPhone:'0701234567',customerEmail:'test@example.com',pickupTime:'2026-10-10T12:00:00',passengers:1};
const run=patch=>m.exports.POST(new Request('https://test/api/bookings',{method:'POST',body:JSON.stringify({...input,...patch})}));
(async()=>{
 assert.equal((await run({})).status,200,'named places without street numbers must book');
 assert.equal((await run({stop:'Centralstationen',stopLat:57.7,stopLng:11.98})).status,200);
 assert.equal((await run({pickupLat:null})).status,400);assert.equal((await run({destinationLat:120})).status,400);
 assert.equal((await run({stop:'Centralstationen'})).status,400);
 quote=false;assert.equal((await run({})).status,409,'signed price remains required');assert.equal(calls,2);
 console.log('Booking places: names without street numbers, stops, coordinates and signed-price guard passed');
})().catch(e=>{console.error(e);process.exitCode=1});
