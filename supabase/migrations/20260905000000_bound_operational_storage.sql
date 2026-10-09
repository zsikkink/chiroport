begin;

-- pg_cron is installed by 20260104000019_schedule_send_sms.sql.
-- Keep jobs owned by the durable database role, not a temporary CLI login.
set local role postgres;

-- Named schedules are upserts, so replaying this migration does not duplicate jobs.
select cron.schedule(
  'storage_cron_retention',
  '20 9 * * *',
  $command$
    set lock_timeout = '5s';
    set statement_timeout = '60s';
    delete from cron.job_run_details
    where end_time is not null
      and (
        (status = 'succeeded' and end_time < now() - interval '7 days')
        or (status = 'failed' and end_time < now() - interval '30 days')
      );
  $command$
);

select cron.schedule(
  'storage_rate_limit_retention',
  '22 9 * * *',
  $command$
    set lock_timeout = '5s';
    set statement_timeout = '60s';
    -- DELETE rechecks this predicate after a concurrent updater releases its lock.
    -- Do not select bucket IDs first and then delete without the expiry predicate.
    delete from public.api_rate_limits
    where reset_at < now() - interval '1 day';
  $command$
);

select cron.schedule(
  'storage_operational_vacuum',
  '30 9 * * *',
  -- Must be a single top-level statement; never wrap VACUUM in a transaction.
  -- FULL is deliberately only a one-time recovery operation, not a daily rewrite.
  $command$vacuum (analyze) cron.job_run_details, net._http_response, public.api_rate_limits;$command$
);

commit;
