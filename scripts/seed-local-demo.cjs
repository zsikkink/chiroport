const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
async function main() {
  assert.equal(process.env.CHIROPORT_LOCAL_DEMO, '1', 'Explicit synthetic mode required');
  assert(['127.0.0.1', 'localhost'].includes(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname), 'Loopback Supabase required');
  assert(!Object.keys(process.env).some(key => key.startsWith('TWILIO_') && process.env[key]), 'No provider credentials permitted');
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.admin.createUser({ email: 'demo-staff@example.invalid', password: 'Synthetic-Only-2468!', email_confirm: true });
  assert.ifError(error);
  const result = await client.from('employee_profiles').insert({ user_id: data.user.id, role: 'admin', is_open: true });
  if (result.error) {
    const cleanup = await client.auth.admin.deleteUser(data.user.id);
    if (cleanup.error) console.error('Synthetic account cleanup failed; inspect the disposable local project.');
  }
  assert.ifError(result.error);
  console.log('Created synthetic local staff prerequisite; no visits or communications fabricated.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
