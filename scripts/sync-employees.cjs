#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, 'utf8');
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

const defaultConfigPath = path.join(process.cwd(), 'employees.json');
const args = process.argv.slice(2);
const fileFlagIndex = args.indexOf('--file');
const configPath =
  fileFlagIndex !== -1 && args[fileFlagIndex + 1]
    ? path.resolve(process.cwd(), args[fileFlagIndex + 1])
    : defaultConfigPath;

if (!fs.existsSync(configPath)) {
  console.error(`Missing employees config: ${configPath}`);
  process.exit(1);
}

loadEnvFile(path.join(process.cwd(), '.env.local'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function listAllUsers() {
  const all = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    all.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }
  return all;
}

const locationCache = new Map();
async function resolveLocationId(airportCode, locationCode) {
  if (!airportCode || !locationCode) return null;
  const key = `${airportCode}:${locationCode}`;
  if (locationCache.has(key)) return locationCache.get(key);
  const { data, error } = await supabase
    .from('locations')
    .select('id')
    .eq('airport_code', airportCode)
    .eq('code', locationCode)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`Location not found for ${airportCode} ${locationCode}`);
  }
  locationCache.set(key, data.id);
  return data.id;
}

async function ensureEmployeeProfile({ userId, role, airportCode, locationCode }) {
  const locationId = await resolveLocationId(airportCode, locationCode);
  const { error } = await supabase.from('employee_profiles').upsert(
    {
      user_id: userId,
      role,
      location_id: locationId,
      is_open: true,
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

async function syncEmployees() {
  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);
  const admins = Array.isArray(config.admins) ? config.admins : [];
  const locations = Array.isArray(config.locations) ? config.locations : [];
  const entries = [...admins, ...locations];

  if (entries.length === 0) {
    console.error('No employees found in employees.json.');
    process.exit(1);
  }

  const users = await listAllUsers();
  const userByEmail = new Map(
    users
      .filter((user) => user?.email)
      .map((user) => [user.email.toLowerCase(), user])
  );

  for (const entry of entries) {
    const email = entry.email?.toLowerCase();
    const password = entry.password;
    const role = entry.role || 'employee';
    if (!email || !password) {
      console.error('Skipping entry with missing email/password.');
      continue;
    }

    let user = userByEmail.get(email);
    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      user = data.user;
      userByEmail.set(email, user);
      console.log(`Created auth user: ${email}`);
    } else {
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
      });
      if (error) throw error;
      console.log(`Updated auth user password: ${email}`);
    }

    await ensureEmployeeProfile({
      userId: user.id,
      role,
      airportCode: entry.airport_code,
      locationCode: entry.location_code,
    });
    console.log(`Upserted employee profile: ${email} (${role})`);
  }
}

syncEmployees().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Failed to sync employees.');
  process.exit(1);
});
