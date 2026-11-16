// Separate, processor-confirmed payments for rides without a booking.
export function streetPaymentHistory(payments:any[],period:{from:string;to:string}) {
  const seen=new Set<string>();
  return payments.filter(row=>{
    if(row.status!=="paid"||!row.paid_at||!Number.isFinite(Date.parse(row.paid_at))||seen.has(row.id))return false;
    const day=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Stockholm",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(row.paid_at));
    if(day<period.from||day>period.to)return false;
    seen.add(row.id);return true;
  }).map(row=>({
    id:`payment:${row.id}`,street_payment:true,booking_number:row.id.slice(0,8),
    completed_at:row.paid_at,price:Number(row.amount_ore)/100,payment_status:"paid",
    driver_reported_paid:true,driver_reported_payment_method:row.payment_channel==="tap_to_pay"?"blipp":"app",
    driver_reported_payment_note:row.reference,
    pickup:row.payment_channel==="tap_to_pay"?"Blipp":"Betallänk",destination:row.reference||"Resa utan bokning",
  }));
}
