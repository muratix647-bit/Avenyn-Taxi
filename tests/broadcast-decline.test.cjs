const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const code=ts.transpileModule(fs.readFileSync('app/api/driver-trips/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
async function run({approved=true,available=true}={}){
 const writes=[];const db={from:table=>{assert.ok(['drivers','driver_action_log'].includes(table),'decline must never update bookings');const q={select:()=>q,eq:()=>q,is:()=>q,single:async()=>approved?{data:{id:'driver-a'}}:{error:Error('Unapproved')},insert:async row=>{writes.push(row);return {error:null}}};return q}};
 const exports={};vm.runInNewContext(code,{exports,Response,Set,Date,Intl,console,require:n=>n.includes('supabase-server')?{adminSupabase:()=>db,requireSupabaseUser:async()=>({user:{id:'user-a'},supabase:{rpc:async name=>{assert.equal(name,'driver_prebooking_pool');return {data:available?[{id:'trip'}]:[]}}}})}:{}});
 const response=await exports.POST(new Request('https://test/api/driver-trips',{method:'POST',body:JSON.stringify({action:'decline_booking',bookingId:'trip'})}));
 return {response,writes};
}
(async()=>{const ok=await run();assert.equal(ok.response.status,200);assert.equal(ok.writes.length,1);assert.equal(ok.writes[0].driver_id,'driver-a');assert.equal(ok.writes[0].action,'broadcast_declined');const gone=await run({available:false});assert.equal(gone.response.status,409);assert.equal(gone.writes.length,0);const denied=await run({approved:false});assert.notEqual(denied.response.status,200);assert.equal(denied.writes.length,0);console.log('PASS: decline saves only own response, never changes booking; stale/unapproved requests rejected');})();
