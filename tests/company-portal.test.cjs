const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,Response,Request,URL,console,require:n=>{if(!(n in mocks))throw Error(n);return mocks[n];}});return exports;}
class EconomyError extends Error{constructor(m,status=400){super(m);this.status=status;}}
const economy={EconomyError,json:(x,s=200)=>Response.json(x,{status:s}),bodyJson:r=>r.json(),failure:e=>Response.json({error:e.message},{status:e.status||500})};
test('company access requires verified login, own approved membership and required reference',async()=>{
 let verified=true,logged=true,approved=true,found=true;const filters=[];
 const db={from(){const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},maybeSingle:async()=>({data:found?{company:{id:'12345678-1234-1234-1234-123456789abc',approved,reference_required:true}}:null})};return q;}};
 const m=load('lib/company-portal.ts',{'./supabase-server':{adminSupabase:()=>db,requireSupabaseUser:async()=>{if(!logged)throw Error();return {token:'token',supabase:{auth:{getUser:async()=>({data:{user:{id:'owner',email_confirmed_at:verified?'date':null}}})}}};}},'./economy-server':economy,'./business-billing':{normalizeCompany:x=>x}});
 const input={companyId:'12345678-1234-1234-1234-123456789abc',companyReference:'DEP-7'};
 assert.equal((await m.companyBookingAccess({},input)).userId,'owner');assert.ok(filters.some(([k,v])=>k==='user_id'&&v==='owner'));assert.ok(filters.some(([k,v])=>k==='state'&&v==='approved'));
 await assert.rejects(()=>m.companyBookingAccess({},{...input,companyReference:''}),/referens/);
 approved=false;await assert.rejects(()=>m.companyBookingAccess({},input),e=>e.status===403);
 approved=true;found=false;await assert.rejects(()=>m.companyBookingAccess({},input),e=>e.status===403);
 verified=false;await assert.rejects(()=>m.companyBookingAccess({},input),/Bekräfta/);
 logged=false;await assert.rejects(()=>m.companyBookingAccess({},input),e=>e.status===401);
});
test('application cannot approve itself or choose payment terms',()=>{
 const m=load('lib/company-portal.ts',{'./supabase-server':{},'./economy-server':economy,'./business-billing':{normalizeCompany:x=>x}});
 const a=m.companyApplication({name:'Company',org_number:'556088-1889',contact_name:'Person',contact_phone:'+46700123456',approved:true,payment_days:1});
 assert.equal(a.approved,false);assert.equal(a.payment_days,30);assert.equal(a.org_number,'5560881889');
 assert.throws(()=>m.companyApplication({org_number:'123',contact_phone:'bad'}),/telefon/);
});
test('admin-only approval invokes transactional RPC; rejection disables membership',async()=>{
 let allowed=false,call=null,update=null;const db={rpc:async(name,args)=>{call={name,args};return{};},from(){const q={update:x=>{update=x;return q;},eq:()=>q,select:()=>q,single:async()=>({data:{id:'x'}})};return q;}};
 const m=load('app/api/dispatch/company-access/route.ts',{'@/lib/economy-server':{...economy,economyAdmin:async()=>{if(!allowed)throw new EconomyError('Forbidden',403);return{db,user:{id:'admin'}};}},'@/lib/business-billing':{normalizeCompany:x=>x}});
 const post=body=>m.POST(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)}));const body={action:'approve',id:'12345678-1234-1234-1234-123456789abc',company:{name:'Test'},company_id:'existing'};
 assert.equal((await post(body)).status,403);assert.equal(call,null);allowed=true;
 assert.equal((await post(body)).status,200);assert.equal(call.name,'billing_approve_company_access');assert.equal(call.args.p_admin,'admin');assert.equal(call.args.p_company.approved,true);
 assert.equal((await post({...body,action:'reject'})).status,200);assert.equal(update.state,'rejected');
});
test('booking creation uses atomic company RPC with verified identity, not submitted identity',async()=>{
 let rpc=null,deny=false;const db={rpc:async(name,args)=>{rpc={name,args};return {data:[{id:'booking',booking_number:500,status:'new',price:430}]};},from(){const q={select:()=>q,eq:()=>q,update:()=>q,single:async()=>({data:{price_breakdown:{}}}),then:resolve=>resolve({})};return q;}};
 const m=load('app/api/bookings/route.ts',{
 '@/lib/company-portal':{companyBookingAccess:async()=>{if(deny)throw new EconomyError('Forbidden',403);return {userId:'verified',companyId:'company',reference:'TEAM'};}},
 '@/lib/economy-server':economy,'@/lib/pets':{validatePet:async()=>null,petText:()=>''},'@/lib/quote-token':{readQuote:async()=>({id:'quote',quote:{total_price:430,company_pricing:{company_id:'company',booker_id:'verified'}}})},'@/lib/booking-policy':{POLICY_VERSION:'test'},'@/lib/booking-options':{paymentMethods:['Kort','Faktura'],stopBreakdown:()=>({})},'../../../lib/supabase-server':{adminSupabase:()=>db},'../../../lib/email':{sendBookingEmails:async()=>({sent:false})},'../../../lib/customer-sms-monitor':{sendCustomerSmsOnce:async()=>({accepted:false})},'../../../lib/sms':{},'../../../lib/flight-monitor':{}});
 const input={policyVersion:'test',companyId:'company',userId:'forged',customerName:'Name',customerPhone:'+46700123456',pickup:'A',destination:'B',pickupLat:57,pickupLng:12,destinationLat:58,destinationLng:12,passengers:1,pickupTime:'2027-01-10T12:00:00'};
 const post=()=>m.POST(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(input)}));
 assert.equal((await post()).status,200);assert.equal(rpc.name,'billing_create_quoted_booking');assert.equal(rpc.args.p_user_id,'verified');assert.equal(rpc.args.p_booking.paymentMethod,'Faktura');assert.equal(rpc.args.p_reference,'TEAM');
 deny=true;rpc=null;assert.equal((await post()).status,403);assert.equal(rpc,null);
});
