import {companyUser,companyApplication} from '@/lib/company-portal';
import {bodyJson,json,failure,EconomyError} from '@/lib/economy-server';
export async function GET(request:Request){try{
 const {db,user}=await companyUser(request);
 const r=await db.from('billing_company_access').select('id,state,application,created_at,company:billing_companies(id,name,org_number,invoice_email,billing_address,payment_days,reference_required,approved,contract_rates)').eq('user_id',user.id).order('created_at',{ascending:false});
 if(r.error)throw r.error;
 const companies=(r.data||[]).filter((a:any)=>a.state==='approved'&&(a.company as any)?.approved).map((a:any)=>(a.company as any).id);
 let trips:any[]=[];
 if(companies.length){const t=await db.from('billing_booking_links').select('reference,company_id,booking:bookings(id,booking_number,booking_date,pickup_time,pickup_address,dropoff_address,status,customer_name,fixed_price,actual_price,tracking_token)').eq('updated_by',user.id).in('company_id',companies).order('created_at',{ascending:false}).limit(50);if(t.error)throw t.error;trips=t.data||[];}
 return json({access:(r.data||[]).map((a:any)=>({...a,company:a.state==='approved'?a.company:null})),trips});
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const {db,user}=await companyUser(request);const body=await bodyJson(request);
 let application;try{application=companyApplication(body);}catch(e:any){throw new EconomyError(e.message);}
 const r=await db.from('billing_company_access').insert({user_id:user.id,requester_email:user.email,org_key:application.org_number,application});
 if(r.error?.code==='23505')throw new EconomyError('Du har redan ansökt för detta företag. Kontakta Avenyn Taxi om uppgifterna behöver ändras.',409);
 if(r.error)throw r.error;return json({ok:true});
}catch(e){return failure(e);}}
