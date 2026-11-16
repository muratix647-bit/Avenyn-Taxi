const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,deps={}){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInThisContext('(function(exports,module,require){'+code+'\n})')(m.exports,m,n=>deps[n]);return m.exports;}
const {billingSummary}=load('lib/business-billing.ts'),{receiptLogo}=load('lib/receipt-logo.ts');
const {businessInvoicePreview}=load('lib/business-invoice-preview.ts',{'pdf-lib':require('pdf-lib'),'./receipt-logo':{receiptLogo}});
const link={reference:'Projekt Göteborg',company:{name:'Exempelföretaget AB',org_number:'TEST',invoice_email:'test@example.com',billing_address:'Exempelgatan 1\n411 01 Göteborg',payment_days:30,approved:true},booking:{booking_number:178,booking_date:'2026-11-05',pickup_address:'Landvetter Airport (Göteborg Landvetter Airport)',dropoff_address:'Mårten Krakowgatan, Gullbergsvass, Göteborg',status:'completed',payment_method:'Faktura',actual_price:430}};
let role=true,auth=true,dbCalls=0,pdfCalls=0,current=link;
const route=load('app/api/dispatch/business-billing/preview/route.ts',{'@/lib/business-billing':{billingSummary},'@/lib/business-invoice-preview':{businessInvoicePreview:async(...args)=>{pdfCalls++;return businessInvoicePreview(...args);}},'@/lib/supabase-server':{requireSupabaseUser:async()=>{if(!auth)throw Error('Logga in');return {supabase:{rpc:async()=>({data:role})}}},adminSupabase:()=>{dbCalls++;return {from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:current,error:null})})})})}}}});
const req=()=>new Request('https://example.com/api/dispatch/business-billing/preview?booking_id=00000000-0000-0000-0000-000000000178');
(async()=>{
 for(const method of ['Faktura','invoice',' FAKTURA '])assert.equal(billingSummary({...link.booking,payment_method:method},link.company,'').ready,true);
 assert.equal(billingSummary({...link.booking,driver_reported_payment_method:'cash'},link.company,'').ready,false);
 role=false;assert.equal((await route.GET(req())).status,403);assert.equal(dbCalls,0);role=true;auth=false;assert.equal((await route.GET(req())).status,403);assert.equal(dbCalls,0);auth=true;
 assert.equal((await route.GET(new Request('https://example.com'))).status,400);assert.equal(dbCalls,0);
 for(const patch of [{status:'new'},{status:'cancelled'},{payment_status:'paid'},{driver_reported_paid:true},{actual_price:0}]){current={...link,booking:{...link.booking,...patch}};assert.equal((await route.GET(req())).status,409);}
 current={...link,company:{...link.company,approved:false}};assert.equal((await route.GET(req())).status,409);assert.equal(pdfCalls,0);current=null;assert.equal((await route.GET(req())).status,404);current=link;
 const r=await route.GET(req());assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/pdf');assert.match(r.headers.get('cache-control'),/no-store/);
 const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');fs.mkdirSync('/tmp/avenyn-pdf-qa',{recursive:true});fs.writeFileSync('/tmp/avenyn-pdf-qa/draft.pdf',bytes);
 const long={...link,company:{...link.company,name:'Ett mycket långt företagsnamn '.repeat(6),billing_address:'Lång adress med åäö och utländsk text 東京 '.repeat(15)}};fs.writeFileSync('/tmp/avenyn-pdf-qa/long.pdf',await businessInvoicePreview(long,43000));
 console.log('PASS: aliases, driver override, auth, invalid/missing links, fresh readiness checks, PDF and long text.');
})().catch(e=>{console.error(e);process.exit(1)});
