const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function setup(){
 const rows=new Map();let booking={status:'new',customer_phone:'0760000000'};
 const db={from(table){let inserted,patch,filters={};
 const execute=async()=>{
  if(table==='bookings')return {data:booking};
  if(inserted){const key=[inserted.booking_id,inserted.kind,inserted.event_key].join(':');if(rows.has(key))return {error:{code:'23505'}};const row={...inserted,id:key};rows.set(key,row);return {data:{...row}};}
  const row=[...rows.values()].find(r=>Object.entries(filters).every(([k,v])=>r[k]===v));
  if(!row)return {data:null};if(patch)Object.assign(row,patch);return {data:{...row}};
 };
 const q={insert(r){inserted=r;return q},update(r){patch=r;return q},select(){return q},eq(k,v){filters[k]=v;return q},single:execute,maybeSingle:execute,then(resolve,reject){return execute().then(resolve,reject)}};return q;
 }};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/customer-sms-monitor.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>n==='./supabase-server'?{adminSupabase:()=>db}:{},Date,console});
 return {send:cb=>exports.sendCustomerSmsOnce('booking','booking_confirmation','initial',cb),rows,cancel:()=>booking={status:'cancelled'}};
}
test('concurrent confirmation and replay send only once',async()=>{const s=setup();let calls=0;const cb=async()=>{calls++;return {accepted:true,providerId:'SM-test'}};await Promise.all([s.send(cb),s.send(cb)]);assert.equal(calls,1);assert.equal((await s.send(cb)).reason,'already_sent');assert.equal(calls,1)});
test('definite provider rejection can retry, timeout cannot',async()=>{const s=setup();let calls=0;await s.send(async()=>{calls++;return {accepted:false,reason:'provider_rejected'}});await s.send(async()=>{calls++;return {accepted:false,reason:'provider_unreachable'}});const r=await s.send(async()=>{calls++;return {accepted:true}});assert.equal(calls,2);assert.equal(r.reason,'confirmation_pending_review')});
test('inactive booking never sends confirmation',async()=>{const s=setup();s.cancel();let calls=0;const r=await s.send(async()=>{calls++;return {accepted:true}});assert.equal(calls,0);assert.equal(r.reason,'booking_inactive')});
