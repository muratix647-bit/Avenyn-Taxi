const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const crypto=require('node:crypto').webcrypto;
function load(path,deps={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>deps[n]||{},crypto,TextEncoder,Response,Date,Uint8Array});
 return exports;
}
test('scheduled invoice waits, checks final price, sends once and serves only the matching active PDF',async()=>{
 const booking={id:crypto.randomUUID(),booking_number:123,status:'accepted',fixed_price:430,payment_method:'Faktura',booking_date:'2026-11-12',customer_name:'Provkund',customer_phone:'+46700000000'};
 const id=crypto.randomUUID(),actor=crypto.randomUUID();
 const payload={bookingId:booking.id,kind:'private',name:'Provkund',serviceDate:booking.booking_date,amount:'430',rate:'6',days:30,sellerVat:'SE556597479601',description:'Taxiresa'};
 const plan={booking_id:booking.id,invoice_id:id,payload,recipient:booking.customer_phone,actor,state:'waiting'};
 const tables={bookings:[booking],billing_booking_links:[],dispatch_invoice_sms_plans:[plan],dispatch_customer_invoices:[],dispatch_invoice_sms_links:[]};
 const db={from(table){
  let patch,insert,filters=[];
  function run(){
   const rows=tables[table].filter(row=>filters.every(f=>f(row)));
   if(insert){if(tables[table].some(x=>insert.attempt?x.attempt===insert.attempt:x.id===insert.id))return {error:{code:'23505'}};tables[table].push({...insert,serial_no:1,credited:false});}
   if(patch)rows.forEach(row=>Object.assign(row,patch));return {data:rows};
  }
  const q={select:()=>q,limit:()=>q,eq(k,v){filters.push(r=>r[k]===v);return q},neq(k,v){filters.push(r=>r[k]!==v);return q},in(k,v){filters.push(r=>v.includes(k==='bookings.status'?booking.status:r[k]));return q},gt(k,v){filters.push(r=>r[k]>v);return q},lt(k,v){filters.push(r=>r[k]<v);return q},update(v){patch=v;return q},insert(v){insert=v;return q},then(ok,bad){return Promise.resolve(run()).then(ok,bad)},async single(){return {data:run().data[0]}},async maybeSingle(){return {data:run().data[0]}}};return q;
 }};
 const ws=load('lib/economy-workspace.ts');
 const inv=load('lib/customer-invoice.ts',{'./economy-workspace':ws});
 let messages=[];
 const mod=load('lib/invoice-sms.ts',{'./supabase-server':{adminSupabase:()=>db},'./customer-invoice':inv,'./business-billing':load('lib/business-billing.ts'),'./invoice-booking':load('lib/invoice-booking.ts'),'./economy-server':{EconomyError:Error},'./sms':{normalizePhone:p=>p,sendInvoiceLinkSms:async(phone,num,url)=>{messages.push(url);return {accepted:true,providerId:'fake'}}}});
 await mod.processInvoicePlans();assert.equal(messages.length,0);
 booking.status='completed';booking.actual_price=450;await mod.processInvoicePlans();assert.equal(plan.state,'review');assert.equal(tables.dispatch_customer_invoices.length,0);
 booking.actual_price=430;plan.state='waiting';await Promise.all([mod.processInvoicePlans(),mod.processInvoicePlans()]);assert.equal(plan.state,'done');assert.equal(messages.length,1);assert.equal(tables.dispatch_customer_invoices.length,1);
 await mod.deliverInvoice(db,id,booking.customer_phone,actor,id);assert.equal(messages.length,1);
 await mod.deliverInvoice(db,id,booking.customer_phone,actor,crypto.randomUUID());assert.equal(messages.length,2);
 const route=load('app/faktura/[token]/route.ts',{'@/lib/invoice-sms':mod,'@/lib/supabase-server':{adminSupabase:()=>db},'@/lib/customer-invoice':inv,'@/lib/customer-invoice-pdf':{customerInvoicePdf:async row=>{assert.equal(row.id,id);return new TextEncoder().encode('%PDF-1.7')}}});
 const get=token=>route.GET(null,{params:Promise.resolve({token})});
 const token=messages[0].split('/').pop();assert.equal((await get(id)).status,404);
 const pdf=await get(token);assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.equal(await pdf.text(),'%PDF-1.7');
 tables.dispatch_invoice_sms_links[0].expires_at='2000';assert.equal((await get(token)).status,404);
 tables.dispatch_customer_invoices[0].credited=true;assert.equal((await get(messages[1].split('/').pop())).status,404);
});
