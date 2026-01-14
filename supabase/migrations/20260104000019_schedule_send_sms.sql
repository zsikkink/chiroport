begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- Schedule the send_sms Edge Function via pg_cron + pg_net.
-- Requires vault secrets: project_url and send_sms_secret.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'send_sms_minutely') then
    perform cron.unschedule('send_sms_minutely');
  end if;
end $$;

select
  cron.schedule(
    'send_sms_minutely',
    '*/1 * * * *',
    $$
    select
      net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
          || '/functions/v1/send_sms',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-sms-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'send_sms_secret')
        ),
        body := '{}'::jsonb
      );
    $$
  );

commit;
