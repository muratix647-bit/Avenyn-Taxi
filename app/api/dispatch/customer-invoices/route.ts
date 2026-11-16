import {economyAdmin,EconomyError,bodyJson,json,failure} from '@/lib/economy-server';
import {invoiceInput,invoiceNo} from '@/lib/customer-invoice';
import {customerInvoicePdf} from '@/lib/customer-invoice-pdf';
import {billingSummary} from '@/lib/business-billing';
import {uuid} from '@/lib/economy-workspace';
import {invoiceBooking,orderReference} from '@/lib/invoice-booking';
const table='dispatch_customer_invoices';
export async function GET(req:Request){
 try{
  const {db}=await economyAdmin(req),id=new URL(req.url).searchParams.get('id');
  if(id!==null){
   if(!uuid(id))throw new EconomyError('Ogiltig faktura.');
   const {data,error}=await db.from(table).select('*').eq('id',id).single();
   if(error||!data)throw new EconomyError('Fakturan hittades inte.',404);
   const credit=new URL(req.url).searchParams.get('credit')==='1';
   if(credit){
    const {data:note}=await db.from('dispatch_invoice_credits').select('credited_on').eq('invoice_id',id).maybeSingle();
    if(!note)throw new EconomyError('Kreditfakturan saknas.',404);
    return new Response(new Uint8Array(await customerInvoicePdf({...data,creditDate:note.credited_on})).buffer,{headers:{'Content-Type':'application/pdf','Cache-Control':'no-store','Content-Disposition':'attachment; filename="K-'+invoiceNo(data.serial_no)+'.pdf"'}});
   }
   return new Response(new Uint8Array(await customerInvoicePdf(data,new URL(req.url).searchParams.get('paymentCopy')==='1')).buffer,{headers:{'Content-Type':'application/pdf','Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="'+invoiceNo(data.serial_no)+'.pdf"'}});
  }
  const {data,error}=await db.from(table).select('id,serial_no,customer_no,credited,issued_on,gross_ore,document,booking_id').order('serial_no',{ascending:false}).limit(200);
  if(error)throw error;const {data:deliveries,error:deliveryError}=await db.from('dispatch_invoice_delivery').select('invoice_id,recipient,state,accepted_at').in('invoice_id',(data||[]).map(r=>r.id));
  if(data?.length&&deliveryError)throw deliveryError;
  const byId=new Map((deliveries||[]).map(item=>[item.invoice_id,item]));
  return json({invoices:(data||[]).map(item=>({...item,delivery:byId.get(item.id)||null}))});
 }catch(e){return failure(e);}
}
export async function POST(req:Request){
 try{
  const {db,user}=await economyAdmin(req),body=await bodyJson(req);
  let record;try{record=invoiceInput(body);}catch(e){throw new EconomyError((e as Error).message);}
  if(body.replacementOf){
   if(!uuid(body.replacementOf))throw new EconomyError('Ogiltig ursprungsfaktura.');
   const {data:original,error}=await db.from(table).select('serial_no,credited').eq('id',body.replacementOf).maybeSingle();
   if(error||!original?.credited)throw new EconomyError('Ursprungsfakturan måste vara krediterad.',409);
   Object.assign(record.document,{replaces:invoiceNo(original.serial_no)});
  }
  if(body.draftRevision!==undefined){
   if(!Number.isSafeInteger(body.draftRevision)||body.draftRevision<1)throw new EconomyError('Ogiltig utkastversion.');
   Object.assign(record.document,{draftRevision:body.draftRevision});
  }
  if(record.booking_id){
   const {data:b,error}=await db.from('bookings').select('booking_number,customer_phone,customer_email,customer_name,pickup_time,pickup_address,dropoff_address,passengers,luggage_count,child_seats,car_type,notes,invoice_stop:price_breakdown->>stop_address,booking_date,status,archived_at,payment_status,payment_method,driver_reported_paid,driver_reported_payment_method,driver_reported_amount,actual_price,fixed_price').eq('id',record.booking_id).single();
   if(error||!b)throw new EconomyError('Bokningen hittades inte.');
   const {data:link,error:lookup}=await db.from('billing_booking_links').select('reference,company:billing_companies(*)').eq('booking_id',record.booking_id).maybeSingle();
   if(lookup)throw lookup;
   const company:any=link?.company;
   if(company?.reference_required&&!link?.reference?.trim())throw new EconomyError('Företaget kräver en egen beställarreferens. Komplettera företagskopplingen.',409);
   record.document.reference=orderReference(b.booking_number,link?.reference||record.document.reference);
   Object.assign(record.document,{booking:invoiceBooking(b)});
   const summary=billingSummary(b,company||{approved:true},record.document.reference);
   if(!summary.ready||summary.grossOre!==record.gross_ore||record.document.serviceDate!==b.booking_date)throw new EconomyError('Kontrollera resans status, datum, betalningssätt och slutpris.',409);
   if(company&&(record.document.kind!=='company'||record.document.org!==company.org_number))throw new EconomyError('Välj företaget som är kopplat till resan.');
  }
  const {data,error}=await db.from(table).insert({...record,created_by:user.id}).select('id,serial_no').single();
  if(error?.code==='40001')throw new EconomyError('Utkastet ändrades, raderades eller utfärdades. Uppdatera listan.',409);
  if(error?.code==='23505'){
   const {data:old}=await db.from(table).select('id,serial_no,created_by').eq('id',record.id).maybeSingle();
   if(old?.created_by===user.id)return json({id:old.id,serial_no:old.serial_no});
   throw new EconomyError('Resan har redan en utfärdad faktura.',409);
  }
  if(error?.code==='23514')throw new EconomyError('Resans underlag har ändrats. Uppdatera innan du utfärdar fakturan.',409);
  if(error)throw error;return json(data,201);
 }catch(e){return failure(e);}
}
