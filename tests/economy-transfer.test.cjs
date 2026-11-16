const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const realReact=require('react');
function load(file){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInThisContext('(function(exports,module,require){'+code+'\n})')(m.exports,m,n=>n==='./economy-workspace'?load('lib/economy-workspace.ts'):require(n));return m.exports;}
const transfer=load('lib/economy-transfer.ts');
function harness(file,dependencies={}){
 const slots=[],effects=[];let cursor=0,pending=[];
 const hooks={useCallback(fn){return fn;},useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(initial){const i=cursor++;return slots[i]??=( {current:initial})},useEffect(fn,deps){const i=cursor++;if(!effects[i]||deps.some((v,j)=>v!==effects[i].deps[j])){pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()}})}}};
 const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInThisContext('(function(exports,module,require){'+code+'\n})')(m.exports,m,n=>n==='react'?{...realReact,...hooks}:dependencies[n]||require(n));
 return {render(props){cursor=0;pending=[];const tree=m.exports.default(props);pending.forEach(f=>f());return tree;}};
}
function nodes(tree,predicate){const out=[];function walk(x){if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(walk);return;}if(predicate(x))out.push(x);walk(x.props?.children)}walk(tree);return out;}
function text(x){if(x==null)return '';if(typeof x==='string'||typeof x==='number')return String(x);if(Array.isArray(x))return x.map(text).join('');return text(x.props?.children)}

(async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const calculation={bruttolon_kr:29654,skatteavdrag_kr:5654,arbetsgivaravgift_kr:9317.29,nettolon_kr:24000,skattetabell:32,kolumn:1,skattear:2026};
 assert.deepEqual(transfer.payrollTransfer(calculation,id,'2026-11-25'),{driverId:id,paymentDate:'2026-11-25',gross:'29654.00',tax:'5654.00',employerFee:'9317.29',taxBasis:'Preliminärt tabellförslag 2026, tabell 32, kolumn 1. Kontrollera mot skattebeslut.'});
 for(const invalid of [{...calculation,skatteavdrag_kr:null},{...calculation,nettolon_kr:20},{...calculation,arbetsgivaravgift_kr:NaN}])assert.throws(()=>transfer.payrollTransfer(invalid,id,'2026-11-25'));
 assert.throws(()=>transfer.payrollTransfer(calculation,'','2026-11-25'));
 let received=[],calls=[];
 const sb={rpc:async(name,args)=>{calls.push(name);return{data:name==='avenyn_ekonomi_skatte_checklista'?null:calculation}}};
 const h=harness('components/economy-automation-panel.tsx',{'@/lib/economy-transfer':transfer});
 const props={supabase:sb,drivers:[{id,full_name:'Testförare'}],onPayroll:v=>received.push(v)};
 let tree;const render=()=>tree=h.render(props);const button=label=>nodes(tree,n=>n.type==='button'&&text(n).includes(label))[0];
 render();let selects=nodes(tree,n=>n.type==='select');selects[1].props.onChange({target:{value:id}});render();
 const numberFields=nodes(tree,n=>typeof n.type==='function'&&n.props.title);numberFields[0].props.onChange('24000');numberFields[1].props.onChange('1990');numberFields[2].props.onChange('32');
 nodes(tree,n=>n.type==='input'&&n.props.type==='date')[0].props.onChange({target:{value:'2026-11-25'}});render();render();
 button('Beräkna löneförslag').props.onClick();await new Promise(r=>setTimeout(r,0));render();
 button('Använd i löneutkast').props.onClick();render();assert.equal(received.length,1);assert.equal(received[0].employerFee,'9317.29');assert.equal(button('Överfört till löneutkast').props.disabled,true);
 const sf=new File(['%PDF-1.4 test'],'test.pdf',{type:'application/pdf'});let receipts=[];
 const hr=harness('components/economy-receipt-ocr-panel.tsx',{'./receipt-ocr-parser':{parseSwedishReceipt:()=>({})}});
 const rp={supabase:{rpc:async()=>({data:{beraknad_moms_ore:2500,mojliga_dubbletter:0,bas_konto_forslag:'6110',kontotext:'Kontorsmaterial'}})},onReceipt:v=>receipts.push(v)};
 const rr=()=>tree=hr.render(rp);rr();nodes(tree,n=>n.type==='input'&&n.props.type==='file')[0].props.onChange({target:{files:[sf]}});rr();
 nodes(tree,n=>n.type==='input'&&n.props.maxLength===160)[0].props.onChange({target:{value:'Testbutik'}});
 nodes(tree,n=>n.type==='input'&&n.props.type==='date')[0].props.onChange({target:{value:'2026-11-05'}});
 nodes(tree,n=>n.type==='input'&&n.props.inputMode==='decimal')[0].props.onChange({target:{value:'125'}});rr();rr();
 button('Föreslå moms').props.onClick();await new Promise(r=>setTimeout(r,0));rr();assert.equal(button('Överför till').props.disabled,true);
 nodes(tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}});rr();button('Överför till').props.onClick();rr();assert.equal(receipts.length,1);assert.equal(receipts[0].file,sf);assert.equal(receipts[0].vat,'25.00');assert.equal(receipts[0].amount,'125.00');assert.equal(button('Överför till').props.disabled,true);
 const Tools=()=>null;
 const hw=harness('components/economy-workspace.tsx',{'@/lib/economy-transfer':transfer,'./economy-automation-panel':{default:()=>null},'./economy-tools':{default:Tools},'@/lib/economy-workspace':load('lib/economy-workspace.ts')});
 let writes=[];global.fetch=async(url,init={})=>{if(init.method)writes.push({url,init});return new Response(JSON.stringify({rows:[],paid:[]}),{status:200,headers:{'Content-Type':'application/json'}})};
 const wp={supabase:{auth:{getSession:async()=>({data:{session:{access_token:'fake'}}})}},drivers:[{id,name:'Testförare'}]};
 const wr=()=>tree=hw.render(wp);wr();await new Promise(r=>setTimeout(r,0));wr();
 let tools=nodes(tree,n=>n.type===Tools)[0];tools.props.onPayroll(transfer.payrollTransfer(calculation,id,'2026-11-25'));wr();
 assert.equal(nodes(tree,n=>n.type===Tools)[0].props.transferBlocked,true);
 const payForm=nodes(tree,n=>n.type==='form')[0];await payForm.props.onSubmit({preventDefault(){}});wr();
 const saved=JSON.parse(writes[0].init.body);assert.equal(saved.gross,'29654.00');assert.equal(saved.tax,'5654.00');assert.equal(saved.employerFee,'9317.29');assert.equal(saved.period,'2026-11');assert.equal(saved.benefits,'0');assert.equal(saved.reimbursement,'0');assert.equal(saved.driver_id,id);
 tools=nodes(tree,n=>n.type===Tools)[0];tools.props.onReceipt(receipts[0]);wr();
 assert.equal(nodes(tree,n=>n.type==='input'&&n.props.type==='file')[0].props.required,false);
 await nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});wr();
 const receiptWrite=writes[1].init.body;assert.equal(receiptWrite.get('amount'),'125.00');assert.equal(receiptWrite.get('vat'),'25.00');assert.equal(receiptWrite.get('deductibleVat'),'0');assert.equal(receiptWrite.get('file').name,'test.pdf');
 // Check that a profile calculation fills the draft, and that stale results cannot restore an old amount.
 let resolveProfile;const autoRpc=[];
 wp.supabase.rpc=async(name,args)=>{autoRpc.push({name,args});return await new Promise(done=>{resolveProfile=done;});};
 nodes(tree,n=>n.type==='button'&&text(n)==='Löner')[0].props.onClick();wr();
 nodes(tree,n=>n.type==='button'&&text(n).includes('Ny lön för'))[0].props.onClick();wr();
 let dateField=nodes(tree,n=>n.props.name==='payment_date'&&typeof n.props.setForm==='function')[0];
 dateField.props.setForm({...dateField.props.form,driver_id:id,payment_date:'2026-11-25',gross:'29654'});wr();
 await new Promise(r=>setTimeout(r,500));assert.equal(autoRpc.at(-1).name,'avenyn_ekonomi_forare_loneforslag_2026');
 resolveProfile({data:calculation});await new Promise(r=>setTimeout(r,0));wr();
 dateField=nodes(tree,n=>n.props.name==='payment_date'&&typeof n.props.setForm==='function')[0];
 assert.equal(dateField.props.form.tax,'5654.00');assert.equal(dateField.props.form.employerFee,'9317.29');
 dateField.props.setForm({...dateField.props.form,gross:'25000'});wr();wr();
 assert.equal(nodes(tree,n=>n.type==='button'&&text(n)==='Spara utkast')[0].props.disabled,true);
 console.log('PASS: salary transfer, invalid/incomplete result rejection, original receipt transfer, review required, repeat transfer locked');
})().catch(e=>{console.error(e);process.exit(1)});
