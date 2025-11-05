#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, '.next');
const NODE_CACHE_DIR = path.join(ROOT, 'node_modules/.cache');
const WEBPACK_CACHE_DIR = path.join(CACHE_DIR, 'cache/webpack');

const MAX_CACHE_SIZE_MB = 500;
const MAX_CACHE_AGE_DAYS = 7;

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getDirectorySize(targetPath) {
  if (!(await pathExists(targetPath))) {
    return 0;
  }

  const stats = await fs.stat(targetPath);

  if (!stats.isDirectory()) {
    return stats.size;
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const sizes = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(targetPath, entry.name);
      if (entry.isDirectory()) {
        return getDirectorySize(entryPath);
      }
      const fileStats = await fs.stat(entryPath);
      return fileStats.size;
    })
  );

  return sizes.reduce((total, size) => total + size, 0);
}

async function getCacheAge(targetPath) {
  if (!(await pathExists(targetPath))) {
    return 0;
  }

  const stats = await fs.stat(targetPath);
  return (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
}

async function removeDir(targetPath) {
  if (!(await pathExists(targetPath))) {
    return;
  }

  await fs.rm(targetPath, { recursive: true, force: true });
  console.log(`🧹 Removed ${path.relative(ROOT, targetPath)}`);
}

async function cleanCache() {
  console.log('🧼 Clearing Next.js build caches (scoped)...');
  console.log('ℹ️  If `next dev` is running, please stop it to avoid rebuild loops.\n');

  await removeDir(CACHE_DIR);
  await removeDir(NODE_CACHE_DIR);

  console.log('✅ Cache cleanup completed');
}

async function checkCache() {
  console.log('🔍 Checking cache health...');

  const cacheSize = await getDirectorySize(CACHE_DIR);
  const cacheAge = await getCacheAge(CACHE_DIR);
  const cacheSizeMB = cacheSize / (1024 * 1024);

  console.log(`📊 Cache size: ${cacheSizeMB.toFixed(2)} MB`);
  console.log(`📅 Cache age: ${cacheAge.toFixed(1)} days`);

  if (cacheSizeMB > MAX_CACHE_SIZE_MB) {
    console.log(`⚠️  Cache size exceeds ${MAX_CACHE_SIZE_MB} MB, cleaning...`);
    await cleanCache();
    return;
  }

  if (cacheAge > MAX_CACHE_AGE_DAYS) {
    console.log(`⚠️  Cache older than ${MAX_CACHE_AGE_DAYS} days, cleaning...`);
    await cleanCache();
    return;
  }

  if (await pathExists(WEBPACK_CACHE_DIR)) {
    const files = await fs.readdir(WEBPACK_CACHE_DIR);
    const suspicious = files.filter(
      (file) => file.endsWith('.js') && /^\d+\.js$/.test(file)
    );

    if (suspicious.length > 100) {
      console.log('⚠️  Suspicious webpack cache files detected, cleaning...');
      await cleanCache();
      return;
    }
  }

  console.log('✅ Cache appears healthy');
}

async function monitorCache() {
  console.log('🔄 Monitoring cache (checks every 5 minutes)...');
  await checkCache();
  setInterval(checkCache, 5 * 60 * 1000);
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'check':
      await checkCache();
      break;
    case 'clean':
      await cleanCache();
      break;
    case 'monitor':
      await monitorCache();
      break;
    default:
      console.log(`
Usage: node scripts/cache-monitor.js [command]

Commands:
  check    - Check cache health
  clean    - Clean Next.js cache directories
  monitor  - Check cache every 5 minutes

Examples:
  npm run cache:check
  npm run cache:clean
  npm run cache:monitor
      `);
  }
}

main().catch((error) => {
  console.error('❌ Cache monitor failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
