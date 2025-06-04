#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

/**
 * Robust Development Startup Script
 * 
 * This script ensures a completely clean development environment
 * to prevent webpack cache corruption issues.
 */

console.log('🚀 Starting Chiroport development environment...\n');

function executeCommand(command, description) {
  console.log(`📋 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed\n`);
  } catch (error) {
    console.log(`⚠️  ${description} completed with warnings\n`);
  }
}

function cleanEnvironment() {
  console.log('🧹 Cleaning development environment...\n');
  
  // Kill any existing Next.js processes
  executeCommand("pkill -f 'next dev' || true", "Stopping existing dev servers");
  
  // Remove all cache directories
  const cacheDirs = [
    '.next',
    'node_modules/.cache',
    '.cache',
    '.webpack',
    'tmp'
  ];
  
  cacheDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      executeCommand(`rm -rf ${dir}`, `Removing ${dir}`);
    }
  });
  
  // Clean npm cache
  executeCommand('npm cache clean --force', 'Cleaning npm cache');
  
  // Remove any suspicious webpack files
  executeCommand("find . -name '*.js' -path '*/.next/*' -exec rm -f {} + 2>/dev/null || true", "Removing orphaned webpack files");
}

function validateEnvironment() {
  console.log('🔍 Validating environment...\n');
  
  // Check Node.js version
  const nodeVersion = process.version;
  console.log(`📌 Node.js version: ${nodeVersion}`);
  
  // Check if package.json exists
  if (!fs.existsSync('package.json')) {
    console.error('❌ package.json not found!');
    process.exit(1);
  }
  
  // Check if next.config.ts exists
  if (!fs.existsSync('next.config.ts')) {
    console.error('❌ next.config.ts not found!');
    process.exit(1);
  }
  
  console.log('✅ Environment validation passed\n');
}

function ensureDirectoryStructure() {
  console.log('📁 Ensuring directory structure...\n');
  
  const requiredDirs = [
    'src/components',
    'src/app',
    'scripts',
    'docs'
  ];
  
  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📂 Created directory: ${dir}`);
    }
  });
  
  console.log('✅ Directory structure validated\n');
}

function startDevelopmentServer() {
  console.log('🎯 Starting development server...\n');
  
  try {
    // Start the development server
    execSync('npm run dev', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Failed to start development server');
    console.error('💡 Try running: npm run reset');
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    validateEnvironment();
    cleanEnvironment();
    ensureDirectoryStructure();
    
    console.log('🎉 Environment prepared successfully!\n');
    console.log('🌐 Starting development server on http://localhost:3000\n');
    
    startDevelopmentServer();
    
  } catch (error) {
    console.error('❌ Failed to start development environment:', error.message);
    console.error('\n🆘 Emergency recovery commands:');
    console.error('   npm run clean:full');
    console.error('   npm run reset');
    process.exit(1);
  }
}

// Handle script interruption
process.on('SIGINT', () => {
  console.log('\n🛑 Development server stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Development server terminated');
  process.exit(0);
});

main(); 