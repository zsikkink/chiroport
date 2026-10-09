import { defineConfig } from '@playwright/test';

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const target = new URL(baseURL);
if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
  target.username || target.password || target.search || target.hash || target.pathname !== '/') {
  throw new Error('Browser tests require a plain loopback HTTP URL; hosted targets are refused.');
}

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {
    baseURL,
  },
});
