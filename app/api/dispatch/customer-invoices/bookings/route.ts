import {economyAdmin,EconomyError,json,failure} from '@/lib/economy-server';
import {uuid} from '@/lib/economy-workspace';

export async function GET(request:Request){
 try{
  const {db}=await economyAdmin(request);
  const params=new URL(request.url).searchParams,id=params.get('id');
  if(id){
   if(!uuid(id))throw new EconomyError('Ogiltig bokning.');
   const [booking,link,invoice]=await Promise.all([
    db.from('bookings').select('*').eq('id',id).is('archived_at',null).maybeSingle(),
    db.from('billing_booking_links').select('reference,company:billing_companies(*)').eq('booking_id',id).maybeSingle(),
    db.from('dispatch_customer_invoices').select('id,serial_no').eq('booking_id',id).eq('credited',false).maybeSingle()
   ]);
   if(booking.error||link.error||invoice.error)throw new EconomyError('Kunde inte läsa bokningen.',500);
   if(!booking.data)throw new EconomyError('Bokningen finns inte längre i registret.',404);
   const {tracking_token, ...row}=booking.data;
   return json({booking:{...row,invoice_stop:row.price_breakdown?.stop_address},link:link.data,invoice:invoice.data});
  }
  const raw=(params.get('q')||'').trim().slice(0,90);
  let query=db.from('bookings').select('id,booking_number,booking_date,customer_name,pickup_address,dropoff_address').is('archived_at',null);
  if(raw){
   const term=raw.replace(/[^\p{L}\p{N} @+.-]/gu,' ').trim();
   if(!term)return json({bookings:[]});
   const filters=['customer_name','customer_email','customer_phone','pickup_address','dropoff_address'].map(k=>k+'.ilike."*'+term+'*"');
   if(/^#?\d{1,15}$/.test(raw))filters.unshift('booking_number.eq.'+raw.replace('#',''));
   if(/^\d{4}-\d{2}-\d{2}$/.test(term)&&Number.isFinite(Date.parse(term))&&new Date(term).toISOString().slice(0,10)===term)filters.push('booking_date.eq.'+term);
   query=query.or(filters.join(','));
  }
  const result=await query.order('booking_number',{ascending:false}).limit(50);
  if(result.error)throw result.error;
  return json({bookings:result.data||[]});
 }catch(e){return failure(e);}
}
