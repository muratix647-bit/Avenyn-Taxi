revoke all on table public.driver_trip_accounting_edits from anon, authenticated;

create index if not exists driver_trip_accounting_edits_auth_user_idx
  on public.driver_trip_accounting_edits (changed_by_auth_user, changed_at desc);
