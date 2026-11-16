// Only customer-facing fields may enter an invoice snapshot.
export function invoiceBooking(b:any){
 return {number:String(b.booking_number),date:String(b.booking_date||''),time:String(b.pickup_time||'').slice(0,5),
  name:String(b.customer_name||''),phone:String(b.customer_phone||''),email:String(b.customer_email||''),
  from:String(b.pickup_address||''),to:String(b.dropoff_address||''),stop:String(b.invoice_stop||''),
  flight:String(b.invoice_flight||String(b.notes||'').match(/Flygnummer:\s*([A-Z0-9]{2,3}[0-9]{1,4}[A-Z]?)/i)?.[1]||''),
  passengers:b.passengers??null,bags:b.luggage_count??null,seats:b.child_seats??null,car:b.car_type==='large'?'Storbil':b.car_type?'Vanlig bil':''};
}
export function orderReference(number:unknown,agreed:unknown){return String(agreed||'').trim()||'B'+String(number);}
