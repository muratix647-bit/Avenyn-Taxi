import {EconomyError} from './economy-server';
import {invoiceNo,invoiceBankgiro,paymentReference} from './customer-invoice';
import {customerInvoicePdf} from './customer-invoice-pdf';
import {sek} from './economy-workspace';
import {sendCustomerInvoice} from './email';
const delivery='dispatch_invoice_delivery';
export async function sendCompanyInvoice(db:any,id:string,recipient:string,actor:string){
  const {data:invoice,error}=await db.from('dispatch_customer_invoices').select('*').eq('id',id).single();
  if(error||!invoice)throw new EconomyError('Fakturan hittades inte.',404);
  if(invoice.credited)throw new EconomyError('Fakturan är krediterad.',409);
  const pdf=await customerInvoicePdf(invoice,invoice.document.payment!==invoiceBankgiro);
  const attempt=crypto.randomUUID();
  const {error:insert}=await db.from(delivery).insert({invoice_id:id,recipient,attempt,state:'pending',requested_by:actor});
  if(insert){
   if(insert.code!=='23505')throw insert;
   const {data:retry,error:claim}=await db.from(delivery).update({attempt,recipient,state:'pending',requested_by:actor,requested_at:new Date().toISOString()}).eq('invoice_id',id).eq('state','rejected').select('invoice_id').maybeSingle();
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
}
