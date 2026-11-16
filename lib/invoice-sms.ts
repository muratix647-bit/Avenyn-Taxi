import {adminSupabase} from './supabase-server';
import {invoiceInput,invoiceNo} from './customer-invoice';
import {billingSummary} from './business-billing';
import {invoiceBooking,orderReference} from './invoice-booking';
import {normalizePhone,sendInvoiceLinkSms} from './sms';
import {EconomyError} from './economy-server';

export async function tokenHash(token:string){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
}
export async function deliverInvoice(db:any,id:string,phone:string,actor:string,attempt:string){
 const recipient=normalizePhone(phone);
 if(!recipient)throw new EconomyError('Ange ett giltigt mobilnummer.');
 const {data:invoice,error}=await db.from('dispatch_customer_invoices').select('id,serial_no,credited').eq('id',id).single();
 if(error||!invoice||invoice.credited)throw new EconomyError('Fakturan saknas eller har krediterats.',409);
 const token=crypto.randomUUID()+crypto.randomUUID();
 const save=await db.from('dispatch_invoice_sms_links').insert({attempt,invoice_id:id,token_hash:await tokenHash(token),recipient,requested_by:actor,expires_at:new Date(Date.now()+90*86400000).toISOString()});
 if(save.error){
  if(save.error.code==='23505'){
   const {data}=await db.from('dispatch_invoice_sms_links').select('state').eq('attempt',attempt).eq('invoice_id',id).eq('recipient',recipient).maybeSingle();
   if(data?.state==='accepted')return;
   throw new EconomyError('Kontrollera det tidigare SMS-utskicket innan du skickar igen.',409);
  }
  throw save.error;
 }
 const result=await sendInvoiceLinkSms(recipient,invoiceNo(invoice.serial_no),'https://avenyntaxi.se/faktura/'+token);
 const state=result.accepted?'accepted':result.reason==='provider_unreachable'?'unknown':'rejected';
 const recorded=await db.from('dispatch_invoice_sms_links').update({state,provider_id:result.providerId||null}).eq('attempt',attempt);
 if(recorded.error||!result.accepted)throw new EconomyError(state==='rejected'?'SMS-tjänsten nekade utskicket.':'Kontrollera utskicket hos SMS-tjänsten.',502);
}
export async function scheduledRecord(db:any,payload:any,id:string,recipient:string,completed:boolean){
 const record=invoiceInput({...payload,id});
 const {data:b,error}=await db.from('bookings').select('*').eq('id',record.booking_id).single();
 if(error||!b)throw new EconomyError('Bokningen saknas.');
 const {data:link,error:linkError}=await db.from('billing_booking_links').select('reference,company:billing_companies(*)').eq('booking_id',b.id).maybeSingle();
 if(linkError)throw linkError;
 const c=link?.company;
 const summary=billingSummary(completed?b:{...b,status:b.status==='cancelled'?'cancelled':'completed'},c||{approved:true},link?.reference||'');
 if(!summary.ready||summary.grossOre!==record.gross_ore||record.document.serviceDate!==b.booking_date||b.payment_status==='refunded')throw new EconomyError('Kontrollera pris, datum, betalningssätt och resans status.',409);
 if(!recipient||normalizePhone(b.customer_phone)!==recipient)throw new EconomyError('Bokningens mobilnummer saknas eller har ändrats.',409);
 if((c&&(record.document.org!==c.org_number||record.document.kind!=='company'))||(!c&&record.document.kind==='private'&&record.document.name.trim()!==String(b.customer_name||'').trim()))throw new EconomyError('Fakturamottagaren har ändrats.',409);
 record.document.reference=orderReference(b.booking_number,link?.reference||record.document.reference);
 Object.assign(record.document,{booking:invoiceBooking({...b,invoice_stop:b.price_breakdown?.stop_address})});
 return record;
}
export async function processInvoicePlans(){
 const db=adminSupabase();
 // A stopped worker may already have submitted an SMS. Surface it for manual review.
 const stale=await db.from('dispatch_invoice_sms_plans').update({state:'review',note:'Avbruten behandling. Kontrollera utfärdad faktura och SMS-status.'}).eq('state','processing').lt('updated_at',new Date(Date.now()-600000).toISOString());
 if(stale.error)throw stale.error;
 const {data,error}=await db.from('dispatch_invoice_sms_plans').select('booking_id,bookings!inner(status)').eq('state','waiting').in('bookings.status',['completed','cancelled']).limit(20);
 if(error)throw error;
 for(const item of data||[]){
  const {data:p,error:claimError}=await db.from('dispatch_invoice_sms_plans').update({state:'processing',updated_at:new Date().toISOString()}).eq('booking_id',item.booking_id).eq('state','waiting').select('*').maybeSingle();
  if(claimError)throw claimError;
  if(!p)continue;
  let note='';
  try{
   const record=await scheduledRecord(db,p.payload,p.invoice_id,p.recipient,true);
   const issue=await db.from('dispatch_customer_invoices').insert({...record,created_by:p.actor});
   if(issue.error)throw new EconomyError('Kontrollera om en faktura redan har utfärdats för bokningen.');
   await deliverInvoice(db,p.invoice_id,p.recipient,p.actor,p.invoice_id);
  }catch(e){note=e instanceof EconomyError?e.message:'Granska fakturaunderlaget och SMS-statusen.';}
  const saved=await db.from('dispatch_invoice_sms_plans').update({state:note?'review':'done',note}).eq('booking_id',p.booking_id).eq('state','processing');
  if(saved.error)throw saved.error;
 }
}
