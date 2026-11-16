import {completionLocalTime} from './completion-time';
import {paymentLabels,withoutStopNote} from './booking-options';

export function paidTripDetails(b:any){
 const verified=b.payment_status==='paid';
 const method=b.driver_reported_payment_method||b.payment_method;
 const notes=String(b.notes||b.extra_message||'');
 const flightPattern=/flyg(?:nummer)?\s*[:#-]?\s*([a-z0-9]{2,3}\s?\d{1,4}[a-z]?)/i;
 const flight=b.flight_number||notes.match(flightPattern)?.[1]||'';
 return {
  completed:completionLocalTime(b.completed_at).replace('T',' '),
  method:verified?paymentLabels.app:paymentLabels[method]||method||'Ej angivet',
  verified,flight:String(flight).replace(/\s/g,'').toUpperCase(),
  seats:b.child_seats==null?'Ej angivet':Number(b.child_seats)===0?'Ingen barnstol':String(b.child_seats),
  paymentNote:String(b.driver_reported_payment_note||'').trim(),
  message:withoutStopNote(notes.replace(flightPattern,''))
 };
}
