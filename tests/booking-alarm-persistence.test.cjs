const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=ts.transpileModule(fs.readFileSync('lib/use-booking-alarm.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const storage=new Map();
function mount(owner,driver=false,blocked=false){
 const states=[],effects=[],listeners=new Map();let index=0;const contexts=[];
 class AudioContext {constructor(){this.state='suspended';contexts.push(this)}resume(){if(!blocked){this.state='running';this.onstatechange?.()}return Promise.resolve()}suspend(){this.state='suspended';this.onstatechange?.();return Promise.resolve()}close(){this.state='closed';return Promise.resolve()}}
 const events={addEventListener:(n,f)=>{const a=listeners.get(n)||[];a.push(f);listeners.set(n,a)},removeEventListener:(n,f)=>listeners.set(n,(listeners.get(n)||[]).filter(x=>x!==f)),dispatchEvent:e=>(listeners.get(e.type)||[]).forEach(f=>f())};
 const m={exports:{}};vm.runInNewContext(code,{module:m,exports:m.exports,AudioContext,Event:class{constructor(type){this.type=type}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},window:events,document:{...events,visibilityState:'visible'},require:()=>({useState:v=>{const i=index++;states[i]=v;return [v,n=>states[i]=n]},useRef:v=>({current:v}),useEffect:f=>effects.push(f)})});
 const result=m.exports.useBookingAlarm(owner,driver);const clean=effects.map(f=>f());
 return {result,states,contexts,gesture:()=>events.dispatchEvent({type:'pointerdown'}),unmount:()=>clean.forEach(f=>f?.())};
}
const first=mount('admin');first.result.activate();assert.equal(storage.get('avenyn-booking-alarm:v1:dispatch:admin'),'on');first.unmount();
const reload=mount('admin');assert.equal(reload.states[0],true);assert.equal(reload.states[1],true);reload.unmount();
const locked=mount('admin',false,true);assert.equal(locked.states[0],true,'Saved preference remains on');assert.equal(locked.states[1],false,'Blocked audio must never be shown as ready');locked.unmount();
const driver=mount('driver',true);assert.equal(driver.states[0],false,'Separate account and role');driver.result.activate();driver.unmount();const driverReload=mount('driver',true);assert.equal(driverReload.states[0],true);driverReload.unmount();
const off=mount('admin');off.result.disable();off.gesture();assert.equal(off.states[0],false);assert.equal(off.states[1],false);off.unmount();const offReload=mount('admin');assert.equal(offReload.states[0],false);assert.equal(offReload.contexts.length,0,'Off stays off without starting audio');offReload.unmount();
console.log('PASS: admin/driver reload, saved off, blocked audio truthful, account isolation');
