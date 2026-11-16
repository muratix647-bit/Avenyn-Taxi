import {invoiceBankgiro,paidNoticeSv,paidNoticeEn} from '@/lib/customer-invoice';
import {invoiceBooking} from '@/lib/invoice-booking';
import {sek} from '@/lib/economy-workspace';
import {paidTripDetails} from '@/lib/paid-trip-details';

import PaidReceiptActions from './paid-receipt-actions';

export function isPaidTrip(booking:any){
 return !!booking && booking.payment_status!=='refunded' &&
   (booking.driver_reported_paid===true || ['paid','succeeded'].includes(booking.payment_status));
}

export default function PaidTripReview({booking,accessToken}:{booking:any;accessToken:string}){
 const trip=invoiceBooking(booking);
 const raw=booking.driver_reported_amount??booking.actual_price??booking.fixed_price;
 const ore=raw==null||raw===''?null:Math.round(Number(raw)*100);
 const details=paidTripDetails(booking);
 return <details className="bbInfo sm:col-span-2">
  <summary className="cursor-pointer font-bold">Granska betald resa #{trip.number}</summary>
  <p style={{color:'#315c47',fontSize:'0.85rem',lineHeight:1.4,margin:'6px 0'}}>
   {paidNoticeSv} <span lang="en">{paidNoticeEn}</span>
  </p>
  <dl>
   <dt>Kund</dt><dd>{trip.name}</dd>
   <dt>Resedatum och hämtningstid</dt><dd>{trip.date} kl. {trip.time}</dd>
   <dt>Avslutad (svensk tid)</dt><dd>{details.completed||'Ej angivet'}</dd>
   <dt>Från</dt><dd>{trip.from}</dd>
   {trip.stop&&<><dt>Extra stopp</dt><dd>{trip.stop}</dd></>}
   <dt>Till</dt><dd>{trip.to}</dd>
   <dt>Antal passagerare</dt><dd>{trip.passengers??'Ej angivet'}</dd>
   <dt>Bagage</dt><dd>{trip.bags??'Ej angivet'}</dd>
   <dt>Biltyp</dt><dd>{trip.car||'Ej angivet'}</dd>
   <dt>Barnstol/tillval</dt><dd>{details.seats}</dd>
   <dt>Flygnummer</dt><dd>{details.flight||'Ej angivet'}</dd>
   <dt>Betalsätt</dt><dd>{details.method}</dd>
   <dt>Betalningsstatus</dt><dd>Betalning mottagen{details.verified?' · Verifierad onlinebetalning':''}</dd>
   <dt>Betalningsanteckning</dt><dd>{details.paymentNote||'Ingen anteckning'}</dd>
   <dt>Meddelande vid bokning</dt><dd style={{whiteSpace:'pre-wrap'}}>{details.message||'Inget meddelande'}</dd>
   <dt>Pris inklusive moms</dt><dd>{ore!==null&&Number.isFinite(ore)?sek(ore):'Slutpris saknas'}</dd>
   <dt>Kvar att betala</dt><dd><strong>{sek(0)}</strong></dd>
   <dt>Företagsuppgift</dt><dd>{invoiceBankgiro}</dd>
  </dl>
  {booking.status==='completed'&&ore!==null&&ore>0&&<PaidReceiptActions booking={booking} accessToken={accessToken}/>}
 </details>;
}
