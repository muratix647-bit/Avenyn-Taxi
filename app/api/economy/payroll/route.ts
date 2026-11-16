import {economyAdmin,EconomyError,json,failure,bodyJson} from '@/lib/economy-server';
import {payrollDetails,approvalError,validDate,validPeriod,uuid} from '@/lib/economy-workspace';
export async function GET(request:Request){try{
 const {db}=await economyAdmin(request);const p=new URL(request.url).searchParams.get('month');
 if(!validPeriod(p))throw new EconomyError('Välj en månad.');
 const {data,error}=await db.from('economy_payroll').select('*').eq('period',p).order('employee_name').limit(501);
 const {data:paid,error:paidError}=await db.from('economy_payroll').select('*').eq('status','paid').gte('payment_date',p+'-01').lt('payment_date',new Date(Date.UTC(Number(p.slice(0,4)),Number(p.slice(5,7)),1)).toISOString().slice(0,10)).is('archived_at',null).order('employee_name').limit(501);
 if(error||paidError)throw new Error('database');if((data?.length||0)>500||(paid?.length||0)>500)throw new EconomyError('Månaden innehåller fler än 500 löner. Rapporten visas inte för att undvika ofullständiga summor.');return json({rows:data,paid});
 }catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const {db,user}=await economyAdmin(request);const b=await bodyJson(request);
 if(!uuid(b.id)||!uuid(b.driver_id)||!validPeriod(b.period)||!validDate(b.payment_date))throw new EconomyError('Kontrollera förare, månad och utbetalningsdatum.');
 let details;try{details=payrollDetails(b);}catch(e){throw new EconomyError((e as Error).message);}
 const {data:driver,error:driverError}=await db.from('drivers').select('id,full_name').eq('id',b.driver_id).single();
 if(driverError||!driver?.full_name)throw new EconomyError('Föraren saknas. Uppdatera förarlistan.');
 const values={driver_id:driver.id,employee_name:driver.full_name,period:b.period,payment_date:b.payment_date,details,updated_by:user.id,updated_at:new Date().toISOString()};
 if(b.revision!==undefined){
  if(!Number.isSafeInteger(b.revision)||b.revision<1)throw new EconomyError('Ogiltig version.');
  const {data,error}=await db.from('economy_payroll').update({...values,revision:b.revision+1}).eq('id',b.id).eq('revision',b.revision).eq('status','draft').is('archived_at',null).select('id').maybeSingle();
  if(error)throw error;if(!data)throw new EconomyError('Underlaget har ändrats eller låsts. Uppdatera listan.',409);
 }else{
  const {error}=await db.from('economy_payroll').insert({...values,id:b.id,created_by:user.id});
  if(error?.code==='23505')throw new EconomyError('Det finns redan en lön för föraren och månaden. Öppna eller återställ den.',409);
  if(error)throw error;
 }
 return json({ok:true});
 }catch(e){return failure(e);}}
export async function PATCH(request:Request){try{
 const {db,user}=await economyAdmin(request);const b=await bodyJson(request);
 if(!uuid(b.id)||!Number.isSafeInteger(b.revision)||!['approve','paid','archive','restore'].includes(b.action))throw new EconomyError('Ogiltig åtgärd.');
 const {data:row,error}=await db.from('economy_payroll').select('*').eq('id',b.id).single();if(error||!row)throw new EconomyError('Underlaget finns inte.',404);
 if(row.revision!==b.revision)throw new EconomyError('Underlaget har ändrats. Uppdatera listan.',409);
 const now=new Date().toISOString();const updates:Record<string,unknown>={revision:row.revision+1,updated_by:user.id,updated_at:now};
 if(b.action==='approve'){
  if(row.status!=='draft'||row.archived_at)throw new EconomyError('Bara aktiva utkast kan godkännas.');
  const err=approvalError(row.details);if(err)throw new EconomyError(err);
  if(b.confirmed!==true)throw new EconomyError('Bekräfta att uppgifterna har kontrollerats.');
  Object.assign(updates,{status:'approved',approved_at:now});
 }else if(b.action==='paid'){
  if(row.status!=='approved'||row.archived_at||!validDate(b.payment_date)||b.confirmed!==true)throw new EconomyError('Bekräfta faktisk betalning och ange utbetalningsdatum.');
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm'}).format(new Date());
  if(b.payment_date>today)throw new EconomyError('En framtida betalning kan inte markeras som utbetald.');
  Object.assign(updates,{status:'paid',paid_at:now,payment_date:b.payment_date});
 }else{
  if(row.status!=='draft')throw new EconomyError('Godkända löner bevaras och kan inte arkiveras.');
  updates.archived_at=b.action==='archive'?now:null;
 }
 const {data:changed,error:updateError}=await db.from('economy_payroll').update(updates).eq('id',row.id).eq('revision',row.revision).select('id').maybeSingle();
 if(updateError)throw updateError;if(!changed)throw new EconomyError('Underlaget ändrades samtidigt. Uppdatera listan.',409);
 return json({ok:true});
 }catch(e){return failure(e);}}
