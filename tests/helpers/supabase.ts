import fs from 'fs';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type TestEnv = {
  url: string;
  anonKey: string;
  serviceKey?: string;
};

let loaded = false;

function loadEnvLocal() {
  if (loaded) return;
  loaded = true;
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const contents = fs.readFileSync(envPath, 'utf8');
  contents.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

export function getTestEnv(): TestEnv | null {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return {
    url,
    anonKey,
    serviceKey: process.env.SUPABASE_SECRET_KEY,
  };
}

export function createAnonClient(env: TestEnv) {
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createServiceClient(env: TestEnv): SupabaseClient {
  if (!env.serviceKey) {
    throw new Error('Missing SUPABASE_SECRET_KEY for service client');
  }
  return createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function randomPhone() {
  const base = Math.floor(1000000000 + Math.random() * 9000000000);
  return `+1${base}`;
}
