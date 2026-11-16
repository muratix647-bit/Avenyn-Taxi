ALTER TABLE public.customer_sms_deliveries DROP CONSTRAINT customer_sms_deliveries_kind_check;
ALTER TABLE public.customer_sms_deliveries ADD CONSTRAINT customer_sms_deliveries_kind_check
CHECK (kind IN ('pickup_reminder','flight_alert','booking_confirmation','payment_link'));

CREATE UNIQUE INDEX payment_requests_one_open_sms_checkout
ON public.payment_requests (booking_id,amount_sek)
WHERE source='dispatch' AND status IN ('creating','pending');
