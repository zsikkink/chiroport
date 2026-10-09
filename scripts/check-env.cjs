#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

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

loadEnvFile(path.join(process.cwd(), '.env.local'));

if (process.env.CHIROPORT_LOCAL_DEMO === '1') {
  let host;
  try { host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname; } catch { /* rejected below */ }
  const missing = ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SECRET_KEY', 'SEND_SMS_SECRET'].filter(key => !process.env[key]);
  const providerConfigured = Object.keys(process.env).some(key => key.startsWith('TWILIO_') && process.env[key]);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host) || missing.length || providerConfigured) {
    console.error('Local synthetic mode requires loopback Supabase, local app/worker keys, and no Twilio credentials.');
    process.exit(1);
  }
  console.log('Local synthetic environment verified; provider sending is unavailable. Production configuration was not checked.');
  process.exit(0);
}

if (process.env.CI && process.env.SKIP_ENV_CHECK !== '0') {
  console.log('Skipping env check in CI.');
  process.exit(0);
}

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SECRET_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_API_KEY_SID',
  'TWILIO_API_KEY_SECRET',
  'SEND_SMS_SECRET',
];

const hasMessagingService = Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID);
const hasFromNumber = Boolean(process.env.TWILIO_FROM_NUMBER);
if (!hasMessagingService && !hasFromNumber) {
  required.push('TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER');
}

const missing = required.filter((key) => {
  if (key.includes(' or ')) return true;
  return !process.env[key];
});

if (missing.length > 0) {
  console.error('Missing required environment variables:');
  missing.forEach((key) => console.error(`- ${key}`));
  process.exit(1);
}

console.log('Environment check passed.');
