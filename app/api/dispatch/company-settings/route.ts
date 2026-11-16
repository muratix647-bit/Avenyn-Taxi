import {economyAdmin,bodyJson,json,failure,EconomyError} from '@/lib/economy-server';
import {validateRates} from '@/lib/company-pricing';
import {postalAddress,validInvoiceEmail} from '@/lib/customer-invoice';
export async function GET(req:Request){try{const {db}=await economyAdmin(req);const r=await db.from('billing_auto_invoice_jobs').select('*,booking:bookings(booking_number),company:billing_companies(name)').order('created_at',{ascending:false}).limit(100);if(r.error)throw r.error;return json({jobs:r.data});}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 const {db,user}=await economyAdmin(req),b=await bodyJson(req);
 if(!/^[0-9a-f-]{36}$/i.test(b.company_id||''))throw new EconomyError('Välj företag.');
 if(b.action==='extras'){
 if(!/^[0-9a-f-]{36}$/i.test(b.booking_id||'')||!Array.isArray(b.extras)||b.extras.length>10)throw new EconomyError('Välj bokning och tillägg.');
 const extras=b.extras.map((e:any)=>({description:String(e.description||'').trim(),amount:Number(e.amount)}));
 if(extras.some((e:any)=>!e.description||e.description.length>100||!Number.isFinite(e.amount)||e.amount<=0||e.amount>100000||Math.abs(e.amount*100-Math.round(e.amount*100))>0.001))throw new EconomyError('Kontrollera tilläggens beskrivning och belopp.');
 const r=await db.rpc('billing_set_trip_extras',{p_booking_id:b.booking_id,p_company_id:b.company_id,p_extras:extras});if(r.error)throw new EconomyError('Resan måste vara öppen, obetald och kopplad till företaget.',409);return json({ok:true});
 }
 if(b.action!=='settings')throw new EconomyError('Okänd åtgärd.');
 const rates=validateRates(b.rates),address=String(b.sender_address||'').trim();
 if(!postalAddress(address)||address.length>250)throw new EconomyError('Ange Avenyn Taxis fullständiga fakturaadress.');
 const current=await db.from('billing_companies').select('*').eq('id',b.company_id).single();if(current.error)throw current.error;
 if(b.automatic&&(!current.data.approved||!validInvoiceEmail(current.data.invoice_email)||!postalAddress(current.data.billing_address)))throw new EconomyError('Företaget behöver godkänd fakturabetalning, fakturamejl och fullständig adress.');
 const r=await db.from('billing_companies').update({contract_rates:rates,invoice_sender_address:address,auto_invoice_since:b.automatic?(current.data.auto_invoice_since||new Date().toISOString()):null,updated_by:user.id,updated_at:new Date().toISOString()}).eq('id',b.company_id);if(r.error)throw r.error;return json({ok:true});
}catch(e){return failure(e);}}
