const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),ts=require('typescript');
const {renderToStaticMarkup}=require('react-dom/server');
function load(file,deps={}){
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>deps[n]||require(n)});
 return exports;
}
test('paid card trip can be reviewed and shared as a receipt without a payment demand',()=>{
 const m=load('components/paid-trip-review.tsx',{'@/lib/customer-invoice':load('lib/customer-invoice.ts',{'./economy-workspace':load('lib/economy-workspace.ts')}),'./paid-receipt-actions':load('components/paid-receipt-actions.tsx'),'@/lib/invoice-booking':load('lib/invoice-booking.ts'),'@/lib/paid-trip-details':load('lib/paid-trip-details.ts',{'./booking-options':load('lib/booking-options.ts'),'./completion-time':load('lib/completion-time.ts')}),'@/lib/economy-workspace':load('lib/economy-workspace.ts')});
 const b={booking_number:185,completed_at:'2026-11-12T19:12:14Z',passengers:7,luggage_count:0,child_seats:0,car_type:'large',notes:'Testmeddelande',driver_reported_payment_note:'Testreferens',status:'completed',customer_phone:'0700000000',driver_reported_paid:true,payment_method:'Kort',actual_price:2780};
 assert.equal(m.isPaidTrip(b),true);assert.equal(m.isPaidTrip({...b,driver_reported_paid:false}),false);assert.equal(m.isPaidTrip({...b,payment_status:'refunded'}),false);
 assert.equal(m.isPaidTrip({payment_status:'succeeded'}),true);
 const html=renderToStaticMarkup(m.default({booking:b})).replace(/\s/g,' ');
 for(const field of ['2026-11-12 20:12:14','Ingen barnstol','Storbil','Testmeddelande','Testreferens','Bagage'])assert.ok(html.includes(field));
 assert.match(html,/OBS! Betala inte/);assert.match(html,/Do not pay/);assert.match(html,/Bankgiro 5370-4524/);
 assert.match(html,/Granska betald resa #185/);assert.match(html,/2 780,00/);assert.match(html,/Kvar att betala.*0,00/);assert.doesNotMatch(html,/type="submit"|Skicka betallänk/);assert.match(html,/Skicka kvitto via SMS/);assert.match(html,/Mejla PDF-kvitto/);
});
