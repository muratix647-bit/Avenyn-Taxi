import {adminSupabase} from '@/lib/supabase-server';
import {tokenHash} from '@/lib/invoice-sms';
import {customerInvoicePdf} from '@/lib/customer-invoice-pdf';
import {invoiceBankgiro,invoiceNo} from '@/lib/customer-invoice';
export async function GET(_:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
 const unavailable=()=>new Response('Fakturalänken är ogiltig eller har gått ut. Kontakta Avenyn Taxi.',{status:404,headers});
 if(!/^[0-9a-f-]{72}$/.test(token))return unavailable();
 const db=adminSupabase();
 const link=await db.from('dispatch_invoice_sms_links').select('invoice_id').eq('token_hash',await tokenHash(token)).gt('expires_at',new Date().toISOString()).neq('state','rejected').maybeSingle();
 if(!link.data)return unavailable();
 const {data}=await db.from('dispatch_customer_invoices').select('*').eq('id',link.data.invoice_id).eq('credited',false).maybeSingle();
 if(!data)return unavailable();
 const pdf=await customerInvoicePdf(data,data.document.payment!==invoiceBankgiro);
 return new Response(new Uint8Array(pdf).buffer,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="'+invoiceNo(data.serial_no)+'.pdf"'}});
}
