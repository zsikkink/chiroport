/** @jest-environment node */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { TREATMENT_OPTIONS } from '@/domain/services/catalog';
import { airportLocations } from '@/lib';
import {
  createServiceClient,
  getTestEnv,
} from './helpers/supabase';

const env = getTestEnv();
const itIf = env?.serviceKey ? it : it.skip;

const publishedLocations = airportLocations.flatMap((airport) =>
  airport.concourses.map((concourse) => ({
    airportCode: airport.code,
    code: concourse.slug,
    imageUrl: concourse.locationInfo.imageUrl,
  }))
);

it('checks and function-local configs resolve the same frozen Edge lock', () => {
  const root = path.resolve('supabase/functions');
  const shared = JSON.parse(fs.readFileSync(path.join(root, 'deno.json'), 'utf8'));
  for (const name of fs.readdirSync(root)) {
    if (!fs.existsSync(path.join(root, name, 'index.ts'))) continue;
    const config = JSON.parse(fs.readFileSync(path.join(root, name, 'deno.json'), 'utf8'));
    expect(config.nodeModulesDir).toBe(shared.nodeModulesDir);
    expect(config.lock.frozen).toBe(true);
    expect(path.resolve(root, name, config.lock.path)).toBe(path.resolve(root, shared.lock.path));
  }
});

describe('published location and offering drift', () => {
  it('references an existing asset for every published location', () => {
    for (const location of publishedLocations) {
      const assetPath = path.join(
        process.cwd(),
        'public',
        location.imageUrl.replace(/^\//, '')
      );
      expect(fs.existsSync(assetPath)).toBe(true);
    }
  });

  itIf('keeps published locations aligned with open operational queues', async () => {
    const service = createServiceClient(env!);
    const { data, error } = await service
      .from('locations')
      .select('airport_code, code, is_open, queues(code, is_open)');

    expect(error).toBeNull();
    const operational = new Map(
      (data ?? []).map((location) => [
        `${location.airport_code}:${location.code}`,
        location,
      ])
    );
    const publishedKeys = new Set(
      publishedLocations.map(
        (location) => `${location.airportCode}:${location.code}`
      )
    );

    for (const published of publishedLocations) {
      const key = `${published.airportCode}:${published.code}`;
      const row = operational.get(key);
      expect(row).toBeDefined();
      expect(row?.is_open).toBe(true);
      expect(
        row?.queues.some(
          (queue) => queue.code === 'default' && queue.is_open === true
        )
      ).toBe(true);
    }

    for (const row of data ?? []) {
      if (!row.is_open) {
        expect(publishedKeys.has(`${row.airport_code}:${row.code}`)).toBe(false);
      }
    }
  });

  itIf('keeps closed locations and their queues unavailable for new check-ins', async () => {
    const service = createServiceClient(env!);
    const { data, error } = await service
      .from('locations')
      .select('airport_code, code, is_open, queues(code, is_open)')
      .in('airport_code', ['ATL', 'DFW', 'LAS']);

    expect(error).toBeNull();
    for (const [airportCode, code] of [
      ['ATL', 'concourse-a'],
      ['DFW', 'concourse-a'],
      ['LAS', 'concourse-b'],
    ]) {
      const location = data?.find(
        (row) => row.airport_code === airportCode && row.code === code
      );
      expect(location?.is_open).toBe(false);
      expect(location?.queues.every((queue) => queue.is_open === false)).toBe(true);
    }
    expect(
      data?.find((row) => row.airport_code === 'LAS' && row.code === 'concourse-c')?.is_open
    ).toBe(true);
  });

  itIf('keeps employee offering codes and labels aligned with the database', async () => {
    const service = createServiceClient(env!);
    const { data, error } = await service
      .from('service_offerings')
      .select('code, display_label')
      .eq('is_active', true)
      .order('code');

    expect(error).toBeNull();
    expect(data).toEqual(
      TREATMENT_OPTIONS.map((offering) => ({
        code: offering.code,
        display_label: offering.label,
      })).sort((left, right) => left.code.localeCompare(right.code))
    );
  });
});


it.each(['https://example.invalid', 'http://127.0.0.1.evil.invalid:3000', 'http://user:pass@127.0.0.1:3000', 'http://127.0.0.1:3000/path', 'http://127.0.0.1:3000?token=synthetic'])('browser tests refuse an unsafe target %s before fixtures', baseURL => {
  const code = ts.transpileModule(fs.readFileSync('playwright.config.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const defineConfig = jest.fn();
  expect(() => vm.runInNewContext(code, { exports: {}, require: () => ({ defineConfig }), URL, process: { env: { NEXT_PUBLIC_BASE_URL: baseURL } } })).toThrow('hosted targets are refused');
  expect(defineConfig).not.toHaveBeenCalled();
});
