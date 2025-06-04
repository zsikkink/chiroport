#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Cache Monitor Script
 * 
 * This script monitors the Next.js cache for potential corruption
 * and automatically cleans it when issues are detected.
 */

const CACHE_DIR = '.next';
const WEBPACK_CACHE_DIR = '.next/cache/webpack';
const MAX_CACHE_SIZE_MB = 500; // Max cache size before cleanup
const MAX_CACHE_AGE_DAYS = 7; // Max cache age before cleanup

function getDirectorySize(dir) {
  if (!fs.existsSync(dir)) return 0;
  
  let totalSize = 0;
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      totalSize += getDirectorySize(filePath);
    } else {
      totalSize += stats.size;
    }
  }
  
  return totalSize;
}

function getCacheAge(dir) {
  if (!fs.existsSync(dir)) return 0;
  
  const stats = fs.statSync(dir);
  const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays;
}

function cleanCache() {
  console.log('🧹 Cleaning cache...');
  
  try {
    // Kill any running dev servers
    try {
      execSync("pkill -f 'next dev'", { stdio: 'ignore' });
    } catch (error) {
      // It's okay if no processes are found
    }
    
    // Clean Next.js cache
    if (fs.existsSync(CACHE_DIR)) {
      execSync(`rm -rf ${CACHE_DIR}`, { stdio: 'inherit' });
      console.log('✅ Next.js cache cleaned');
    }
    
    // Clean node_modules cache
    if (fs.existsSync('node_modules/.cache')) {
      execSync('rm -rf node_modules/.cache', { stdio: 'inherit' });
      console.log('✅ Node modules cache cleaned');
    }
    
    // Clean npm cache
    execSync('npm cache clean --force', { stdio: 'inherit' });
    console.log('✅ NPM cache cleaned');
    
    console.log('🎉 Cache cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error cleaning cache:', error.message);
    process.exit(1);
  }
}

function checkCache() {
  console.log('🔍 Checking cache health...');
  
  // Check cache size
  const cacheSize = getDirectorySize(CACHE_DIR);
  const cacheSizeMB = cacheSize / (1024 * 1024);
  
  console.log(`📊 Cache size: ${cacheSizeMB.toFixed(2)} MB`);
  
  if (cacheSizeMB > MAX_CACHE_SIZE_MB) {
    console.log(`⚠️  Cache size exceeds ${MAX_CACHE_SIZE_MB} MB, cleaning...`);
    cleanCache();
    return;
  }
  
  // Check cache age
  const cacheAge = getCacheAge(CACHE_DIR);
  console.log(`📅 Cache age: ${cacheAge.toFixed(1)} days`);
  
  if (cacheAge > MAX_CACHE_AGE_DAYS) {
    console.log(`⚠️  Cache older than ${MAX_CACHE_AGE_DAYS} days, cleaning...`);
    cleanCache();
    return;
  }
  
  // Check for corrupted webpack cache files
  if (fs.existsSync(WEBPACK_CACHE_DIR)) {
    const webpackFiles = fs.readdirSync(WEBPACK_CACHE_DIR);
    const suspiciousFiles = webpackFiles.filter(file => 
      file.endsWith('.js') && /^\d+\.js$/.test(file)
    );
    
    if (suspiciousFiles.length > 100) {
      console.log('⚠️  Suspicious webpack cache files detected, cleaning...');
      cleanCache();
      return;
    }
  }
  
  console.log('✅ Cache appears healthy');
}

// Main execution
const command = process.argv[2];

switch (command) {
  case 'check':
    checkCache();
    break;
  case 'clean':
    cleanCache();
    break;
  case 'monitor':
    console.log('🔄 Starting cache monitor...');
    checkCache();
    // Check every 5 minutes
    setInterval(checkCache, 5 * 60 * 1000);
    break;
  default:
    console.log(`
Usage: node scripts/cache-monitor.js [command]

Commands:
  check    - Check cache health
  clean    - Clean all caches
  monitor  - Continuously monitor cache health

Examples:
  npm run cache:check
  npm run cache:clean
  npm run cache:monitor
    `);
} 