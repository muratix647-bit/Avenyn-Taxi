const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const realReact=require('react');
function harness(file,dependencies={}){
 const slots=[],effects=[];let cursor=0,pending=[];
 const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(initial){const i=cursor++;return slots[i]??=( {current:initial})},useEffect(fn,deps){const i=cursor++;if(!effects[i]||deps.some((v,j)=>v!==effects[i].deps[j])){pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()}})}}};
 const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInThisContext('(function(exports,module,require){'+code+'\n})')(m.exports,m,n=>n==='react'?{...realReact,...hooks}:dependencies[n]||require(n));
 return {render(props){cursor=0;pending=[];const tree=m.exports.default(props);pending.forEach(f=>f());return tree;}};
}
function nodes(tree,predicate){const out=[];function walk(x){if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(walk);return;}if(predicate(x))out.push(x);walk(x.props?.children)}walk(tree);return out;}
function text(x){if(x==null)return '';if(typeof x==='string'||typeof x==='number')return String(x);if(Array.isArray(x))return x.map(text).join('');return text(x.props?.children)}
(async()=>{
 let calls=[],uploads=[],fail=false;
 const sb={rpc:async(name,args)=>{calls.push({name,args});if(name.endsWith('kontroll'))return{data:{mojliga_dubbletter:0,beraknad_moms_ore:2500}};if(name.endsWith('spara_utkast'))return fail?{error:new Error('Network')}:{data:{status:'UTKAST'}};return{data:[]}},storage:{from(bucket){assert.equal(bucket,'economy-receipts');return{upload:async(path,file,opts)=>{uploads.push({path,file,opts});return{};}}}}};
 const h=harness('components/economy-receipt-ocr-panel.tsx',{'./receipt-ocr-parser':{parseSwedishReceipt:()=>({supplier:'Butik',expenseDate:'2026-11-05',totalOre:12500,vatRate:25,category:'okand',notices:[]})},'tesseract.js':{createWorker:async()=>({recognize:async()=>({data:{text:'fake'}}),terminate:async()=>{}})}});
 let tree;const render=()=>{tree=h.render({supabase:sb});return tree};const button=label=>nodes(tree,n=>n.type==='button'&&text(n).includes(label))[0];
 render();nodes(tree,n=>n.type==='input'&&n.props.type==='file')[0].props.onChange({target:{files:[new File(['test'],'test.png',{type:'image/png'})]}});render();await button('Läs kvitto automatiskt').props.onClick();await new Promise(r=>setTimeout(r,0));render();render();
 assert.equal(nodes(tree,n=>n.type==='input'&&n.props.maxLength===160)[0].props.value,'Butik');
 await button('Föreslå moms').props.onClick();await new Promise(r=>setTimeout(r,0));render();
 let save=button('Spara original');assert.equal(save.props.disabled,true);
 nodes(tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}});render();assert.equal(button('Spara original').props.disabled,false);
 nodes(tree,n=>n.type==='input'&&n.props.inputMode==='decimal')[0].props.onChange({target:{value:'250'}});render();render();assert.equal(button('Spara original'),undefined);
 await button('Föreslå moms').props.onClick();await new Promise(r=>setTimeout(r,0));render();assert.equal(button('Spara original').props.disabled,true);
 nodes(tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}});render();fail=true;
 await button('Spara original').props.onClick();await new Promise(r=>setTimeout(r,0));render();assert.equal(uploads.length,1);assert.equal(uploads[0].opts.upsert,false);assert.equal(button('Spara original').props.disabled,true);
 assert.ok(nodes(tree,n=>n.props?.role==='alert').some(n=>text(n).includes('kunde inte bekräftas')));
 assert.equal(calls.find(c=>c.name.endsWith('spara_utkast')).args.p_amount_ore,25000);
 console.log('PASS: OCR fill, confirmation required, changed inputs invalidate preview, private upload, ambiguous save locks retry');
})().catch(e=>{console.error(e);process.exit(1)});
