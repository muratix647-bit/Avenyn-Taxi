const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={}){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInThisContext('(function(exports,module,require){'+code+'\n})')(m.exports,m,n=>deps[n]||require(n));return m.exports;}
const workspace=load('lib/economy-workspace.ts'),invoice=load('lib/customer-invoice.ts',{'./economy-workspace':workspace});
const pdf=load('lib/customer-invoice-pdf.ts',{'./receipt-logo':load('lib/receipt-logo.ts'),'./customer-invoice':invoice,'./economy-workspace':workspace});
const base={id:'11111111-1111-4111-8111-111111111111',kind:'private',name:'Testkund',address:'Testvägen 1, Göteborg',serviceDate:'2026-11-11',description:'Testresa A till B',amount:'430,00',rate:'6',days:'30',sellerVat:'SE556597479601',sellerAddress:'Testgatan 1, Göteborg',payment:'Bankgiro 5370-4524'};
(async()=>{for(const kind of ['company','private']){
 const rec=invoice.invoiceInput({...base,kind,org:kind==='company'?'TEST-ORG':''});
 assert.equal(rec.gross_ore,43000);assert.equal(rec.vat_ore,2434);
 const bytes=await pdf.customerInvoicePdf({...rec,issued_on:'2026-11-11',serial_no:1});
 fs.writeFileSync('/tmp/avenyn-invoice-'+kind+'.pdf',bytes);
}
const items=[{service:'passenger',description:'Taxiresa',quantity:'1',amount:'430',rate:'25',vatReason:''},{service:'courier',description:'Budleverans',quantity:'2',amount:'125',rate:'6',vatReason:''}];
 const mixed=invoice.invoiceInput({...base,payment:undefined,amount:undefined,rate:undefined,items});
 assert.equal(mixed.document.payment,'Bankgiro 5370-4524');assert.deepEqual(mixed.document.items.map(i=>i.rate),[6,25]);
 assert.equal(mixed.gross_ore,68000);assert.equal(mixed.vat_ore,7434);
 for(const qty of ['0','1.5','1000'])assert.throws(()=>invoice.priceLines([{...items[0],quantity:qty}]));
 fs.writeFileSync('/tmp/avenyn-invoice-mixed.pdf',await pdf.customerInvoicePdf({...mixed,issued_on:'2026-11-12',serial_no:91}));
for(const patch of [{kind:'company'},{rate:'0'},{days:0},{amount:'-20'},{name:''},{payment:''}])assert.throws(()=>invoice.invoiceInput({...base,...patch}));
assert.equal(invoice.invoiceInput({...base,address:'',amount:'4000'}).document.simplified,true);
assert.throws(()=>invoice.invoiceInput({...base,address:'',amount:'4000.01'}));
assert.throws(()=>invoice.invoiceInput({...base,kind:'company',org:'123',address:''}));
const legacy={serial_no:1,customer_no:1,issued_on:'2026-11-12',gross_ore:70000,vat_ore:3962,document:{...base,days:30,rate:6,address:'ingen',sellerAddress:'Avenyn Taxi',payment:'55655565'}};
fs.writeFileSync('/tmp/avenyn-corrected-example.pdf',await pdf.customerInvoicePdf(legacy,true));
const booking=load('lib/invoice-booking.ts').invoiceBooking({booking_number:179,customer_name:'Testkund',customer_phone:'0700000000',customer_email:'qa@example.invalid',notes:'Flygnummer: SK431',internal_note:'PRIVATE',booking_date:'2026-11-05',pickup_time:'22:30:00',pickup_address:'A',dropoff_address:'B'});
assert.equal(booking.flight,'SK431');assert.equal(booking.time,'22:30');assert(!JSON.stringify(booking).includes('PRIVATE'));
const bookingRow={...legacy,document:{...legacy.document,booking,reference:'B179'}};
fs.writeFileSync('/tmp/av-booking-info.pdf',await pdf.customerInvoicePdf(bookingRow,true));
fs.writeFileSync('/tmp/av-booking-credit.pdf',await pdf.customerInvoicePdf({...bookingRow,creditDate:'2026-11-12'}));
console.log('PASS: private/company invoice validation, VAT rounding, both branded PDFs');
})().catch(e=>{console.error(e);process.exit(1)});
