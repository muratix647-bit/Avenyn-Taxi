import {adminSupabase,requireSupabaseUser} from './supabase-server';
import {EconomyError} from './economy-server';
import {normalizeCompany} from './business-billing';
export async function companyUser(request:Request){
 let auth;try{auth=await requireSupabaseUser(request);}catch{throw new EconomyError('Logga in med ditt kundkonto.',401);}
 const checked=await auth.supabase.auth.getUser(auth.token);
 if(checked.error||!checked.data.user?.email_confirmed_at||checked.data.user.is_anonymous)throw new EconomyError('Bekräfta din e-postadress innan du ansöker eller bokar för företag.',403);
 return {db:adminSupabase(),user:checked.data.user};
}
export function companyApplication(input:any){
 const company=normalizeCompany({...input,payment_days:30,approved:false});
 const contact_name=String(input.contact_name||'').trim().slice(0,160),contact_phone=String(input.contact_phone||'').trim().slice(0,30);
 if(!contact_name||!/^\+?[0-9 ()-]{7,20}$/.test(contact_phone))throw new EconomyError('Fyll i kontaktperson och ett giltigt telefonnummer.');
 return {...company,org_number:company.org_number.replace(/[\s-]/g,'').toUpperCase(),contact_name,contact_phone};
}
export async function companyBookingAccess(request:Request,input:any,checkReference=true){
 const {db,user}=await companyUser(request);
 if(!/^[0-9a-f-]{36}$/i.test(input.companyId||''))throw new EconomyError('Välj ett godkänt företag.');
 const result=await db.from('billing_company_access').select('company:billing_companies(id,name,approved,reference_required,contract_rates)').eq('user_id',user.id).eq('company_id',input.companyId).eq('state','approved').maybeSingle();
 if(result.error)throw result.error;
 const company:any=result.data?.company;
 if(!company?.approved)throw new EconomyError('Du saknar behörighet att boka på detta företag.',403);
 const reference=String(input.companyReference||'').trim();
 if(reference.length>160||checkReference&&company.reference_required&&!reference)throw new EconomyError('Ange företagets beställarreferens eller kostnadsställe.');
 return {userId:user.id,companyId:company.id,reference,company};
}
