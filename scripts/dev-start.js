#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = process.cwd();
const CACHE_DIRS = [
  '.next',
  'node_modules/.cache',
  '.turbo',
].map(dir => path.join(ROOT, dir));

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function removeDir(targetPath) {
  const exists = await pathExists(targetPath);
  if (!exists) {
    return;
  }

  await fs.rm(targetPath, { recursive: true, force: true });
  console.log(`🧹 Removed ${path.relative(ROOT, targetPath)}`);
}

async function cleanCaches() {
  console.log('🧼 Clearing local caches (scoped)...');

  for (const dir of CACHE_DIRS) {
    await removeDir(dir);
  }
}

async function ensureDirectories() {
  const required = ['src/components', 'src/app', 'scripts', 'docs'];

  for (const dir of required) {
    const fullPath = path.join(ROOT, dir);
    if (!(await pathExists(fullPath))) {
      await fs.mkdir(fullPath, { recursive: true });
      console.log(`📂 Created directory ${dir}`);
    }
  }
}

async function validateEnvironment() {
  const requiredFiles = ['package.json', 'next.config.ts'];

  for (const file of requiredFiles) {
    const fullPath = path.join(ROOT, file);
    if (!(await pathExists(fullPath))) {
      throw new Error(`Required file "${file}" not found`);
    }
  }
}

function runTelemetryDisable() {
  return new Promise(resolve => {
    const child = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['next', 'telemetry', 'disable'],
      { stdio: 'ignore', env: process.env }
    );

    child.on('exit', () => resolve());
    child.on('error', () => resolve());
  });
}

function startDevServer() {
  const child = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    env: process.env,
  });

  const stopDev = () => {
    child.kill('SIGINT');
  };

  process.on('SIGINT', stopDev);
  process.on('SIGTERM', stopDev);

  child.on('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

async function main() {
  try {
    console.log('🚀 Preparing development environment...\n');

    await validateEnvironment();
    await ensureDirectories();
    await cleanCaches();
    await runTelemetryDisable();

    console.log('\n✅ Environment ready. Launching dev server...\n');
    startDevServer();
  } catch (error) {
    console.error('❌ Unable to start development environment.');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
