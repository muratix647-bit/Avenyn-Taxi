import {economyAdmin,EconomyError,bodyJson,json,failure} from '@/lib/economy-server';
import {uuid} from '@/lib/economy-workspace';
import {receiptPaid,receiptUrl} from '@/lib/receipt';
import {receiptPdf} from '@/lib/receipt-pdf';
import {sendCustomerSmsOnce} from '@/lib/customer-sms-monitor';
import {normalizePhone,sendPaidReceiptSms} from '@/lib/sms';
import {sendReceiptEmail} from '@/lib/email';
import {validInvoiceEmail} from '@/lib/customer-invoice';

function eligible(b:any){
 return b && b.status==='completed' && !b.archived_at && receiptPaid(b) && Number(b.driver_reported_amount??b.actual_price??b.fixed_price)>0;
}
export async function POST(req:Request){
 try{
  const {db}=await economyAdmin(req),body=await bodyJson(req);
  if(!uuid(body.id))throw new EconomyError('Välj en bokning.');
  const {data:b,error}=await db.from('bookings').select('*').eq('id',body.id).single();
  if(error||!eligible(b))throw new EconomyError('Kontrollera att resan är avslutad och betald och att slutpriset finns.',409);
  if(body.channel==='pdf')return new Response(new Uint8Array(await receiptPdf(b)).buffer,{headers:{'Content-Type':'application/pdf','Cache-Control':'private, no-store'}});
  if(!uuid(body.attempt))throw new EconomyError('Ogiltigt utskick.');
  if(body.channel==='sms'){
   const phone=normalizePhone(body.recipient);
   if(!phone||phone!==normalizePhone(b.customer_phone)||!receiptUrl(b))throw new EconomyError('Kontrollera mobilnumret och kundlänken på bokningen.');
   const r=await sendCustomerSmsOnce(b.id,'paid_receipt',body.attempt,async latest=>{
    const url=receiptUrl(latest);
    if(!eligible(latest)||normalizePhone(latest.customer_phone)!==phone||!url)return {accepted:false,reason:'booking_changed'};
    return sendPaidReceiptSms(latest,url);
   });
   if(!r.accepted)throw new EconomyError('Utskicket kunde inte bekräftas. Kontrollera SMS-status före nytt försök.',502);
  }else if(body.channel==='email'){
   const recipient=String(body.recipient||'').trim();
   if(!validInvoiceEmail(recipient))throw new EconomyError('Ange en giltig e-postadress.');
   const r=await sendReceiptEmail(b,body.attempt,recipient);
   if(!r.accepted)throw new EconomyError('Mejlutskicket kunde inte bekräftas.',502);
  }else throw new EconomyError('Välj utskickssätt.');
  return json({ok:true});
 }catch(e){return failure(e);}
}
