const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:n=>deps[n]||require(n),Request,Response,console});return m.exports;}
const {chatInput}=load('lib/chat-input.ts');
const id='11111111-1111-4111-8111-111111111111';
test('chat input rejects identity injection, wrong credentials and invalid lengths',()=>{
 for(const input of [{role:'driver',action:'inbox',userId:id},{role:'customer',action:'read'},{role:'customer',action:'read',trackingToken:id,driverId:id},{role:'driver',action:'read',trackingToken:id},{role:'driver',action:'send',text:'x',requestId:'wrong'},{role:'driver',action:'send',text:' '.repeat(5),requestId:id},{role:'driver',action:'send',text:'x'.repeat(2001),requestId:id},{role:'driver',action:'read',before:'-1'}])assert.equal(chatInput.safeParse(input).success,false);
 assert.equal(chatInput.safeParse({role:'customer',action:'send',trackingToken:id,text:' Hej! ',requestId:id,threadId:id}).data.text,'Hej!');
});
function fixture({authError=false,rpcError=null}={}){const calls=[];const {POST}=load('app/api/messages/route.ts',{'@/lib/chat-input':{chatInput},'@/lib/supabase-server':{requireSupabaseUser:async()=>{if(authError)throw Error('login');return {user:{id:'verified-user'}}},adminSupabase:()=>({rpc:async(name,args)=>{calls.push(args);return {data:{messages:[]},error:rpcError}}})}});return {POST,calls};}
const req=b=>new Request('https://example.invalid/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
test('verified login supplies sender identity and missing login never reaches database',async()=>{
 const f=fixture();const r=await f.POST(req({role:'driver',action:'read',bookingId:id}));assert.equal(r.status,200);assert.equal(f.calls[0].p_user_id,'verified-user');assert.match(r.headers.get('cache-control'),/no-store/);
 const denied=fixture({authError:true});assert.equal((await denied.POST(req({role:'dispatch',action:'inbox'}))).status,401);assert.equal(denied.calls.length,0);
});
test('tracking credential remains in body and uses customer identity only',async()=>{
 const f=fixture();assert.equal((await f.POST(req({role:'customer',action:'read',trackingToken:id}))).status,200);assert.equal(f.calls[0].p_user_id,null);assert.equal(f.calls[0].p_tracking_token,id);
});
test('database failures never become sent confirmations or expose internal errors',async()=>{
 for(const [error,status] of [[{code:'42501',message:'private'},403],[{code:'22023',message:'chat_closed'},409],[{code:'22023',message:'chat_changed'},409],[{code:'P0001',message:'chat_rate_limit'},429],[{code:'XX000',message:'secret database internals'},503]]){const f=fixture({rpcError:error});const r=await f.POST(req({role:'driver',action:'inbox'}));assert.equal(r.status,status);assert.doesNotMatch(JSON.stringify(await r.json()),/secret database internals/);}
});
test('malformed or oversized body is rejected before database call',async()=>{
 const f=fixture();assert.equal((await f.POST(new Request('https://example.invalid',{method:'POST',body:'{'}))).status,400);assert.equal((await f.POST(new Request('https://example.invalid',{method:'POST',body:'x'.repeat(16001)}))).status,413);assert.equal(f.calls.length,0);
});
