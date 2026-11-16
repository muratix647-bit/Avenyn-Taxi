const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
function load(path,deps={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,require:k=>deps[k],Response,Request,URL,Date,Number,Promise,TextEncoder,console});return m.exports;}
const pets=load('lib/pets.ts');
const options=[{id:'dog',label:'Hund',archived_at:null},{id:'cat',label:'Katt',archived_at:'2026-10-10'}];let isAdmin=false,updated=null,auth=true;
const db={from(table){let id=null,active=false;const q={select(){return q},eq(k,v){if(k==='id')id=v;return q},is(){active=true;return q},order(){return q},single:async()=>({data:{id:'own-driver',accepts_pets:false}}),maybeSingle:async()=>({data:options.find(x=>x.id===id)||null}),update(value){updated={table,value};return q},upsert(value){updated={table,value};return q},then(resolve){resolve({data:options.filter(x=>!active||!x.archived_at),error:null})}};return q}};
const route=load('app/api/pets/route.ts',{'@/lib/supabase-server':{adminSupabase:()=>db,requireSupabaseUser:async()=>{if(!auth)throw Error('Login required');return{user:{id:'own-user'},supabase:{rpc:async()=>({data:isAdmin})}}}}});
const req=(body)=>new Request('https://test/api/pets',{method:'POST',body:JSON.stringify(body)});
(async()=>{
 assert.equal(pets.normalizePet(null),null);assert.throws(()=>pets.normalizePet({id:'dog',count:6}));assert.throws(()=>pets.normalizePet({id:'../dog',count:1}));
 const valid=await pets.validatePet(db,{id:'dog',count:2,label:'forged price surcharge'});assert.equal(valid.label,'Hund');assert.equal(valid.count,2);assert.equal(Object.keys(valid).length,3);
 await assert.rejects(()=>pets.validatePet(db,{id:'cat',count:1}));assert.equal((await pets.validatePet(db,{id:'cat',count:1},{id:'cat',label:'Katt'})).label,'Katt');
 const publicList=await (await route.GET(new Request('https://test/api/pets'))).json();assert.equal(publicList.options.length,1);
 assert.equal((await route.POST(req({id:'dog',label:'new',action:'save'}))).status,403);assert.equal(updated,null);
 isAdmin=true;assert.equal((await route.POST(req({id:'dog',label:'new',action:'save'}))).status,200);assert.equal(updated.value.label,'new');
 assert.equal((await route.POST(req({id:'dog',action:'archive'}))).status,200);assert.ok(updated.value.archived_at);assert.equal((await route.POST(req({id:'dog',action:'restore'}))).status,200);assert.equal(updated.value.archived_at,null);
 assert.equal((await route.POST(req({action:'preference',acceptsPets:'true'}))).status,400);assert.equal((await route.POST(req({action:'preference',acceptsPets:true}))).status,200);assert.equal(updated.table,'drivers');assert.equal(updated.value.accepts_pets,true);
 auth=false;assert.equal((await route.POST(req({action:'preference',acceptsPets:true}))).status,403);
 const quote=load('lib/quote-token.ts',{'cloudflare:workers':{env:{}}});assert.equal(quote.quoteIdentity({pickupAddress:'Terminalen'}),quote.quoteIdentity({pickupAddress:'Terminalen',petDetails:{id:'dog',count:2}}),'Animal choice does not alter the signed price identity');
 console.log('Pets: validation, stored labels, archived choices, public visibility, admin permissions, driver preference and unchanged price identity passed');
})().catch(e=>{console.error(e);process.exitCode=1});
