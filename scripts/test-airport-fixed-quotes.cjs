const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');let zoneQuote=null,routeCalls=0,failRoute=false;
const settings={instant_start_fee:60,prebooked_start_fee:50,price_per_km:18,instant_price_per_hour:500,prebooked_price_per_hour:720,child_seat_surcharge:100,large_vehicle_surcharge:300};
const db={from(table){const result={data:table==='price_zones'?[]:settings,error:null};return {select(){return this},eq(){return this},maybeSingle:async()=>result,then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}}},rpc:async()=>({data:[zoneQuote||{total_price:null,reason:'manual_quote_required'}],error:null})};
const cache={};function load(file){if(cache[file])return cache[file];const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(name=>{
 if(name==='./supabase-server')return {publicSupabase:()=>db};
 if(name==='./reverse-area')return {reverseAreaHierarchy:async()=>({values:[]})};
 if(name==='./dynamic-pricing-server')return {applyDynamicPrice:async(input,quote)=>quote};
 return load('lib/'+name.slice(2)+'.ts');
},module,module.exports);return cache[file]=module.exports;}
global.fetch=async(url)=>{routeCalls++;if(failRoute)throw Error('route_unavailable');return Response.json({routes:[{distance:url.includes(';11.8,57.6;')?55000:50000,duration:2400}]});};
(async()=>{
 const {quoteTrip}=load('lib/quote-server.ts');
 const input={pickupAddress:'Adress utanför zon',dropoffAddress:'Landvetter Airport',pickupLat:57.6,pickupLng:11.7,dropoffLat:57.6688,dropoffLng:12.2923,dropoffPlaceId:'se-got-landvetter-airport',pickupTime:'now'};
 let q=await quoteTrip(input);assert.equal(q.reason,'calculated_fixed_landvetter');assert.equal(q.total_price,1293); // 60 + 50*18 + 40*500/60
 q=await quoteTrip({...input,pickupAddress:input.dropoffAddress,dropoffAddress:input.pickupAddress,pickupLat:input.dropoffLat,pickupLng:input.dropoffLng,dropoffLat:input.pickupLat,dropoffLng:input.pickupLng,pickupPlaceId:input.dropoffPlaceId,dropoffPlaceId:null});assert.equal(q.reason,'calculated_fixed_landvetter');assert.equal(q.total_price,1293);
 q=await quoteTrip({...input,pickupTime:'2099-10-10T12:00',carType:'large',childSeats:1});assert.equal(q.total_price,1830); // 50 + 900 + 480 + 300 + 100
 q=await quoteTrip({...input,stopAddress:'Stopp',stopLng:11.8,stopLat:57.6});assert.equal(q.total_price,1468);assert.equal(q.stop_surcharge,175);
 zoneQuote={zone_code:'tynnered',zone_name:'Tynnered',base_price:595,total_price:595,reason:'fixed_landvetter'};routeCalls=0;
 q=await quoteTrip(input);assert.equal(q.total_price,595);assert.equal(q.reason,'fixed_landvetter');assert.equal(routeCalls,0);
 zoneQuote=null;failRoute=true;q=await quoteTrip(input);assert.equal(q.reason,'calculated_fixed_landvetter');assert.equal(q.route_estimated,true);assert.ok(q.total_price>0);
 q=await quoteTrip({...input,pickupLat:null});assert.equal(q.total_price,null);
 console.log('PASS: outside-zone fixed price, both directions, prebooking, extras, stop, zone precedence, route outage, missing coordinates. Simulated providers; configured tariff fixture.');
})().catch(e=>{console.error(e);process.exitCode=1});
