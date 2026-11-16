-- Keep the existing service-role-only access and RLS on driver_payments.
alter table public.driver_payments
  add column if not exists payment_channel text not null default 'payment_link' check (payment_channel in ('payment_link','tap_to_pay')),
  add column if not exists stripe_payment_intent_id text unique,
  add column if not exists receipt_url text;
