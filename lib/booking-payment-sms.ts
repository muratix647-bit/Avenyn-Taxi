export function confirmedAmount(booking: any) {
  const amount = Number(booking.driver_reported_amount ?? booking.actual_price ?? booking.fixed_price);
  const ore = Math.round(amount * 100);
  return Number.isSafeInteger(ore) && ore >= 300 ? ore / 100 : 0;
}

export function paymentBlocked(booking: any) {
  if (booking.archived_at || booking.status === 'cancelled') return 'Resan är avbokad eller arkiverad.';
  if (booking.driver_reported_paid || ['paid','refunded'].includes(booking.payment_status)) return 'Resan är redan betald eller återbetald.';
  return '';
}

export async function hasIssuedInvoice(db: any, bookingId: string) {
  const { data, error } = await db.from('dispatch_customer_invoices').select('id').eq('booking_id',bookingId).eq('credited',false).limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}
