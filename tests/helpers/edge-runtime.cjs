// Execute actual Edge source in Node tests, substituting only runtime I/O.
// No network is available unless the test explicitly supplies a fetch stub.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

/**
 * @param {string} relativePath
 * @param {{service?: unknown, env?: Record<string, string>, fetch?: typeof globalThis.fetch, console?: Pick<Console, 'error' | 'warn'>, overrides?: Record<string, unknown>}} options
 */
function loadEdge(relativePath, { service, env = {}, fetch, console: logger = console, overrides = {} } = {}) {
  const cache = new Map();
  let handler;
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const edgeModule = { exports: {} };
    const requireLocal = specifier => {
      if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
      if (specifier.includes('http/server.ts')) return { serve: value => { handler = value; } };
      if (specifier.endsWith('/supabaseClient.ts')) return { createServiceRoleClient: () => service };
      if (specifier.startsWith('npm:')) return require(specifier.slice(4).replace(/@[^/]+$/, ''));
      if (specifier.startsWith('.')) return load(path.resolve(path.dirname(file), specifier));
      throw new Error('Unexpected Edge test dependency: ' + specifier);
    };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { module: edgeModule, exports: edgeModule.exports, require: requireLocal, console: logger, crypto: crypto.webcrypto, TextEncoder, URL, URLSearchParams, Request, Response, Headers, Uint8Array, btoa, Date, AbortSignal, setTimeout, clearTimeout, Deno: { env: { get: name => env[name] } }, fetch: fetch ?? (() => { throw new Error('Network disabled in Edge source tests'); }) }, { filename: file });
    cache.set(file, edgeModule.exports);
    return edgeModule.exports;
  }
  const exports = load(path.resolve(__dirname, '../../supabase/functions', relativePath));
  return { ...exports, handler };
}
module.exports = { loadEdge };
