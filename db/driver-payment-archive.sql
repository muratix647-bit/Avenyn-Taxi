alter table public.driver_payments add column if not exists archived_at timestamptz;
create index if not exists driver_payments_visible_driver_created on public.driver_payments(driver_id,created_at desc) where archived_at is null;
-- Archives preserve paid records for reporting, processor sync and receipts.
