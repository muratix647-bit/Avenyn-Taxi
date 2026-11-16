import {economyAdmin,EconomyError,bodyJson,json,failure} from '@/lib/economy-server';
import {invoiceNo,invoiceBankgiro,paymentReference,validInvoiceEmail} from '@/lib/customer-invoice';
import {customerInvoicePdf} from '@/lib/customer-invoice-pdf';
import {uuid,sek} from '@/lib/economy-workspace';
import {sendCustomerInvoice} from '@/lib/email';

const delivery='dispatch_invoice_delivery';
export async function POST(req:Request){
 try{
  const {db,user}=await economyAdmin(req);
  const {id,recipient:raw}=await bodyJson(req);
  const recipient=typeof raw==='string'?raw.trim():'';
  if(!uuid(id)||!validInvoiceEmail(recipient))throw new EconomyError('Kontrollera faktura och mottagaradress.');
  const {data:invoice,error}=await db.from('dispatch_customer_invoices').select('*').eq('id',id).single();
  if(error||!invoice)throw new EconomyError('Fakturan hittades inte.',404);
  if(invoice.credited)throw new EconomyError('Fakturan är krediterad.',409);
  const pdf=await customerInvoicePdf(invoice,invoice.document.payment!==invoiceBankgiro);
  const attempt=crypto.randomUUID();
  const {error:insert}=await db.from(delivery).insert({invoice_id:id,recipient,attempt,state:'pending',requested_by:user.id});
  if(insert){
   if(insert.code!=='23505')throw insert;
   const {data:retry,error:claim}=await db.from(delivery).update({attempt,recipient,state:'pending',requested_by:user.id,requested_at:new Date().toISOString()}).eq('invoice_id',id).eq('state','rejected').select('invoice_id').maybeSingle();
   if(claim)throw claim;
   if(!retry)throw new EconomyError('Ett utskick är redan registrerat. Uppdatera listan och kontrollera status.',409);
  }
  const result=await sendCustomerInvoice(recipient,invoiceNo(invoice.serial_no),paymentReference(invoice),sek(invoice.gross_ore),pdf,attempt);
  if(!result.accepted){
   if(result.reason==='email_not_configured'||(result.status&&result.status>=400&&result.status<500&&result.status!==408&&result.status!==409)){
    await db.from(delivery).update({state:'rejected'}).eq('attempt',attempt);
    throw new EconomyError('Mejltjänsten nekade utskicket. Kontrollera adressen och försök igen.',502);
   }
   throw new EconomyError('Mejltjänstens svar är oklart. Kontrollera utskicket innan du försöker igen.',502);
  }
  const {error:saving}=await db.from(delivery).update({state:'accepted',provider_id:result.providerId,accepted_at:new Date().toISOString()}).eq('attempt',attempt);
  if(saving)throw new EconomyError('Mejltjänsten tog emot fakturan men status kunde inte sparas.',502);
  return json({accepted:true});
 }catch(e){return failure(e);}
}
