const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,deps={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:m.exports,module:m,require:n=>deps[n],Response,Request,Date});return m.exports;}
const {billingSummary:s,normalizeCompany:n}=load('lib/business-billing.ts');
const b={status:'completed',payment_method:'invoice',actual_price:530},c={approved:true,reference_required:false};
assert.equal(s(b,c,'').ready,true);assert.equal(s(b,c,'').grossOre,53000);
for(const patch of [{status:'cancelled'},{status:'scheduled'},{payment_status:'paid'},{driver_reported_paid:true},{payment_method:'card'},{driver_reported_payment_method:'cash'},{actual_price:null,estimated_price:530},{actual_price:0},{actual_price:-1},{actual_price:'NaN'},{archived_at:'2026-01-01'}])assert.equal(s({...b,...patch},c,'').ready,false,JSON.stringify(patch));
assert.equal(s(b,{...c,approved:false},'').ready,false);
assert.equal(s(b,{...c,reference_required:true},' ').ready,false);
assert.equal(s(b,{...c,reference_required:true},'ABC').ready,true);
assert.equal(s({...b,driver_reported_amount:600},c,'').grossOre,60000);
assert.throws(()=>n({}));
assert.equal(n({name:' Företag ',org_number:'123',invoice_email:'A@B.SE',billing_address:'Adress',payment_days:30}).invoice_email,'a@b.se');
let role=false,auth=true,adminCalls=0;
const route=load('app/api/dispatch/business-billing/route.ts',{'@/lib/business-billing':{billingSummary:s,normalizeCompany:n},'@/lib/supabase-server':{requireSupabaseUser:async()=>{if(!auth)throw Error('Logga in');return {supabase:{rpc:async()=>({data:role})},user:{id:'x'}}},adminSupabase:()=>{adminCalls++;throw Error('test')}}});
(async()=>{for(const method of ['GET','POST']){const response=await route[method](new Request('https://example.com'));assert.equal(response.status,403);}assert.equal(adminCalls,0);auth=false;assert.equal((await route.GET(new Request('https://example.com'))).status,403);assert.equal(adminCalls,0);console.log('Business billing: price, payment, lifecycle, reference and authorization checks passed.');})();
