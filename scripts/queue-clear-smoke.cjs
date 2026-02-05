#!/usr/bin/env node
/* eslint-disable no-console */
const { execFileSync } = require('child_process');
const path = require('path');

const script = path.join(__dirname, 'clear-queues.cjs');

function run(args, env = {}) {
  try {
    execFileSync('node', [script, ...args], {
      stdio: 'pipe',
      env: { ...process.env, ...env },
    });
    return { ok: true, output: '' };
  } catch (error) {
    return {
      ok: false,
      output: (error.stdout?.toString() || '') + (error.stderr?.toString() || ''),
    };
  }
}

const localEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_SECRET_KEY: 'test',
};
const prodEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'test',
};

const cases = [
  {
    name: 'rejects --all without --confirm',
    result: run(['--all'], {
      ...localEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      CLEAR_QUEUE_SKIP_COUNT: '1',
    }),
    expect: /--confirm/,
  },
  {
    name: 'rejects prod --all without --force-prod',
    result: run(['--all', '--confirm'], { ...prodEnv, CLEAR_QUEUE_SKIP_COUNT: '1' }),
    expect: /--force-prod/,
  },
];

let failed = false;
for (const testCase of cases) {
  if (testCase.result.ok || !testCase.expect.test(testCase.result.output)) {
    failed = true;
    console.error(`[fail] ${testCase.name}`);
    console.error(testCase.result.output);
  } else {
    console.log(`[ok] ${testCase.name}`);
  }
}

if (failed) {
  process.exit(1);
}
