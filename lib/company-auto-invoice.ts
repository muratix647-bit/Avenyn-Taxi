import {adminSupabase} from './supabase-server';
import {invoiceInput,validInvoiceEmail} from './customer-invoice';
import {billingSummary} from './business-billing';
import {invoiceBooking,orderReference} from './invoice-booking';
import {sendCompanyInvoice} from './company-invoice-email';
import {EconomyError} from './economy-server';
export function companyInvoiceRecord(b:any,c:any,reference:string,id:string){
 const summary=billingSummary(b,c,reference);
 if(!summary.ready||b.payment_status==='refunded')throw new EconomyError(summary.reasons.join(' · ')||'Kontrollera betalningen.');
 if(!validInvoiceEmail(c.invoice_email))throw new EconomyError('Fakturamejl saknas.');
 const price=b.price_breakdown?.company_pricing;
 const description=`Taxiresa #${b.booking_number} · ${b.pickup_address} → ${b.dropoff_address}`.slice(0,300);
 const line=(description:string,amount:number)=>({service:'passenger',description,amount:String(amount),quantity:'1',rate:'6',vatReason:''});
 const items=price?[line(description,Number(price.base)),...(price.extras||[]).map((e:any)=>line(e.description,Number(e.amount)))]:[line(description,summary.grossOre!/100)];
 const record=invoiceInput({id,bookingId:b.id,kind:'company',name:c.name,org:c.org_number,address:c.billing_address,recipientEmail:c.invoice_email,days:c.payment_days,sellerAddress:c.invoice_sender_address,sellerVat:'SE556597479601',reference:orderReference(b.booking_number,reference),serviceDate:b.booking_date,items});
 if(record.gross_ore!==summary.grossOre)throw new EconomyError('Slutpriset skiljer sig från fastpris och tillägg. Granska fakturan.');
 Object.assign(record.document,{booking:invoiceBooking({...b,invoice_stop:b.price_breakdown?.stop_address})});return record;
}
export async function processCompanyInvoices(){
 const db=adminSupabase();
 const stale=await db.from('billing_auto_invoice_jobs').update({state:'review',note:'Avbruten behandling. Kontrollera faktura och mejlstatus före nytt utskick.'}).eq('state','processing').lt('updated_at',new Date(Date.now()-600000).toISOString());if(stale.error)throw stale.error;
 const candidates=await db.rpc('billing_auto_candidates');if(candidates.error)throw candidates.error;
 for(const candidate of candidates.data||[]){
 const claim=await db.from('billing_auto_invoice_jobs').insert(candidate).select('*').single();if(claim.error?.code==='23505')continue;if(claim.error)throw claim.error;const job=claim.data;
 let note='';try{
 const [booking,link]=await Promise.all([db.from('bookings').select('*').eq('id',job.booking_id).single(),db.from('billing_booking_links').select('reference,company:billing_companies(*)').eq('booking_id',job.booking_id).single()]);
 if(booking.error||link.error)throw new EconomyError('Bokning eller företagskoppling saknas.');
 const b=booking.data,c:any=link.data.company;
 if(c.id!==job.company_id||!c.auto_invoice_since||b.created_at<c.auto_invoice_since)throw new EconomyError('Automatiken är avstängd eller företagskopplingen ändrad.');
 const record=companyInvoiceRecord(b,c,link.data.reference,job.invoice_id);
 const created=await db.from('dispatch_customer_invoices').insert({...record,created_by:c.updated_by});
 if(created.error)throw new EconomyError('Kontrollera resans slutpris och om fakturan redan finns.');
 await sendCompanyInvoice(db,job.invoice_id,c.invoice_email,c.updated_by);
 }catch(e){note=e instanceof EconomyError?e.message:'Underlaget behöver granskas i Kundfakturor.';}
 const done=await db.from('billing_auto_invoice_jobs').update({state:note?'review':'done',note,updated_at:new Date().toISOString()}).eq('booking_id',job.booking_id);if(done.error)throw done.error;
 }
}
