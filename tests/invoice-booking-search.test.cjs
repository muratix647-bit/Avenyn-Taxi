const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
test('admin searches across booking statuses and loads booking, billing company and invoice together',async()=>{
 const exports={};let allowed=false,filters='',table;
 const db={from(t){table=t;const q={select:()=>q,eq:()=>q,is:()=>q,order:()=>q,or(s){filters=s;return q},limit:async()=>({data:[{booking_number:178}]}),maybeSingle:async()=>({data:table==='bookings'?{tracking_token:'private',status:'completed',payment_method:'Kort',price_breakdown:{stop_address:'Stopp'}}:table==='billing_booking_links'?{reference:'X'}:{serial_no:42}})};return q}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/dispatch/customer-invoices/bookings/route.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,URL,require:n=>n.endsWith('economy-server')?{economyAdmin:async()=>{if(!allowed)throw Error();return {db}},failure:()=>new Response(null,{status:403}),json:x=>Response.json(x)}:{uuid:()=>true}});
 const get=async q=>exports.GET(new Request('https://example.invalid/?'+q));
 assert.equal((await get('q=178')).status,403);allowed=true;
 assert.equal((await (await get('q=178')).json()).bookings[0].booking_number,178);assert.match(filters,/booking_number.eq.178/);
 await get('q=2026-11-05');assert.match(filters,/booking_date.eq.2026-11-05/);
 await get('q=Landvetter');assert.match(filters,/dropoff_address.ilike/);
 const r=await (await get('id=example')).json();assert.equal(r.booking.payment_method,'Kort');assert.equal(r.booking.invoice_stop,'Stopp');assert.equal(r.booking.tracking_token,undefined);assert.equal(r.invoice.serial_no,42);assert.equal(r.link.reference,'X');
});
