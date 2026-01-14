begin;

-- Warn if required vault secrets for send_sms scheduling are missing.
do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('vault.decrypted_secrets') is null then
    raise warning 'Vault extension not available; send_sms schedule may fail without secrets';
    return;
  end if;

  if not exists (
    select 1 from vault.decrypted_secrets where name = 'project_url'
  ) then
    v_missing := array_append(v_missing, 'project_url');
  end if;

  if not exists (
    select 1 from vault.decrypted_secrets where name = 'send_sms_secret'
  ) then
    v_missing := array_append(v_missing, 'send_sms_secret');
  end if;

  if array_length(v_missing, 1) is not null then
    raise warning 'Missing vault secrets: %', array_to_string(v_missing, ', ');
  end if;
end $$;

commit;
