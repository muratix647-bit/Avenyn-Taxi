-- Online cars with fresh GPS have priority. Offline/stale cars may receive a
-- reserve push offer within the service area; never force them online.
do $migration$
declare s text;
begin
 s:=pg_get_functiondef('public.dispatch_auto_assign(uuid,text)'::regprocedure);
 if position('reservförfrågan' in s)>0 then return; end if;
 if position($s$d.is_online and d.availability_status='available'$s$ in s)=0 then raise exception 'Unexpected dispatch function'; end if;
 s:=replace(s,$s$d.is_online and d.availability_status='available'$s$,$s$d.availability_status in ('available','offline')$s$);
 s:=replace(s,$s$and l.updated_at between now()-interval '3 minutes' and now()+interval '1 minute'$s$,$s$and ((d.is_online and d.availability_status='available' and l.updated_at between now()-interval '3 minutes' and now()+interval '1 minute')
 or (l.updated_at between now()-interval '24 hours' and now()+interval '1 minute' and exists(select 1 from public.driver_push_subscriptions ps where ps.driver_id=d.id)))$s$);
 s:=replace(s,'order by extensions.st_distance',$s$order by case when d.is_online and d.availability_status='available' and l.updated_at>=now()-interval '3 minutes' then 0 else 1 end,
 case when d.is_online and d.availability_status='available' and l.updated_at>=now()-interval '3 minutes' then extensions.st_distance$s$);
 s:=replace(s,'::extensions.geography),l.updated_at desc,d.id','::extensions.geography) end,l.updated_at desc,d.id');
 s:=replace(s,'Erbjudande till närmaste lediga lämpliga bil med färsk GPS','Automatisk förfrågan. Färsk online-GPS prioriteras; därefter reservförfrågan via push (position högst 24 timmar gammal).');
 execute s;
end $migration$;
