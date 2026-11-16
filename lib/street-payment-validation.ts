export function amountOre(value: unknown): number {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('Ange ett belopp med högst två decimaler.');
  const amount = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(amount) || amount < 300 || amount > 1000000) throw new Error('Beloppet måste vara mellan 3 och 10 000 kr.');
  return amount;
}
export function confirmedStreetPayment(row: any, session: any) {
  return session.id === row.stripe_session_id && session.metadata?.street_payment_id === row.id && session.currency === 'sek' && session.amount_total === row.amount_ore && session.payment_status === 'paid';
}
