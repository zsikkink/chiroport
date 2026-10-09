begin;

-- First persisted receipt is the ordering source, not vendor send time (which
-- this callback does not establish). STOP wins equal timestamps. Retrying an
-- older provider SID reconciles the latest recorded intent, never the old body.
create index idx_sms_inbound_preference_order
  on public.sms_inbound (from_phone, received_at desc);

create function public.apply_sms_preference(p_inbound_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_inbound public.sms_inbound;
  v_latest public.sms_inbound;
  -- ECMAScript trim whitespace, matching the existing webhook contract.
  v_trim_chars constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  select * into strict v_inbound from public.sms_inbound where id=p_inbound_id;
  if v_inbound.from_phone !~ '^\+[1-9][0-9]{7,14}$'
     or nullif(btrim(v_inbound.provider_message_id), '') is null
     or lower(btrim(v_inbound.body, v_trim_chars)) not in ('stop', 'start') then
    raise exception 'A valid recorded preference and stable provider identity are required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('sms-preference:' || v_inbound.from_phone, 0));
  select * into strict v_latest from public.sms_inbound
  where from_phone=v_inbound.from_phone and lower(btrim(body, v_trim_chars)) in ('stop', 'start')
    and nullif(btrim(provider_message_id), '') is not null
  order by received_at desc, (lower(btrim(body, v_trim_chars))='stop') desc, id desc
  limit 1;
  if lower(btrim(v_latest.body, v_trim_chars))='stop' then
    insert into public.sms_opt_outs(phone_e164, opted_out_at, source)
    values(v_latest.from_phone, v_latest.received_at, 'twilio_webhook')
    on conflict(phone_e164) do update
      set opted_out_at=excluded.opted_out_at, source=excluded.source;
  else
    delete from public.sms_opt_outs where phone_e164=v_latest.from_phone;
  end if;
end;
$$;

revoke all on function public.apply_sms_preference(uuid) from public, anon, authenticated;
grant execute on function public.apply_sms_preference(uuid) to service_role;
commit;
