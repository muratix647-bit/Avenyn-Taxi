// Live billing preparation only: never an issued invoice or a ledger entry.
export function billingSummary(booking: any, company: any, reference: string) {
  const reasons: string[] = [];
  const paid = booking.driver_reported_paid === true || ['paid','succeeded'].includes(booking.payment_status);
  if (!company.approved) reasons.push('Företaget är inte godkänt för faktura');
  if (company.reference_required && !reference.trim()) reasons.push('Kundreferens saknas');
  if (booking.status === 'cancelled') reasons.push('Resan är avbokad');
  else if (booking.status !== 'completed') reasons.push('Resan är inte avslutad');
  if (paid) reasons.push('Resan är redan markerad som betald');
  if (booking.archived_at) reasons.push('Bokningen är arkiverad');
  const method = String(booking.driver_reported_payment_method || booking.payment_method || '').trim().toLowerCase();
  if (!['invoice', 'faktura'].includes(method)) reasons.push('Betalningssättet är inte Faktura');
  // Estimates must not become final invoice amounts.
  const price = booking.driver_reported_amount ?? booking.actual_price ?? booking.fixed_price;
  const gross = price === null || price === undefined || price === '' ? null : Math.round(Number(price) * 100);
  if (gross === null || !Number.isSafeInteger(gross) || gross <= 0) reasons.push('Slutpris saknas eller är ogiltigt');
  return {ready: reasons.length === 0, reasons, grossOre: gross !== null && Number.isSafeInteger(gross) && gross > 0 ? gross : null};
}
export function normalizeCompany(input: any) {
  const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0,max);
  const name=clean(input.name,160), org_number=clean(input.org_number,40), invoice_email=clean(input.invoice_email,180).toLowerCase(), billing_address=clean(input.billing_address,500);
  const payment_days=Number(input.payment_days);
  if (!name || !org_number || !billing_address || !/^\S+@\S+\.\S+$/.test(invoice_email)) throw new Error('Fyll i företagsnamn, organisationsnummer, fakturaadress och giltig fakturamejl.');
  if (!Number.isInteger(payment_days) || payment_days<1 || payment_days>90) throw new Error('Betalningsvillkor ska vara 1–90 dagar.');
  return {name,org_number,invoice_email,billing_address,payment_days,reference_required:input.reference_required===true,approved:input.approved===true};
}
