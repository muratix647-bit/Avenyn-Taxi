const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
function load(path,deps={},fetchImpl){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,require:k=>deps[k],Response,Request,URL,Date,Number,Promise,AbortSignal,fetch:fetchImpl,console});return m.exports;}
(async()=>{
let calls=0,allowed=false;
const road=load('lib/trip-road-route.ts',{},async()=>{calls++;return Response.json({code:'Ok',routes:[{distance:1000,duration:120,geometry:{coordinates:[[11.9,57.7],[12,57.8]]}}]})});
assert.equal((await road.roadRoute([[null,null],[12,57.8]])).state,'missing_coordinates');assert.equal(calls,0);
const api=load('app/api/track/[token]/route-preview/route.ts',{'@/lib/trip-road-route':road,'../route':{GET:async()=>allowed?Response.json({pickup_lat:57.7,pickup_lng:11.9,destination_lat:57.8,destination_lng:12}):Response.json({error:'missing'},{status:404})}});
const request=new Request('https://test/route-preview'),context={params:Promise.resolve({token:'test'})};
assert.equal((await api.GET(request,context)).status,404);assert.equal(calls,0);
allowed=true;const result=await(await api.GET(request,context)).json();assert.equal(result.state,'ready');assert.deepEqual(result.path,[[57.7,11.9],[57.8,12]]);assert.equal(result.minutes,2);
await api.GET(request,context);assert.equal(calls,1);
let points;let driverStatus='accepted';const driver=load('app/api/driver-trips/route-preview/route.ts',{'@/lib/trip-road-route':{roadRoute:async p=>{points=p;return {state:'ready',path:[]}}},'@/lib/supabase-server':{requireSupabaseUser:async()=>({supabase:{rpc:async()=>({data:[{id:'own',status:driverStatus,pickup_lat:57.7,pickup_lng:11.9,dropoff_lat:57.8,dropoff_lng:12}]})}})}});
await driver.GET(new Request('https://test/route-preview?bookingId=own&phase=pickup&originLat=57.6&originLng=11.8'));assert.equal(JSON.stringify(points),JSON.stringify([[11.8,57.6],[11.9,57.7]]));
await driver.GET(new Request('https://test/route-preview?bookingId=own'));assert.equal(JSON.stringify(points),JSON.stringify([[11.9,57.7],[12,57.8]]));
driverStatus='passenger_onboard';await driver.GET(new Request('https://test/route-preview?bookingId=own&phase=destination&originLat=57.75&originLng=11.95'));assert.equal(JSON.stringify(points),JSON.stringify([[11.95,57.75],[12,57.8]]));
console.log('Customer route: tracking access enforced, missing coordinates rejected, A–B road geometry and cache passed');
})().catch(e=>{console.error(e);process.exitCode=1});
