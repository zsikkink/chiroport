const { execFileSync } = require('node:child_process');

const EXPECTED_ACCESS = {
  'advance_queue(uuid)': ['service_role'],
  'apply_sms_preference(uuid)': ['service_role'],
  'backfill_queue_daily_stats(date,date)': ['service_role'],
  'backfill_queue_rollups(date,date)': ['service_role'],
  'cancel_visit(uuid)': ['anon', 'authenticated', 'service_role'],
  'cancel_visit_with_reason(uuid,text)': ['anon', 'authenticated', 'service_role'],
  'copy_queue_outcome_to_archive()': [],
  'capture_queue_entry_legal_archive()': [],
  'check_rate_limit(text,integer,integer)': ['service_role'],
  'check_rate_limits(jsonb)': ['service_role'],
  'claim_sms_outbox(integer,integer,uuid)': ['service_role'],
  'customer_cancel_queue_entry(uuid,text,boolean)': ['service_role'],
  'enqueue_queue_messages()': [],
  'get_admin_analytics(uuid,date,date,text)': ['service_role'],
  'get_admin_dashboard_scopes(date,date,uuid,text)': ['service_role'],
  'get_admin_workforce_analytics(date,date,uuid,text)': ['service_role'],
  'get_admin_daily_repeat_share(uuid,date,date)': ['service_role'],
  'get_visit(uuid)': ['anon', 'authenticated', 'service_role'],
  'is_admin()': ['authenticated'],
  'is_employee()': ['authenticated'],
  'join_queue(text,text,text,text,text,customer_type,uuid)': [],
  'join_queue(text,text,text,text,text,customer_type,uuid,text)': [],
  'join_queue_with_offering(text,text,text,text,text,text)': ['service_role'],
  'jsonb_sum(jsonb,jsonb)': [],
  'jsonb_sum_agg(jsonb)': [],
  'jsonb_sum_agg(jsonb[])': [],
  'mark_next_queue_entry(uuid,uuid)': [],
  'next_sort_key(uuid,customer_type)': [],
  'prevent_queue_entries_legal_archive_mutation()': [],
  'queue_customer_priority(customer_type)': ['authenticated', 'service_role'],
  'queue_entries_auto_next()': [],
  'queue_rollup_sanity_check(date)': ['service_role'],
  'rebuild_queue_monthly_stats(date,date)': ['service_role'],
  'record_sms_inbound(text,text,text,text,jsonb)': ['service_role'],
  'record_customer_cancel_reason(text,text)': ['service_role'],
  'reorder_entry(uuid,uuid,uuid)': ['service_role'],
  'rollup_queue_daily_stats(timestamp with time zone)': ['service_role'],
  'rollup_queue_monthly_stats()': ['service_role'],
  'set_updated_at()': [],
  'staff_enqueue_message(uuid,uuid,text)': ['service_role'],
  'staff_edit_queue_entry(uuid,uuid,text,text,text,text)': ['service_role'],
  'staff_queue_entry_action(uuid,text,uuid,uuid)': ['service_role'],
  'staff_queue_entry_action(uuid,text,uuid,uuid,text)': ['service_role'],
};

const DATABASE_URL =
  process.env.SUPABASE_DB_URL ||
  process.env.DB_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

function assertSafeDatabaseTarget(databaseUrl) {
  const hostname = new URL(databaseUrl).hostname;
  if (
    hostname !== '127.0.0.1' &&
    hostname !== 'localhost' &&
    process.env.CHIROPORT_ALLOW_REMOTE_DB_CHECK !== '1'
  ) {
    throw new Error(
      'Refusing to inspect a non-local database without CHIROPORT_ALLOW_REMOTE_DB_CHECK=1'
    );
  }
}

function loadPrivilegeState(databaseUrl = DATABASE_URL) {
  assertSafeDatabaseTarget(databaseUrl);
  const sql = String.raw`
    with function_access as (
      select
        p.oid::regprocedure::text as signature,
        p.prosecdef as security_definer,
        exists (
          select 1
          from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
          where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
        ) as public_execute,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
        has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
    ),
    default_access as (
      select
        pg_get_userbyid(d.defaclrole) as owner,
        exists (
          select 1
          from aclexplode(d.defaclacl) acl
          where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
        ) as public_execute,
        exists (
          select 1 from aclexplode(d.defaclacl) acl
          where acl.grantee = 'anon'::regrole and acl.privilege_type = 'EXECUTE'
        ) as anon_execute,
        exists (
          select 1 from aclexplode(d.defaclacl) acl
          where acl.grantee = 'authenticated'::regrole and acl.privilege_type = 'EXECUTE'
        ) as authenticated_execute,
        exists (
          select 1 from aclexplode(d.defaclacl) acl
          where acl.grantee = 'service_role'::regrole and acl.privilege_type = 'EXECUTE'
        ) as service_role_execute
      from pg_default_acl d
      join pg_namespace n on n.oid = d.defaclnamespace
      where n.nspname = 'public'
        and d.defaclobjtype = 'f'
        and pg_get_userbyid(d.defaclrole) = 'postgres'
    )
    select json_build_object(
      'functions', coalesce((select json_agg(function_access order by signature) from function_access), '[]'::json),
      'defaults', coalesce((select json_agg(default_access order by owner) from default_access), '[]'::json)
    )::text;
  `;
  const raw = execFileSync(
    'psql',
    [databaseUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-c', sql],
    { encoding: 'utf8' }
  ).trim();
  return JSON.parse(raw);
}

function checkDatabasePrivileges(databaseUrl = DATABASE_URL) {
  const state = loadPrivilegeState(databaseUrl);
  const failures = [];
  const actualSignatures = new Set(state.functions.map((row) => row.signature));

  for (const signature of Object.keys(EXPECTED_ACCESS)) {
    if (!actualSignatures.has(signature)) failures.push(`Missing function: ${signature}`);
  }

  for (const row of state.functions) {
    const expected = EXPECTED_ACCESS[row.signature];
    if (!expected) {
      failures.push(`Unclassified function: ${row.signature}`);
      continue;
    }
    if (row.public_execute) failures.push(`PUBLIC can execute ${row.signature}`);
    for (const [role, property] of [
      ['anon', 'anon_execute'],
      ['authenticated', 'authenticated_execute'],
      ['service_role', 'service_role_execute'],
    ]) {
      const shouldExecute = expected.includes(role);
      if (row[property] !== shouldExecute) {
        failures.push(
          `${role} execute mismatch for ${row.signature}: expected ${shouldExecute}, got ${row[property]}`
        );
      }
    }
  }

  const defaultOwners = new Set(state.defaults.map((row) => row.owner));
  for (const owner of ['postgres']) {
    if (!defaultOwners.has(owner)) failures.push(`Missing function default ACL for ${owner}`);
  }
  for (const row of state.defaults) {
    if (
      row.public_execute ||
      row.anon_execute ||
      row.authenticated_execute ||
      row.service_role_execute
    ) {
      failures.push(`Function defaults for ${row.owner} are not deny-by-default`);
    }
  }

  if (failures.length) {
    throw new Error(`Database privilege contract failed:\n- ${failures.join('\n- ')}`);
  }
  return state;
}

if (require.main === module) {
  const state = checkDatabasePrivileges();
  process.stdout.write(
    `Database privilege contract passed (${state.functions.length} functions; ${state.defaults.length} default ACL owners).\n`
  );
}

module.exports = { EXPECTED_ACCESS, checkDatabasePrivileges, loadPrivilegeState };
