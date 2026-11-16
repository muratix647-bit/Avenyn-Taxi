const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={},extras={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:m,exports:m.exports,require:n=>deps[n]||require(n),Date,Intl,Number,String,encodeURIComponent,console,...extras});return m.exports;}
const timing=load('lib/prebooking-watch.ts'),policy=load('lib/driver-reminder-policy.ts',{'./prebooking-watch':timing});
const base={id:'booking-1',driver_id:'driver-1',booking_number:123,status:'accepted',booking_date:'2026-10-27',pickup_time:'12:00:00',pickup_address:'Testplats'};
const pickup=timing.pickupAt(base);
test('reminders respect Swedish time and exact 30/15 minute boundaries',()=>{
 assert.equal(pickup,Date.parse('2026-10-27T11:00:00Z'));
 for(const [minutes,stage] of [[31,null],[30,30],[15.01,30],[15,15],[1,15],[-1,null]])assert.equal(policy.driverReminderStage(base,pickup-minutes*60000),stage);
 assert.equal(policy.driverReminderStage({...base,pickup_time:'invalid'},pickup),null);
 assert.equal(timing.pickupAt({...base,booking_date:'2026-07-01'}),Date.parse('2026-07-01T10:00:00Z'));
 const payload=policy.driverReminderPayload(base,15,pickup-5*60000);assert.equal(payload.ttl,300);assert.match(payload.body,/12:00/);assert.match(payload.url,/booking=booking-1/);
});
test('no reminders for unaccepted, departed, arrived, onboard, completed, cancelled, archived or unassigned bookings',()=>{
 for(const status of ['assigned','offered','new','en_route','arrived','passenger_onboard','completed','cancelled'])assert.equal(policy.driverReminderStage({...base,status},pickup-10*60000),null);
 assert.equal(policy.driverReminderStage({...base,archived_at:'now'},pickup-10*60000),null);
 assert.equal(policy.driverReminderStage({...base,driver_id:null},pickup-10*60000),null);
});
function fixture({latest=base,fail=false}={}){
 const ledger=new Map(),sent=[];let row={...base};
 class Clock extends Date{static now(){return pickup-20*60000;}}
 const db={from(table){let mode='read',value,id;const q={select(){return q},eq(k,v){if(k==='id')id=v;return q},is(){return q},not(){return q},gte(){return q},lte(){return q},insert(v){mode='insert';value=v;return q},update(v){mode='update';value=v;return q},single(){if(table==='bookings')return Promise.resolve({data:latest});const key=[value.booking_id,value.driver_id,value.pickup_at,value.stage].join(':');if(ledger.has(key))return Promise.resolve({error:{code:'23505'}});const entry={...value,id:String(ledger.size+1)};ledger.set(key,entry);return Promise.resolve({data:entry});},then(resolve,reject){if(mode==='update'){Object.assign([...ledger.values()].find(e=>e.id===id),value);return Promise.resolve({error:null}).then(resolve,reject)}return Promise.resolve({data:[row]}).then(resolve,reject)}};return q;}};
 const module=load('lib/driver-reminder-monitor.ts',{'./supabase-server':{adminSupabase:()=>db},'./prebooking-watch':timing,'./driver-reminder-policy':load('lib/driver-reminder-policy.ts',{'./prebooking-watch':timing},{Date:Clock}),'./push':{sendDriverReminderPush:async(driver,payload)=>{sent.push({driver,payload});if(fail)throw Error('ambiguous timeout');return {sent:1}}}},{Date:Clock,console:{error(){}}});
 return {...module,ledger,sent,setRow:b=>row=b};
}
test('concurrent monitor runs claim one delivery; dry run makes no changes',async()=>{
 const f=fixture();await f.runDriverReminders(true);assert.equal(f.ledger.size,0);assert.equal(f.sent.length,0);
 await Promise.all([f.runDriverReminders(),f.runDriverReminders()]);assert.equal(f.sent.length,1);assert.equal([...f.ledger.values()][0].state,'sent');
});
test('departure, cancellation, reassignment or rescheduling after claim cancels delivery',async()=>{
 for(const latest of [{...base,status:'en_route'},{...base,status:'cancelled'},{...base,driver_id:'driver-2'},{...base,pickup_time:'13:00:00'}]){
  const f=fixture({latest});await f.runDriverReminders();assert.equal(f.sent.length,0);assert.equal([...f.ledger.values()][0].state,'cancelled');
 }
});
test('ambiguous delivery is not sent again on the next run',async()=>{
 const f=fixture({fail:true});await f.runDriverReminders();await f.runDriverReminders();assert.equal(f.sent.length,1);assert.equal([...f.ledger.values()][0].state,'failed');
});
const journey=load('lib/driver-journey.ts');
test('acceptance never selects navigation, including refresh and accepting another job',()=>{
 const accepted={id:'future',status:'accepted'},active={id:'now',status:'en_route'};
 assert.equal(journey.driverMapTrip([accepted],null),undefined);
 assert.equal(journey.journeyStarted(accepted),false);
 assert.equal(journey.driverMapTrip([accepted,active],null).id,'now');
 assert.equal(journey.driverMapTrip([accepted,active],'future').id,'now');
 assert.equal(journey.driverMapTrip([accepted],'future').id,'future','explicit preview is allowed');
 for(const status of ['en_route','arrived','passenger_onboard'])assert.equal(journey.journeyStarted({status}),true);
 assert.equal(journey.driverMapTrip([{id:'offer',status:'offered'},active],null).id,'offer');
});
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const privacy=load('lib/driver-trip-privacy.ts');
const mapProps=[];
const work=load('components/driver-work-map.tsx',{
 './customer-trip-map':{default:p=>{mapProps.push(p);return React.createElement('div',null,'Map')}},
 './driver-idle-map':{default:()=>React.createElement('div',null,'Idle map')},
 './driver-embedded-navigation':{default:()=>null},
 './driver-trip-offer':{default:()=>null},
 '@/lib/driver-journey':journey,'@/lib/driver-trip-privacy':privacy,
 './app-language':{AppText:({text})=>React.createElement('span',null,text)}
});
test('accepted route preview has no follow mode or driving estimate; departure enables both',()=>{
 const props={accessToken:'test',online:true,revenue:0,onAccept(){},onReject(){},onToggle(){},onHistory(){},onPayments(){},onMore(){}};
 const trip={id:'one',status:'accepted',pickup_lat:57.7,pickup_lng:11.9,dropoff_lat:57.8,dropoff_lng:12};
 const before=renderToStaticMarkup(React.createElement(work.default,{...props,trip}));
 assert.ok(before.includes('Idle map'));assert.ok(!before.includes('hasDrivingTrip'));assert.ok(!before.includes('driverWebEstimate'));
 const after=renderToStaticMarkup(React.createElement(work.default,{...props,navigationPhase:'pickup',trip:{...trip,status:'en_route'}}));
 assert.equal(mapProps.at(-1).followDriver,true);assert.ok(after.includes('hasDrivingTrip'));assert.ok(after.includes('driverWebEstimate'));
});
const activeCard=load('components/driver-active-trip.tsx',{'@/components/driver-trip-timing':{default:()=>React.createElement('div',null,'PICKUP_TIME')},'@/components/app-language':{AppText:({text})=>React.createElement('span',null,text)},'@/components/driver-flight-card':{default:()=>null},'@/lib/pets':{petText:()=>''}});
test('accepted card places START immediately after time and keeps secondary actions in details',()=>{
 const html=renderToStaticMarkup(React.createElement(activeCard.default,{trip:{...base,pickup:'PICKUP_ADDRESS',destination:'DESTINATION_ADDRESS',price:400},accessToken:'test',busy:false,onStatus(){},onUndo(){},onComplete(){},onNavigate(){},onPayment(){},onRoute(){}}));
 assert.ok(html.indexOf('PICKUP_TIME')<html.indexOf('START'));
 assert.ok(html.indexOf('START')<html.indexOf('PICKUP_ADDRESS'));
 assert.ok(html.indexOf('<details')<html.indexOf('Ångra senaste status'));
 assert.equal((html.match(/>START</g)||[]).length,1);
 assert.ok(!html.includes('Google Maps'));
});

const choice=load('lib/driver-navigation-choice.ts',{'./driver-journey':journey});
test('driver may open either destination, close navigation and reopen without changing status',()=>{
 const t={id:'one',status:'accepted'};
 assert.equal(choice.selectedNavigationPhase(t,null),null);
 assert.equal(choice.selectedNavigationPhase(t,{tripId:'one',phase:'pickup',open:true}),'pickup');
 assert.equal(choice.selectedNavigationPhase(t,{tripId:'one',phase:'destination',open:true}),'destination');
 assert.equal(choice.selectedNavigationPhase({...t,status:'en_route'},{tripId:'one',phase:'pickup',open:false}),null);
 assert.equal(choice.selectedNavigationPhase({...t,status:'passenger_onboard'},{tripId:'one',phase:'pickup',open:true}),'pickup');
 assert.equal(choice.selectedNavigationPhase({...t,status:'offered'},{tripId:'one',phase:'destination',open:true}),null);
 assert.equal(choice.selectedNavigationPhase({id:'other',status:'en_route'},{tripId:'one',phase:'pickup',open:false}),null);
 assert.equal(t.status,'accepted');
});
