import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1?target=deno&deno-std=0.224.0';
import { requireEnv } from './env.ts';

export function createServiceRoleClient() {
  const url = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'chiroport-edge' } },
  });
}

export function createAuthedClient(authHeader: string) {
  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');

  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader, 'X-Client-Info': 'chiroport-edge' } },
  });
}
