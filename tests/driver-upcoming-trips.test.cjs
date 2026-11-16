const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const test=require('node:test');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>imports[n],Intl,Date,Map,Number,String});return exports;}
const time=load('lib/prebooking-watch.ts');
const privacy=load('lib/driver-trip-privacy.ts');
const {driverUpcomingTrips}=load('lib/driver-upcoming-trips.ts',{'./prebooking-watch':time,'./driver-trip-privacy':privacy});
const trip={id:'future',status:'accepted',booking_date:'2026-11-03',pickup_time:'11:20:00'};
const pickup=time.pickupAt(trip);
test('future reservation stays compact until exactly 30 minutes before Swedish pickup',()=>{
 assert.equal(driverUpcomingTrips([trip],pickup-1800001).imminentTrip,undefined);
 assert.equal(driverUpcomingTrips([trip],pickup-1800000).imminentTrip.id,'future');
 assert.equal(driverUpcomingTrips([trip],pickup-900000).imminentTrip.id,'future');
});
test('mine is sorted without changing source order and offers stay outside mine',()=>{
 const later={...trip,id:'later',pickup_time:'13:00:00'};
 const rows=[later,{...trip,id:'offer',status:'assigned'},trip];
 const state=driverUpcomingTrips(rows,pickup-86400000);
 assert.equal(state.nextTrip.id,'future');assert.equal(state.myTrips.length,2);assert.equal(rows[0].id,'later');
});
test('departed trip is retained but cannot be treated as a waiting reminder',()=>{
 const state=driverUpcomingTrips([{...trip,status:'en_route'}],pickup);
 assert.equal(state.myTrips.length,1);assert.equal(state.imminentTrip,undefined);assert.equal(state.nextTrip,undefined);
});
