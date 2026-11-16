import {economyAdmin,bodyJson,json,failure,EconomyError} from '@/lib/economy-server';
import {normalizeCompany} from '@/lib/business-billing';
export async function GET(request:Request){try{
 const {db}=await economyAdmin(request);const r=await db.from('billing_company_access').select('*').order('created_at',{ascending:false}).limit(500);
 if(r.error)throw r.error;return json({requests:r.data});
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const {db,user}=await economyAdmin(request);const b=await bodyJson(request);
 if(!/^[0-9a-f-]{36}$/i.test(b.id||''))throw new EconomyError('Välj en ansökan.');
 if(b.action==='reject'){
 const r=await db.from('billing_company_access').update({state:'rejected',reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq('id',b.id).select('id').single();if(r.error)throw r.error;
 }else if(b.action==='approve'){
 let company;try{company=normalizeCompany({...b.company,approved:true});}catch(e:any){throw new EconomyError(e.message);}
 const r=await db.rpc('billing_approve_company_access',{p_access_id:b.id,p_admin:user.id,p_company_id:b.company_id||null,p_company:company});
 if(r.error)throw new EconomyError('Kunde inte godkänna. Kontrollera företaget och organisationsnumret; välj befintligt företag om det redan finns.',409);
 }else throw new EconomyError('Okänd åtgärd.');
 return json({ok:true});
}catch(e){return failure(e);}}
