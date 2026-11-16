const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const id='00000000-0000-4000-8000-000000000001';
let entry,authorized=true,calls=0,mode='ok',corrected;
const row={id,serial_no:123,customer_no:4,gross_ore:10600,document:{payment:'Bankgiro 5370-4524',refFormat:'short'}};
function load(file,deps){const m={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInThisContext('(function(module,exports,require){'+js+'\n})')(m,m.exports,n=>deps[n]);return m.exports;}
const ws=load('lib/economy-workspace.ts',{}),inv=load('lib/customer-invoice.ts',{'./economy-workspace':ws});
const db={from(table){if(table==='dispatch_customer_invoices')return{select(){return this},eq(){return this},single:async()=>({data:row})};
 return {insert:async(v)=>entry?{error:{code:'23505'}}:(entry={...v},{}),update(v){const filters=[];const run=()=>{if(filters.every(([k,x])=>entry[k]===x)){Object.assign(entry,v);return{data:{invoice_id:id}}}return{data:null}};return{eq(k,x){filters.push([k,x]);return this},select(){return this},maybeSingle:async()=>run(),then(ok){return Promise.resolve(run()).then(ok)}}}}}};
class Err extends Error{constructor(msg,status=400){super(msg);this.status=status}}
const route=load('app/api/dispatch/customer-invoices/send/route.ts',{
 '@/lib/economy-workspace':ws,'@/lib/customer-invoice':inv,
 '@/lib/economy-server':{economyAdmin:async()=>{if(!authorized)throw new Err('Denied',403);return {db,user:{id}}},bodyJson:r=>r.json(),EconomyError:Err,json:x=>Response.json(x),failure:e=>Response.json({error:e.message},{status:e.status||500})},
 '@/lib/customer-invoice-pdf':{customerInvoicePdf:async(r,c)=>{corrected=c;return new Uint8Array([37,80,68,70])}},
 '@/lib/email':{sendCustomerInvoice:async(to,n,ref,total,bytes)=>{calls++;assert.equal(ref,'F123');assert.equal(to,'example@example.invalid');assert.equal(bytes.length,4);return mode==='ok'?{accepted:true,providerId:'mock'}:mode==='unknown'?{accepted:false,status:503}:{accepted:false,status:422}}}
});
const post=(recipient='example@example.invalid')=>route.POST(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({id,recipient})}));
(async()=>{
 authorized=false;assert.equal((await post()).status,403);authorized=true;
 assert.equal((await post('a@b.se,c@d.se')).status,400);
 assert.deepEqual((await Promise.all([post(),post()])).map(r=>r.status).sort(),[200,409]);assert.equal(calls,1);assert.equal(entry.state,'accepted');assert.equal(corrected,false);
 entry=null;mode='reject';assert.equal((await post()).status,502);assert.equal(entry.state,'rejected');
 mode='ok';row.document.payment='gammal uppgift';assert.equal((await post()).status,200);assert.equal(corrected,true);
 entry=null;mode='unknown';await post();assert.equal(entry.state,'pending');assert.equal((await post()).status,409);
 assert.equal(inv.paymentReference({...row,document:{}}),'K000004 AT-0000123');
 console.log('PASS: short and historical references, access, recipient, PDF, concurrent sends, safe retries and uncertain delivery');
})().catch(e=>{console.error(e);process.exit(1)});
