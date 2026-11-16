const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
function mod(path,deps={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:m.exports,module:m,require:n=>{if(n in deps)return deps[n];throw Error(n)},Response,Request,URL,URLSearchParams,console,Date});return m.exports}
const validation=mod('lib/terminal-payment-validation.ts');
const example={id:'ref',driver_id:'driver1',payment_channel:'tap_to_pay',stripe_payment_intent_id:'pi_real',amount_ore:35000};
const confirmed={id:'pi_real',metadata:{street_payment_id:'ref',driver_id:'driver1'},amount:35000,amount_received:35000,currency:'sek',livemode:true,payment_method_types:['card_present'],status:'succeeded'};
assert.equal(validation.confirmedTerminalPayment(example,confirmed),true);
for(const patch of [{id:'pi_other'},{metadata:{street_payment_id:'ref',driver_id:'other'}},{amount:1},{amount_received:1},{currency:'eur'},{livemode:false},{payment_method_types:['card']},{status:'requires_capture'},{status:'processing'},{status:'canceled'}])assert.equal(validation.confirmedTerminalPayment(example,{...confirmed,...patch}),false);
assert.equal(validation.confirmedTerminalPayment({...example,payment_channel:'payment_link'},confirmed),false);
let auth=true,approved=true,driverId='driver1',records=[],intents=new Map(),creations=0,tokens=0,failSave=false;
const env={};let locations=[{id:'tml_sweden',address:{country:'SE'}}];
function db(){return {from(table){const filters=[];let op='select',payload;const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},is(k,v){filters.push(r=>r[k]===v);return q},neq(k,v){filters.push(r=>r[k]!==v);return q},upsert(p){op='upsert';payload=p;return q},update(p){op='update';payload=p;return q},single(){return Promise.resolve(exec(true))},maybeSingle(){return Promise.resolve(exec(true))},then(resolve,reject){return Promise.resolve(exec(false)).then(resolve,reject)}};
 function exec(single){if(table==='drivers')return {data:approved?{id:driverId,full_name:'Driver'}:null,error:approved?null:Error('no')};if(op==='upsert'){if(!records.some(r=>r.id===payload.id))records.push({...payload,status:'creating',created_at:new Date().toISOString()});return {error:null}}
 const rows=records.filter(r=>filters.every(f=>f(r)));if(op==='update'){if(failSave&&payload.stripe_payment_intent_id){failSave=false;return {error:Error('database timeout')}}rows.forEach(r=>Object.assign(r,payload))}return {data:single?rows[0]:rows,error:null}}
 return q}}}
async function stripe(path,init={}){
 if(path.startsWith('/terminal/locations'))return path.includes('?')?{data:locations}:locations.find(l=>path.endsWith(l.id));
 if(path==='/terminal/connection_tokens'){tokens++;return {secret:'test-token'}}
 if(path==='/payment_intents'){
  const key=init.headers['Idempotency-Key'];if(intents.has(key))return intents.get(key);
  creations++;const p=init.body;const intent={id:'pi_'+creations,metadata:{street_payment_id:p.get('metadata[street_payment_id]'),driver_id:p.get('metadata[driver_id]')},amount:Number(p.get('amount')),currency:p.get('currency'),payment_method_types:[p.get('payment_method_types[]')],livemode:true,status:'requires_payment_method',client_secret:'pi_secret',capture_method:p.get('capture_method')};intents.set(key,intent);return intent;
 }
 const intent=[...intents.values()].find(i=>path.startsWith('/payment_intents/'+i.id));if(!intent)throw Error('missing intent');if(path.endsWith('/cancel'))intent.status='canceled';return intent;
}
const dependencies={'./supabase-server':{adminSupabase:db,requireSupabaseUser:async()=>{if(!auth)throw Error('login');return {user:{id:'user'}}}},'./stripe':{stripeRequest:stripe},'cloudflare:workers':{env},'./terminal-payment-validation':validation};
const terminal=mod('lib/terminal-payments.ts',dependencies);
const route=mod('app/api/payments/terminal/route.ts',{'@/lib/supabase-server':dependencies['./supabase-server'],'@/lib/stripe':dependencies['./stripe'],'@/lib/terminal-payments':terminal,'@/lib/terminal-payment-validation':validation,'@/lib/street-payment-validation':mod('lib/street-payment-validation.ts')});
const payload={action:'create',id:'12345678-1234-4123-8123-123456789abc',amount:'350',reference:''};
const req=(body,method='POST')=>new Request('https://example.com/api/payments/terminal',{method,body:JSON.stringify(body)});
async function post(p=payload){return route.POST(req(p))}
(async()=>{
 auth=false;assert.equal((await post()).status,400);assert.equal(creations,0);assert.equal((await post({action:'connection_token'})).status,400);assert.equal(tokens,0);
 auth=true;approved=false;assert.equal((await post()).status,400);approved=true;
 assert.equal((await post({...payload,amount:'-1'})).status,400);
 locations=[];assert.equal((await post()).status,400);assert.equal(records.length,0,'no orphan attempt without Terminal location');locations=[{id:'tml_sweden',address:{country:'SE'}}];
 failSave=true;assert.equal((await post()).status,400);assert.equal(creations,1);
 assert.equal((await post()).status,200);assert.equal(creations,1,'retry after database outage reuses Stripe idempotency key');
 assert.equal((await post()).status,200);assert.equal(creations,1,'existing attempt reuses intent');
 assert.equal((await post({...payload,amount:'400'})).status,409);
 driverId='other';assert.equal((await post()).status,400);assert.equal(creations,1);assert.equal((await route.DELETE(req({id:payload.id},'DELETE'))).status,409);driverId='driver1';
 const intent=[...intents.values()][0];assert.equal(intent.capture_method,'automatic');
 intent.status='processing';assert.equal((await post()).status,409);assert.equal(records[0].status,'pending');
 intent.status='succeeded';intent.amount_received=34999;await terminal.syncTerminalPayment(records[0]);assert.equal(records[0].status,'pending','partial amount never paid');
 intent.amount_received=35000;intent.latest_charge={created:1700000000,status:'succeeded',amount:35000,receipt_url:'https://pay.stripe.com/receipts/test'};
 const verified=await terminal.syncTerminalPayment(records[0]);assert.equal(verified.status,'paid');assert.equal(verified.paid_at,new Date(1700000000*1000).toISOString());
 const paidResponse=await route.DELETE(req({id:payload.id},'DELETE'));assert.equal((await paidResponse.json()).payment.status,'paid');assert.equal(intent.status,'succeeded','paid attempt cannot be canceled');
 const second={...payload,id:'22345678-1234-4123-8123-123456789abc'};await post(second);assert.equal((await route.DELETE(req({id:second.id},'DELETE'))).status,200);assert.equal(records[1].status,'expired');
 await post(second);assert.equal(creations,2,'canceled attempt never restarts');
 const stale={...payload,id:'32345678-1234-4123-8123-123456789abc'};records.push({...stale,driver_id:'driver1',amount_ore:35000,payment_channel:'tap_to_pay',status:'creating',created_at:new Date(Date.now()-25*3600000).toISOString()});assert.equal((await post(stale)).status,409);assert.equal(creations,2);
 console.log('Tap to Pay: ownership, auth, location, idempotent outage recovery, amount/mode validation, processing, receipt, cancellation and stale-attempt protection passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
