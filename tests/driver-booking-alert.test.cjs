const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=ts.transpileModule(fs.readFileSync('components/booking-alert.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function render(bookings){
 const intervals=[],timeouts=[],cleanups=[];
 const react={useState:v=>[v===false?true:v,()=>{}],useRef:v=>({current:v}),useEffect:fn=>{const cleanup=fn();if(cleanup)cleanups.push(cleanup)}};
 const m={exports:{}};
 vm.runInNewContext(code,{module:m,exports:m.exports,require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:name.includes('use-booking-alarm')?{useBookingAlarm:()=>({wanted:true,ready:true,audio:{current:null},activate:()=>{},disable:()=>{}})}:name.includes('driver-alarm-volume')?{alarmVolume:()=>70,DRIVER_ALARM_VOLUME_KEY:'volume'}:{default:()=>null},document:{addEventListener:()=>{},removeEventListener:()=>{}},window:{addEventListener:()=>{},removeEventListener:()=>{}},localStorage:{getItem:()=> '[]',setItem:()=>{}},setInterval:(fn,ms)=>{const t={fn,ms,cleared:false};intervals.push(t);return t},clearInterval:t=>{t.cleared=true},setTimeout:(fn,ms)=>{timeouts.push(ms);return 1},clearTimeout:()=>{}});
 const tree=m.exports.default({bookings,owner:'test',driver:true,onOpen:()=>{}});
 return {tree,intervals,timeouts,cleanup:()=>cleanups.forEach(fn=>fn())};
}
const active=render([{id:'available'}]);
assert.match(active.tree.props.className,/hasUnseenBookings/);
assert.equal(active.intervals.filter(t=>t.ms===3000).length,1);assert.equal(active.intervals[0].ms,3000);
assert.deepEqual(active.timeouts,[],'No one-minute timeout for pending prebookings');
active.tree.props.children[0].props.children[0].props.onClick();
assert.equal(active.intervals[0].cleared,false,'Opening prebookings must not silence the alarm');
active.cleanup();assert.equal(active.intervals[0].cleared,true);
const claimed=render([]);
assert.doesNotMatch(claimed.tree.props.className,/hasUnseenBookings/);
assert.equal(claimed.intervals.filter(t=>t.ms===3000).length,0,'Accepted/removed pool entries stop alarming');
console.log('Driver alarm: persists without timeout, opening does not silence, removal stops alarm');
