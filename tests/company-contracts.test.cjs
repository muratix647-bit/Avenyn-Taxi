const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto').webcrypto;
function load(file,deps={}){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext('(function(exports,module,require){'+code+'\n})',{crypto,console,Date})(m.exports,m,n=>{if(!(n in deps))throw Error(n);return deps[n]});return m.exports;}
class EconomyError extends Error{}
const pricing=load('lib/company-pricing.ts',{'./economy-server':{EconomyError}});
const workspace=load('lib/economy-workspace.ts'),invoice=load('lib/customer-invoice.ts',{'./economy-workspace':workspace}),billing=load('lib/business-billing.ts'),booking=load('lib/invoice-booking.ts');
const deps={'./customer-invoice':invoice,'./business-billing':billing,'./invoice-booking':booking,'./economy-server':{EconomyError}};
const id='11111111-1111-4111-8111-111111111111';
const company={approved:true,reference_required:false,name:'Test',org_number:'123',billing_address:'Testgatan 1',invoice_sender_address:'Avsändargatan 1',invoice_email:'test@example.invalid',payment_days:5,updated_by:'admin',auto_invoice_since:'2026-11-14T00:00:00Z',id:'company'};
const trip={id,booking_number:99,booking_date:'2026-11-15',created_at:'2026-11-15T00:00:00Z',status:'completed',payment_method:'Faktura',fixed_price:2000,pickup_address:'Henån',dropoff_address:'Landvetter Airport',price_breakdown:{company_pricing:{base:1500,extras:[{description:'Överenskommen omväg',amount:500}]}}};
test('fixed price matches route and car; reverse and extras require explicit agreement',()=>{
 const rates=pricing.validateRates([{from:'Henån',to:'Landvetter Airport',vehicle:'standard',price:1500,active:true}]);
 const input={pickupAddress:'Centrum, Henån',dropoffAddress:'Göteborg Landvetter Airport',carType:'standard'};
 assert.equal(pricing.selectCompanyRate(rates,input).price,1500);
 assert.equal(pricing.selectCompanyRate(rates,{...input,carType:'large'}),null);
 assert.equal(pricing.selectCompanyRate(rates,{pickupAddress:input.dropoffAddress,dropoffAddress:input.pickupAddress}),null);
 assert.throws(()=>pricing.selectCompanyRate([...rates,...rates],input),/Flera/);
 assert.throws(()=>pricing.selectCompanyRate(rates,{...input,stopAddress:'Extra stopp'}),/extra stopp/);
 assert.throws(()=>pricing.validateRates([{...rates[0],price:-1}]));
});
test('invoice separates base and detour, preserves VAT and terms, blocks paid or mismatched totals',()=>{
 const lib=load('lib/company-auto-invoice.ts',{...deps,'./supabase-server':{},'./company-invoice-email':{}});
 const r=lib.companyInvoiceRecord(trip,company,'',id);assert.equal(r.gross_ore,200000);assert.equal(r.document.items.length,2);assert.equal(r.document.items[0].unitOre,150000);assert.equal(r.document.items[1].unitOre,50000);assert.equal(r.document.days,5);assert.equal(r.document.reference,'B99');assert.equal(r.document.recipientEmail,'test@example.invalid');
 for(const patch of [{payment_status:'paid'},{status:'cancelled'},{actual_price:2100}])assert.throws(()=>lib.companyInvoiceRecord({...trip,...patch},company,'',id));
});
test('automatic worker claims once, sends once and records review for rejected delivery',async()=>{
 for(const fail of [false,true]){
 let job=null,sends=0,issues=0;
 const db={rpc:async()=>({data:[{booking_id:id,company_id:'company'}]}),from(table){let inserted=false,updated=null;const q={select:()=>q,eq:()=>q,lt:()=>q,insert(x){inserted=true;return q;},update(x){updated=x;return q;},single:async()=>{if(table==='billing_auto_invoice_jobs'){if(job)return{error:{code:'23505'}};job={booking_id:id,company_id:'company',invoice_id:id,state:'processing'};return{data:job};}return{data:table==='bookings'?trip:{reference:'',company}};},then(resolve){if(table==='dispatch_customer_invoices'&&inserted)issues++;if(table==='billing_auto_invoice_jobs'&&job&&updated?.updated_at)Object.assign(job,updated);return Promise.resolve(resolve({}));}};return q;}};
 const lib=load('lib/company-auto-invoice.ts',{...deps,'./supabase-server':{adminSupabase:()=>db},'./company-invoice-email':{sendCompanyInvoice:async()=>{sends++;if(fail)throw new EconomyError('Rejected');}}});
 await lib.processCompanyInvoices();await lib.processCompanyInvoices();assert.equal(issues,1);assert.equal(sends,1);assert.equal(job.state,fail?'review':'done');
 }
});
