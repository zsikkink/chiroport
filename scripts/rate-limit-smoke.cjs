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
loadEnvFile(path.join(process.cwd(), '.env'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isLocalUrl = (value) =>
  value && (value.includes('localhost') || value.includes('127.0.0.1'));

const baseUrl = process.env.NEXT_BASE_URL || 'http://localhost:3000';
const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const allowProd = process.env.RATE_LIMIT_SMOKE_ALLOW_PROD === '1';
const allowSms = process.env.RATE_LIMIT_SMOKE_ALLOW_SMS === '1';
const runEndpoints = process.env.RATE_LIMIT_SMOKE_ENDPOINTS === '1';
const prefix = process.env.RATE_LIMIT_SMOKE_PREFIX || 'smoke';

if (!allowProd) {
  const nonLocalTargets = [];
  if (baseUrl && !isLocalUrl(baseUrl)) nonLocalTargets.push(`NEXT_BASE_URL=${baseUrl}`);
  if (supabaseUrl && !isLocalUrl(supabaseUrl)) nonLocalTargets.push(`SUPABASE_URL=${supabaseUrl}`);
  if (nonLocalTargets.length > 0) {
    console.error('Refusing to run rate-limit smoke tests against non-local URLs.');
    nonLocalTargets.forEach((entry) => console.error(`- ${entry}`));
    console.error('Set RATE_LIMIT_SMOKE_ALLOW_PROD=1 if you really want this.');
    process.exit(1);
  }
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { response, json, text };
}

async function runRpcSuite(name, rules, iterations) {
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.warn(`[skip] ${name} RPC suite (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)`);
    return;
  }

  const rpcUrl = `${supabaseUrl}/rest/v1/rpc/check_rate_limits`;
  const headers = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
  };

  let blocked = false;
  for (let i = 0; i < iterations; i += 1) {
    const { response, json } = await postJson(
      rpcUrl,
      { p_rules: rules },
      headers
    );
    if (!response.ok) {
      console.error(`[fail] ${name} RPC status ${response.status}`, json ?? '');
      return;
    }
    const rows = Array.isArray(json) ? json : [];
    blocked = rows.some((row) => row.allowed === false);
    if (blocked) {
      console.log(`[ok] ${name} RPC blocked after ${i + 1} calls`);
      break;
    }
  }

  if (!blocked) {
    console.warn(`[warn] ${name} RPC did not block after ${iterations} calls`);
  }
}

async function runHealthEndpoint() {
  const limit = Number(process.env.RATE_LIMIT_HEALTH_PER_MIN ?? 60);
  const iterations = Number.isFinite(limit) ? limit + 1 : 61;
  let blocked = false;

  for (let i = 0; i < iterations; i += 1) {
    const response = await fetch(`${baseUrl}/api/health`, { method: 'GET' });
    if (response.status === 429) {
      blocked = true;
      console.log(`[ok] health endpoint blocked after ${i + 1} calls`);
      break;
    }
  }

  if (!blocked) {
    console.warn(`[warn] health endpoint did not block after ${iterations} calls`);
  }
}

async function runQueueJoinEndpoint() {
  if (!supabaseUrl || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('[skip] queue_join endpoint (missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
    return;
  }
  if (!allowSms) {
    console.warn('[skip] queue_join endpoint (set RATE_LIMIT_SMOKE_ALLOW_SMS=1 to allow)');
    return;
  }
  if (!process.env.QUEUE_JOIN_PAYLOAD) {
    console.warn('[skip] queue_join endpoint (set QUEUE_JOIN_PAYLOAD JSON env)');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(process.env.QUEUE_JOIN_PAYLOAD);
  } catch {
    console.warn('[skip] queue_join endpoint (QUEUE_JOIN_PAYLOAD is invalid JSON)');
    return;
  }

  const limit = Number(process.env.RATE_LIMIT_QUEUE_JOIN_IP_PER_MIN ?? 30);
  const iterations = Number.isFinite(limit) ? limit + 1 : 31;
  let blocked = false;

  for (let i = 0; i < iterations; i += 1) {
    const { response } = await postJson(
      `${supabaseUrl}/functions/v1/queue_join`,
      payload,
      {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      }
    );
    if (response.status === 429) {
      blocked = true;
      console.log(`[ok] queue_join endpoint blocked after ${i + 1} calls`);
      break;
    }
  }

  if (!blocked) {
    console.warn(`[warn] queue_join endpoint did not block after ${iterations} calls`);
  }
}

async function runSendSmsEndpoint() {
  if (!supabaseUrl) {
    console.warn('[skip] send_sms endpoint (missing SUPABASE_URL)');
    return;
  }
  if (!allowSms) {
    console.warn('[skip] send_sms endpoint (set RATE_LIMIT_SMOKE_ALLOW_SMS=1 to allow)');
    return;
  }

  const internalSecret = process.env.SEND_SMS_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!internalSecret && !serviceKey) {
    console.warn('[skip] send_sms endpoint (missing SEND_SMS_SECRET or SUPABASE_SERVICE_ROLE_KEY)');
    return;
  }

  const limit = Number(process.env.RATE_LIMIT_SEND_SMS_IP_PER_MIN ?? 10);
  const iterations = Number.isFinite(limit) ? limit + 1 : 11;
  let blocked = false;

  for (let i = 0; i < iterations; i += 1) {
    const headers = {
      ...(internalSecret ? { 'x-sms-secret': internalSecret } : {}),
      ...(serviceKey
        ? { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }
        : {}),
    };
    const { response } = await postJson(`${supabaseUrl}/functions/v1/send_sms`, {}, headers);
    if (response.status === 429) {
      blocked = true;
      console.log(`[ok] send_sms endpoint blocked after ${i + 1} calls`);
      break;
    }
  }

  if (!blocked) {
    console.warn(`[warn] send_sms endpoint did not block after ${iterations} calls`);
  }
}

async function main() {
  console.log('Rate limit smoke test starting...');

  const suites = [
    {
      name: 'queue_join',
      rules: [
        { bucket: `${prefix}:queue_join:ip`, limit: 3, window_seconds: 60 },
        { bucket: `${prefix}:queue_join:phone:hour`, limit: 3, window_seconds: 3600 },
        { bucket: `${prefix}:queue_join:phone:day`, limit: 3, window_seconds: 86400 },
      ],
    },
    {
      name: 'send_sms',
      rules: [
        { bucket: `${prefix}:send_sms:ip`, limit: 3, window_seconds: 60 },
        { bucket: `${prefix}:send_sms:phone:day`, limit: 3, window_seconds: 86400 },
        { bucket: `${prefix}:send_sms:location:day`, limit: 3, window_seconds: 86400 },
      ],
    },
    {
      name: 'employee',
      rules: [
        { bucket: `${prefix}:employee:user`, limit: 3, window_seconds: 60 },
        { bucket: `${prefix}:employee:location`, limit: 3, window_seconds: 60 },
      ],
    },
    {
      name: 'twilio_webhook',
      rules: [{ bucket: `${prefix}:twilio:ip`, limit: 3, window_seconds: 60 }],
    },
  ];

  for (const suite of suites) {
    await runRpcSuite(suite.name, suite.rules, 4);
    await sleep(100);
  }

  if (runEndpoints) {
    await runHealthEndpoint();
    await runQueueJoinEndpoint();
    await runSendSmsEndpoint();
  } else {
    console.log('Endpoint smoke tests skipped (set RATE_LIMIT_SMOKE_ENDPOINTS=1 to enable).');
  }

  console.log('Rate limit smoke test done.');
}

main().catch((error) => {
  console.error('Smoke test failed', error);
  process.exit(1);
});
