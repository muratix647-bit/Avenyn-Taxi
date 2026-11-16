const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/driver-payment-history.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:m.exports,module:m,Date,Intl,Set,Number});
const period={from:'2026-10-01',to:'2026-10-31'};
const paid={id:'2e9b7877-test',status:'paid',paid_at:'2026-10-08T23:56:30Z',amount_ore:300,payment_channel:'tap_to_pay',reference:'Taxi'};
const rows=m.exports.streetPaymentHistory([paid,paid,{...paid,id:'pending',status:'pending'},{...paid,id:'cancelled',status:'expired'},{...paid,id:'old',paid_at:'2026-09-30T12:00:00Z'},{...paid,id:'boundary',paid_at:'2026-09-30T22:30:00Z'},{...paid,id:'next',paid_at:'2026-10-31T23:30:00Z'}],period);
assert.equal(rows.length,2);assert.equal(rows[0].price,3);assert.equal(rows[0].driver_reported_payment_method,'blipp');assert.equal(rows[0].payment_status,'paid');assert.equal(rows[0].id,'payment:2e9b7877-test');
assert.equal(m.exports.streetPaymentHistory([{...paid,payment_channel:'payment_link'}],period)[0].driver_reported_payment_method,'app');
console.log('Driver payment history: confirmed payments, SEK conversion, duplicate exclusion and Stockholm date boundaries passed.');
