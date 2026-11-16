create table if not exists public.site_visits (
  visit_date date not null default current_date,
  visitor_id uuid not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  view_count integer not null default 1 check (view_count > 0),
  last_path text,
  primary key (visit_date, visitor_id)
);
alter table public.site_visits enable row level security;

create or replace function public.record_site_visit(p_visitor_id uuid,p_path text default '/')
returns void language sql security definer set search_path=public as $$
  insert into public.site_visits(visit_date,visitor_id,last_path)
  values((now() at time zone 'Europe/Stockholm')::date,p_visitor_id,left(coalesce(p_path,'/'),200))
  on conflict(visit_date,visitor_id) do update set last_seen_at=now(),view_count=public.site_visits.view_count+1,last_path=excluded.last_path;
$$;
revoke all on function public.record_site_visit(uuid,text) from public;
grant execute on function public.record_site_visit(uuid,text) to anon,authenticated,service_role;

create or replace function public.get_site_visit_stats()
returns table(today_visitors bigint,week_visitors bigint,month_visitors bigint,total_visitors bigint,total_page_views bigint)
language plpgsql security definer set search_path=public as $$
declare v_today date:=(now() at time zone 'Europe/Stockholm')::date;
begin
  if not public.is_dispatch_admin() then raise exception 'Endast dispatch'; end if;
  return query select count(distinct visitor_id) filter(where visit_date=v_today),count(distinct visitor_id) filter(where visit_date>=v_today-6),count(distinct visitor_id) filter(where visit_date>=date_trunc('month',v_today)::date),count(distinct visitor_id),coalesce(sum(view_count),0)::bigint from public.site_visits;
end $$;
revoke all on function public.get_site_visit_stats() from public;
grant execute on function public.get_site_visit_stats() to authenticated;
