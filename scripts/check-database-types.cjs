#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const outputPath = path.join(
  process.cwd(),
  'src',
  'lib',
  'supabase',
  'database.types.ts'
);
const write = process.argv.includes('--write');

const generated = spawnSync(
  'supabase',
  ['gen', 'types', 'typescript', '--local', '--schema', 'public'],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  }
);

if (generated.error) {
  console.error(`Unable to run Supabase CLI: ${generated.error.message}`);
  process.exit(1);
}

if (generated.status !== 0) {
  if (generated.stderr) process.stderr.write(generated.stderr);
  process.exit(generated.status ?? 1);
}

const normalize = (value) => value.replace(/\r\n/g, '\n').trimEnd() + '\n';
const nextTypes = normalize(generated.stdout);

if (write) {
  fs.writeFileSync(outputPath, nextTypes);
  console.log(`Updated ${path.relative(process.cwd(), outputPath)}.`);
  process.exit(0);
}

const currentTypes = fs.existsSync(outputPath)
  ? normalize(fs.readFileSync(outputPath, 'utf8'))
  : '';

if (currentTypes !== nextTypes) {
  console.error(
    'Generated database types are stale. Run `npm run db:types` after applying all local migrations.'
  );
  process.exit(1);
}

console.log('Generated database types match the local migrated schema.');
