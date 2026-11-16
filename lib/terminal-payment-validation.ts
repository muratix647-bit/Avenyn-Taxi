export function terminalPaymentMatches(row: any, intent: any): boolean {
  return row.payment_channel === 'tap_to_pay'
    && intent.id === row.stripe_payment_intent_id
    && intent.metadata?.street_payment_id === row.id
    && intent.metadata?.driver_id === row.driver_id
    && intent.currency === 'sek' && intent.amount === row.amount_ore
    && intent.livemode === true
    && intent.payment_method_types?.includes('card_present');
}
export function confirmedTerminalPayment(row: any, intent: any): boolean {
  return terminalPaymentMatches(row, intent) && intent.status === 'succeeded'
    && intent.amount_received === row.amount_ore;
}
