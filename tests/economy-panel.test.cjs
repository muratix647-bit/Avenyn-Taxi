const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const report={summary:{slutforda_korningar:7,registrerade_slutpriser_kr:1060},trips:[{manad:'2026-11-01',slutforda_korningar:7}],payments:[],vat:[],drivers:[],costs:[],exceptions:{saknar_slutpris:2},invoiceCandidates:3};
const code=ts.transpileModule(fs.readFileSync('components/economy-panel.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function setup(values,response){let i=0,callbacks=[],writes=[],calls=[];const m={exports:{}};vm.runInNewContext(code,{exports:m.exports,module:m,Intl,require:n=>['@/components/economy-workspace','@/components/economy-tools'].includes(n)?{default:()=>null}:n==='react'?{...React,useState:()=>{let k=i++;return [values[k],v=>writes.push([k,v])]},useEffect:()=>{},useCallback:f=>{callbacks.push(f);return f}}:require(n)});const element=m.exports.default({supabase:{rpc:async name=>{calls.push(name);return response}}});return {html:renderToStaticMarkup(element),callbacks,writes,calls};}
(async()=>{
for(const tab of ['trips','payments','vat','drivers','costs','invoices','checks']){let t=setup([report,false,'',tab]);assert.match(t.html,/Ekonomi/);assert.match(t.html,/Preliminära kontrollunderlag/);assert.match(t.html,/aria-pressed="true"/);}
assert.match(setup([report,false,'','payments']).html,/Inga registrerade uppgifter/);
let denied=setup([null,false,'Åtkomst nekad','trips'],{data:null,error:{message:'Access denied'}});assert.match(denied.html,/role="alert"/);await denied.callbacks[0]();assert.deepEqual(denied.calls,['avenyn_economy_dashboard']);assert(denied.writes.some(([k,v])=>k===0&&v===null));
let good=setup([null,false,'','trips'],{data:report,error:null});await good.callbacks[0]();assert(good.writes.some(([k,v])=>k===0&&v===report));
let malformed=setup([null,false,'','trips'],{data:[],error:null});await malformed.callbacks[0]();assert(malformed.writes.some(([k,v])=>k===2&&v.includes('Rapporterna kunde inte laddas')));
console.log('PASS: seven report tabs, empty results, RPC success, denied access, invalid payload and alert rendering');
})();
