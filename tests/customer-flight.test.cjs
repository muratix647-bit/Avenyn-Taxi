const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
function load(path,deps={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,require:k=>deps[k],Response,Request,URL,Date,console});return m.exports;}
(async()=>{
 const util=load('lib/customer-flight.ts');
 assert.equal(util.replaceFlightNumber('Flygnummer: SK140 · Extra stopp: Centrum · Ring vid porten','FR1234'),'Flygnummer: FR1234 · Extra stopp: Centrum · Ring vid porten');
 assert.equal(util.replaceFlightNumber('Flygnummer: SK140',''),null);
 let filters=[],written=null,found={id:'own',status:'scheduled',notes:'Flygnummer: SK140 · Ring vid porten',updated_at:'v1'},conflict=false,monitored=0;
 const db={from:()=>{let updating=false;const q={select(){return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},in(k,v){filters.push([k,v]);return q},update(v){updating=true;written=v;return q},async maybeSingle(){return {data:updating?(conflict?null:{...found,...written}):found,error:null}}};return q;}};
 const api=load('app/api/track/[token]/flight/route.ts',{'@/lib/supabase-server':{adminSupabase:()=>db},'@/lib/flight-monitor':{flightNumberFromNotes:n=>String(n).match(/Flygnummer: (\w+)/)?.[1]||null,upsertFlightMonitorForBooking:async()=>monitored++},'@/lib/customer-flight':util});
 const token='11111111-1111-4111-8111-111111111111',ctx={params:Promise.resolve({token})};
 const req=(body,origin='https://test')=>new Request('https://test/api/track/'+token+'/flight',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await api.POST(req({flightNumber:'FR1234',previous:'SK140'},'https://other'),ctx)).status,403);assert.equal(filters.length,0);
 assert.equal((await api.POST(req({flightNumber:'??'}),ctx)).status,400);
 assert.equal((await api.POST(req({flightNumber:'FR1234',previous:'old'}),ctx)).status,409);assert.equal(written,null);
 assert.equal((await api.POST(req({flightNumber:'FR1234',previous:'SK140'}),ctx)).status,200);assert.equal(written.notes,'Flygnummer: FR1234 · Ring vid porten');assert.equal(monitored,1);assert(filters.some(([k,v])=>k==='tracking_token'&&v===token));assert(filters.some(([k,v])=>k==='updated_at'&&v==='v1'));
 conflict=true;assert.equal((await api.POST(req({flightNumber:'FR1234',previous:'SK140'}),ctx)).status,409);conflict=false;
 found.status='completed';assert.equal((await api.POST(req({flightNumber:'FR1234',previous:'SK140'}),ctx)).status,409);
 found=null;assert.equal((await api.POST(req({flightNumber:'FR1234',previous:'SK140'}),ctx)).status,404);
 console.log('Passed: flight validation, token scope, cross-origin rejection, concurrency, closed/missing bookings and preservation of notes.');
})().catch(e=>{console.error(e);process.exitCode=1});
