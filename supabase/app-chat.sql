-- Private app chat. Only the server can call this API after verifying the login.
create table public.app_chat_threads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('trip','dispatch')),
  booking_id uuid references public.bookings(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  customer_read_id bigint not null default 0,
  driver_read_id bigint not null default 0,
  dispatch_read_id bigint not null default 0,
  created_at timestamptz not null default now(),
  check ((kind='trip' and booking_id is not null) or (kind='dispatch' and booking_id is null))
);
create unique index app_chat_trip_unique on public.app_chat_threads(booking_id,driver_id) where kind='trip';
create unique index app_chat_dispatch_unique on public.app_chat_threads(driver_id) where kind='dispatch';
create table public.app_chat_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.app_chat_threads(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer','driver','dispatch')),
  sender_user_id uuid,
  request_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique(thread_id,sender_role,request_id)
);
create index app_chat_messages_thread_id on public.app_chat_messages(thread_id,id desc);
alter table public.app_chat_threads enable row level security;
alter table public.app_chat_messages enable row level security;
revoke all on public.app_chat_threads,public.app_chat_messages from public,anon,authenticated;
revoke all on sequence public.app_chat_messages_id_seq from public,anon,authenticated;
grant all on public.app_chat_threads,public.app_chat_messages to service_role;
grant usage,select on sequence public.app_chat_messages_id_seq to service_role;

create function public.app_chat(
 p_role text, p_action text, p_user_id uuid default null, p_tracking_token uuid default null,
 p_booking_id uuid default null, p_driver_id uuid default null, p_text text default null,
 p_request_id uuid default null, p_before bigint default null, p_seen bigint default null, p_thread_id uuid default null
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare
 v_driver uuid; v_booking public.bookings%rowtype; v_thread public.app_chat_threads%rowtype;
 v_kind text; v_title text; v_writable boolean; v_result jsonb; v_messages jsonb;
 v_saved bigint; v_seen bigint; v_peer bigint;
begin
 if p_role not in ('customer','driver','dispatch') or p_role is null then raise exception 'chat_forbidden' using errcode='42501'; end if;
 if p_action not in ('inbox','read','send','seen') or p_action is null then raise exception 'chat_invalid' using errcode='22023'; end if;
 if p_role='driver' then
   select id into v_driver from public.drivers where auth_user_id=p_user_id and active and approved and archived_at is null;
   if v_driver is null then raise exception 'chat_forbidden' using errcode='42501'; end if;
 elsif p_role='dispatch' then
   if not exists(select 1 from public.dispatch_admins where auth_user_id=p_user_id and active) then raise exception 'chat_forbidden' using errcode='42501'; end if;
 else
   select * into v_booking from public.bookings where tracking_token=p_tracking_token and archived_at is null;
   if v_booking.id is null then raise exception 'chat_forbidden' using errcode='42501'; end if;
   -- A customer cannot substitute another trip or open a dispatch conversation.
   if p_driver_id is not null or (p_booking_id is not null and p_booking_id<>v_booking.id) then raise exception 'chat_forbidden' using errcode='42501'; end if;
 end if;

 if p_action='inbox' then
   with candidates as (
     select 'dispatch'::text kind,null::uuid booking_id,d.id driver_id,
       case when p_role='driver' then 'Trafikledningen' else d.full_name end title,
       'Förare ↔ trafikledning'::text subtitle
     from public.drivers d where d.active and d.approved and d.archived_at is null
       and (p_role='dispatch' or (p_role='driver' and d.id=v_driver))
     union all
     select 'trip',b.id,b.driver_id,
       case when p_role='customer' then 'Din förare · '||d.full_name else 'Kund · körning #'||b.booking_number::text end,
       b.pickup_address||' → '||b.dropoff_address
     from public.bookings b join public.drivers d on d.id=b.driver_id
     where b.archived_at is null and d.active and d.approved and d.archived_at is null
       and b.status in ('accepted','en_route','arrived','passenger_onboard','completed','cancelled')
       and ((p_role='driver' and b.driver_id=v_driver) or (p_role='customer' and b.id=v_booking.id))
       and (b.status not in ('completed','cancelled') or exists(select 1 from public.app_chat_threads t where t.booking_id=b.id and t.driver_id=b.driver_id))
   ), inbox as (
     select c.*,t.id thread_id, m.body last_message,m.created_at last_at,
       (select count(*) from public.app_chat_messages u where u.thread_id=t.id and u.sender_role<>p_role and u.id>
         case p_role when 'customer' then t.customer_read_id when 'driver' then t.driver_read_id else t.dispatch_read_id end) unread
     from candidates c left join public.app_chat_threads t on t.kind=c.kind and t.driver_id=c.driver_id and t.booking_id is not distinct from c.booking_id
     left join lateral (select body,created_at from public.app_chat_messages where thread_id=t.id order by id desc limit 1) m on true
   ) select coalesce(jsonb_agg(to_jsonb(i) order by i.unread desc,i.last_at desc nulls last,i.title),'[]') into v_result from inbox i;
   return jsonb_build_object('conversations',v_result);
 end if;

 if p_role='customer' or p_booking_id is not null then
   if p_role='dispatch' then raise exception 'chat_forbidden' using errcode='42501'; end if;
   -- Lock the booking so reassignment cannot race a send/read.
   select * into v_booking from public.bookings where id=coalesce(v_booking.id,p_booking_id) and archived_at is null for share;
   if v_booking.id is null or v_booking.driver_id is null or v_booking.status not in ('accepted','en_route','arrived','passenger_onboard','completed','cancelled')
     or (p_role='driver' and v_booking.driver_id is distinct from v_driver)
     or not exists(select 1 from public.drivers where id=v_booking.driver_id and active and approved and archived_at is null)
   then raise exception 'chat_forbidden' using errcode='42501'; end if;
   v_driver:=v_booking.driver_id; v_kind:='trip';
   v_writable:=v_booking.status in ('accepted','en_route','arrived','passenger_onboard');
   v_title:=case when p_role='customer' then 'Meddelanden till din förare' else 'Kund · körning #'||v_booking.booking_number::text end;
   insert into public.app_chat_threads(kind,booking_id,driver_id) values ('trip',v_booking.id,v_driver) on conflict do nothing;
   select * into v_thread from public.app_chat_threads where kind='trip' and booking_id=v_booking.id and driver_id=v_driver for update;
 else
   if p_role='dispatch' then v_driver:=p_driver_id; end if;
   if v_driver is null or not exists(select 1 from public.drivers where id=v_driver and active and approved and archived_at is null) then raise exception 'chat_forbidden' using errcode='42501'; end if;
   -- Drivers may never use a supplied driver id to address another driver's inbox.
   if p_role='driver' and p_driver_id is not null and p_driver_id<>v_driver then raise exception 'chat_forbidden' using errcode='42501'; end if;
   v_kind:='dispatch'; v_writable:=true;
   select case when p_role='driver' then 'Trafikledningen' else full_name end into v_title from public.drivers where id=v_driver;
   insert into public.app_chat_threads(kind,driver_id) values ('dispatch',v_driver) on conflict do nothing;
   select * into v_thread from public.app_chat_threads where kind='dispatch' and driver_id=v_driver for update;
 end if;

 if p_action='send' then
   if p_thread_id is not null and p_thread_id<>v_thread.id then raise exception 'chat_changed' using errcode='22023'; end if;
   if not v_writable then raise exception 'chat_closed' using errcode='22023'; end if;
   if p_request_id is null or p_text is null or char_length(btrim(p_text)) not between 1 and 2000 then raise exception 'chat_invalid' using errcode='22023'; end if;
   select id into v_saved from public.app_chat_messages where thread_id=v_thread.id and sender_role=p_role and request_id=p_request_id;
   if v_saved is null then
     if (select count(*) from public.app_chat_messages where thread_id=v_thread.id and sender_role=p_role and created_at>now()-interval '1 minute')>=20 then raise exception 'chat_rate_limit' using errcode='P0001'; end if;
     insert into public.app_chat_messages(thread_id,sender_role,sender_user_id,request_id,body)
       values(v_thread.id,p_role,p_user_id,p_request_id,btrim(p_text)) returning id into v_saved;
   end if;
 end if;
 if p_action='seen' then
   select coalesce(max(id),0) into v_seen from public.app_chat_messages where thread_id=v_thread.id and id<=coalesce(p_seen,0);
   update public.app_chat_threads set
     customer_read_id=case when p_role='customer' then greatest(customer_read_id,v_seen) else customer_read_id end,
     driver_read_id=case when p_role='driver' then greatest(driver_read_id,v_seen) else driver_read_id end,
     dispatch_read_id=case when p_role='dispatch' then greatest(dispatch_read_id,v_seen) else dispatch_read_id end
   where id=v_thread.id;
   return jsonb_build_object('ok',true);
 end if;
 v_peer:=case when p_role='driver' then case when v_kind='trip' then v_thread.customer_read_id else v_thread.dispatch_read_id end else v_thread.driver_read_id end;
 select coalesce(jsonb_agg(to_jsonb(m) order by m.id::bigint),'[]') into v_messages from (
   select id::text id, sender_role,body,created_at from public.app_chat_messages
   where thread_id=v_thread.id and (p_before is null or id<p_before) order by app_chat_messages.id desc limit 100
 ) m;
 return jsonb_build_object('threadId',v_thread.id,'title',v_title,'writable',v_writable,'messages',v_messages,'peerReadId',v_peer::text,'savedId',v_saved::text);
end $$;
revoke all on function public.app_chat(text,text,uuid,uuid,uuid,uuid,text,uuid,bigint,bigint,uuid) from public,anon,authenticated;
grant execute on function public.app_chat(text,text,uuid,uuid,uuid,uuid,text,uuid,bigint,bigint,uuid) to service_role;
