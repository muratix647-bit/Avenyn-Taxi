-- Integration tests use synthetic records and roll back every inserted row.
begin;
do $$
declare
 u1 uuid:=gen_random_uuid(); u2 uuid:=gen_random_uuid(); ua uuid:=gen_random_uuid();
 d1 uuid:=gen_random_uuid(); d2 uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); tk uuid:=gen_random_uuid();
 req uuid:=gen_random_uuid(); j jsonb; k jsonb; tid uuid; mid bigint; n integer;
begin
 if has_function_privilege('anon','public.app_chat(text,text,uuid,uuid,uuid,uuid,text,uuid,bigint,bigint,uuid)','EXECUTE') or
    has_function_privilege('authenticated','public.app_chat(text,text,uuid,uuid,uuid,uuid,text,uuid,bigint,bigint,uuid)','EXECUTE') then raise exception 'public RPC exposure'; end if;
 if has_table_privilege('anon','public.app_chat_messages','SELECT') or has_table_privilege('authenticated','public.app_chat_messages','INSERT') then raise exception 'public table exposure'; end if;
 insert into auth.users(id,email,raw_user_meta_data) values(u1,'chat-test-'||u1||'@example.invalid','{}'),(u2,'chat-test-'||u2||'@example.invalid','{}'),(ua,'chat-test-'||ua||'@example.invalid','{}');
 insert into public.drivers(id,auth_user_id,full_name,active,approved) values(d1,u1,'Chat test driver 1',true,true),(d2,u2,'Chat test driver 2',true,true);
 insert into public.dispatch_admins(auth_user_id,full_name,active) values(ua,'Chat test dispatcher',true);
 -- Accepted + assigned fixture avoids all dispatch/pool push triggers.
 insert into public.bookings(id,customer_name,pickup_address,dropoff_address,booking_date,pickup_time,status,driver_id,tracking_token,booking_number)
 overriding system value values(b,'Chat test','Test A','Test B',current_date,'12:00','accepted',d1,tk,-900000001);
 j:=public.app_chat('customer','send',p_tracking_token=>tk,p_text=>'Hej från kund',p_request_id=>req);
 tid:=(j->>'threadId')::uuid; mid:=(j->>'savedId')::bigint;
 if jsonb_array_length(j->'messages')<>1 then raise exception 'customer send failed'; end if;
 k:=public.app_chat('customer','send',p_tracking_token=>tk,p_text=>'Hej från kund',p_request_id=>req);
 if k->>'savedId'<>j->>'savedId' or jsonb_array_length(k->'messages')<>1 then raise exception 'retry duplicated message'; end if;
 j:=public.app_chat('driver','inbox',p_user_id=>u1);
 select (x->>'unread')::integer into n from jsonb_array_elements(j->'conversations') x where x->>'booking_id'=b::text;
 if n<>1 then raise exception 'unread failed'; end if;
 perform public.app_chat('driver','seen',p_user_id=>u1,p_booking_id=>b,p_seen=>mid);
 j:=public.app_chat('customer','read',p_tracking_token=>tk);
 if (j->>'peerReadId')::bigint<>mid then raise exception 'read receipt failed'; end if;
 j:=public.app_chat('driver','send',p_user_id=>u1,p_booking_id=>b,p_text=>'Hej från förare',p_request_id=>gen_random_uuid());
 if jsonb_array_length(j->'messages')<>2 then raise exception 'driver reply failed'; end if;
 begin perform public.app_chat('driver','read',p_user_id=>u2,p_booking_id=>b); raise exception 'other driver could read'; exception when insufficient_privilege then null; end;
 begin perform public.app_chat('customer','read',p_tracking_token=>gen_random_uuid()); raise exception 'invalid token allowed'; exception when insufficient_privilege then null; end;
 begin perform public.app_chat('customer','read',p_tracking_token=>tk,p_driver_id=>d1); raise exception 'customer accessed dispatch'; exception when insufficient_privilege then null; end;
 begin perform public.app_chat('dispatch','read',p_user_id=>ua,p_booking_id=>b); raise exception 'dispatcher accessed customer thread'; exception when insufficient_privilege then null; end;
 begin perform public.app_chat('dispatch','inbox',p_user_id=>u1); raise exception 'driver became dispatcher'; exception when insufficient_privilege then null; end;
 j:=public.app_chat('driver','send',p_user_id=>u1,p_text=>'Hej trafikledning',p_request_id=>gen_random_uuid());
 if jsonb_array_length(j->'messages')<>1 then raise exception 'driver dispatch send failed'; end if;
 j:=public.app_chat('dispatch','send',p_user_id=>ua,p_driver_id=>d1,p_text=>'Hej förare',p_request_id=>gen_random_uuid());
 if jsonb_array_length(j->'messages')<>2 then raise exception 'dispatch reply failed'; end if;
 begin perform public.app_chat('driver','read',p_user_id=>u2,p_driver_id=>d1); raise exception 'other driver accessed dispatch thread'; exception when insufficient_privilege then null; end;
 begin perform public.app_chat('driver','send',p_user_id=>u1,p_text=>' ',p_request_id=>gen_random_uuid()); raise exception 'empty message allowed'; exception when invalid_parameter_value then null; end;
 update public.bookings set status='assigned' where id=b;
 begin perform public.app_chat('driver','read',p_user_id=>u1,p_booking_id=>b); raise exception 'unaccepted trip allowed'; exception when insufficient_privilege then null; end;
 update public.bookings set status='accepted',driver_id=d2 where id=b;
 begin perform public.app_chat('driver','read',p_user_id=>u1,p_booking_id=>b); raise exception 'former driver allowed'; exception when insufficient_privilege then null; end;
 j:=public.app_chat('driver','read',p_user_id=>u2,p_booking_id=>b);
 if jsonb_array_length(j->'messages')<>0 then raise exception 'previous conversation leaked'; end if;
 begin perform public.app_chat('customer','send',p_tracking_token=>tk,p_text=>'Stale draft',p_request_id=>gen_random_uuid(),p_thread_id=>tid); raise exception 'stale draft went to new driver'; exception when invalid_parameter_value then null; end;
 update public.bookings set status='completed' where id=b;
 j:=public.app_chat('customer','read',p_tracking_token=>tk);
 if (j->>'writable')::boolean then raise exception 'completed chat writable'; end if;
 begin perform public.app_chat('customer','send',p_tracking_token=>tk,p_text=>'Closed',p_request_id=>gen_random_uuid()); raise exception 'closed send allowed'; exception when invalid_parameter_value then null; end;
 update public.drivers set approved=false where id=d2;
 begin perform public.app_chat('driver','inbox',p_user_id=>u2); raise exception 'unapproved driver allowed'; exception when insufficient_privilege then null; end;
end $$;
select 'chat integration tests passed; all fixtures rolled back' as result;
rollback;
