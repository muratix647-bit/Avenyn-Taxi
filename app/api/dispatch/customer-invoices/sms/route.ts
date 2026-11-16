import {economyAdmin,EconomyError,json,failure,bodyJson} from '@/lib/economy-server';
import {uuid} from '@/lib/economy-workspace';
import {deliverInvoice,scheduledRecord} from '@/lib/invoice-sms';
import {normalizePhone} from '@/lib/sms';
const plans='dispatch_invoice_sms_plans';
export async function GET(request:Request){try{
 const {db}=await economyAdmin(request);
 const [p,d]=await Promise.all([db.from(plans).select('*,bookings(booking_number)').neq('state','done').order('updated_at',{ascending:false}).limit(200),db.from('dispatch_invoice_sms_links').select('invoice_id,state,recipient,created_at').order('created_at',{ascending:false}).limit(500)]);
 if(p.error||d.error)throw p.error||d.error;
 return json({plans:p.data,deliveries:d.data});
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const {db,user}=await economyAdmin(request),b=await bodyJson(request);
 if(b.action==='send'){
  if(!uuid(b.id)||!uuid(b.attempt))throw new EconomyError('Ogiltig faktura.');
  await deliverInvoice(db,b.id,b.phone,user.id,b.attempt);return json({ok:true});
 }
 if(!uuid(b.bookingId))throw new EconomyError('Välj en bokning.');
 if(b.action==='remove'){
  const r=await db.from(plans).delete().eq('booking_id',b.bookingId).eq('updated_at',String(b.version)).in('state',['waiting','review']).select('booking_id').maybeSingle();
  if(r.error||!r.data)throw new EconomyError('Planeringen har ändrats. Uppdatera sidan.',409);
 }else if(b.action==='plan'){
  const id=crypto.randomUUID(),recipient=normalizePhone(b.phone);
  if(b.payload?.bookingId!==b.bookingId)throw new EconomyError('Bokningen stämmer inte.');
  try{await scheduledRecord(db,b.payload,id,recipient,false);}catch(e){throw new EconomyError(e instanceof Error?e.message:'Kontrollera fakturaunderlaget.');}
  const existing=await db.from('dispatch_customer_invoices').select('id').eq('booking_id',b.bookingId).eq('credited',false).maybeSingle();
  if(existing.error||existing.data)throw new EconomyError('Kontrollera den utfärdade fakturan i registret.',409);
  const values={payload:b.payload,invoice_id:id,recipient,actor:user.id,state:'waiting',note:null,updated_at:new Date().toISOString()};
  const r=b.version?await db.from(plans).update(values).eq('booking_id',b.bookingId).eq('updated_at',String(b.version)).in('state',['waiting','review']).select('booking_id').maybeSingle():await db.from(plans).insert({...values,booking_id:b.bookingId}).select('booking_id').single();
  if(r.error||!r.data)throw new EconomyError('Planeringen har ändrats. Uppdatera listan.',409);
 }else throw new EconomyError('Okänd åtgärd.');
 return json({ok:true});
}catch(e){return failure(e);}}
