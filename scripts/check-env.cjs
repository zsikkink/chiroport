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
