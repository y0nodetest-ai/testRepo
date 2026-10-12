import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * config.js reads process.env once, at module evaluation time, so each case
 * needs a fresh module instance. A changing query string gives every import a
 * distinct module key and defeats the ESM cache.
 */

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANAGED_KEYS = ['PORT', 'DATABASE_FILE', 'CORS_ORIGINS', 'SEED_ON_EMPTY'];

let instance = 0;

async function loadConfig(env = {}) {
  const saved = {};
  for (const key of MANAGED_KEYS) {
    saved[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }

  try {
    instance += 1;
    const module = await import(`../src/config.js?instance=${instance}`);
    return module.config;
  } finally {
    for (const key of MANAGED_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

/* ------------------------------------------------------------------ */
/* port                                                                */
/* ------------------------------------------------------------------ */

test('port defaults to 4000', async () => {
  const config = await loadConfig();
  assert.equal(config.port, 4000);
});

test('port honours a valid PORT', async () => {
  const config = await loadConfig({ PORT: '5055' });
  assert.equal(config.port, 5055);
});

test('port falls back when PORT is not a number', async () => {
  const config = await loadConfig({ PORT: 'abc' });
  assert.equal(config.port, 4000);
});

test('port rejects zero', async () => {
  const config = await loadConfig({ PORT: '0' });
  assert.equal(config.port, 4000);
});

test('port rejects a value above the TCP range', async () => {
  const config = await loadConfig({ PORT: '70000' });
  assert.equal(config.port, 4000);
});

test('port rejects a negative value', async () => {
  const config = await loadConfig({ PORT: '-1' });
  assert.equal(config.port, 4000);
});

/* ------------------------------------------------------------------ */
/* databaseFile                                                        */
/* ------------------------------------------------------------------ */

test('databaseFile defaults to data/app.sqlite under apps/api', async () => {
  const config = await loadConfig();
  assert.equal(config.databaseFile, path.join(API_ROOT, 'data', 'app.sqlite'));
});

test('databaseFile passes :memory: through untouched', async () => {
  const config = await loadConfig({ DATABASE_FILE: ':memory:' });
  assert.equal(config.databaseFile, ':memory:');
});

test('databaseFile resolves a relative path against apps/api', async () => {
  const config = await loadConfig({ DATABASE_FILE: 'tmp/custom.sqlite' });
  assert.equal(config.databaseFile, path.join(API_ROOT, 'tmp', 'custom.sqlite'));
});

test('databaseFile keeps an absolute path as given', async () => {
  const absolute = path.join(API_ROOT, 'tmp', 'absolute.sqlite');
  const config = await loadConfig({ DATABASE_FILE: absolute });
  assert.equal(config.databaseFile, absolute);
});

/* ------------------------------------------------------------------ */
/* corsOrigins                                                         */
/* ------------------------------------------------------------------ */

test('corsOrigins falls back to a localhost pattern when unset', async () => {
  const config = await loadConfig();
  assert.ok(config.corsOrigins instanceof RegExp);
  assert.equal(config.corsOriginsAreExplicit, false);
});

test('the fallback pattern accepts any localhost port', async () => {
  const { corsOrigins } = await loadConfig();
  assert.equal(corsOrigins.test('http://localhost:5173'), true);
  assert.equal(corsOrigins.test('http://localhost:5175'), true);
  assert.equal(corsOrigins.test('http://127.0.0.1:4000'), true);
  assert.equal(corsOrigins.test('http://localhost'), true);
});

test('the fallback pattern rejects a non-localhost origin', async () => {
  const { corsOrigins } = await loadConfig();
  assert.equal(corsOrigins.test('http://evil.example.com'), false);
  assert.equal(corsOrigins.test('https://localhost:5173'), false);
});

test('an explicit CORS_ORIGINS list wins over the fallback', async () => {
  const config = await loadConfig({
    CORS_ORIGINS: 'http://a.example.com,http://b.example.com',
  });
  assert.deepEqual(config.corsOrigins, [
    'http://a.example.com',
    'http://b.example.com',
  ]);
  assert.equal(config.corsOriginsAreExplicit, true);
});

test('CORS_ORIGINS entries are trimmed', async () => {
  const config = await loadConfig({
    CORS_ORIGINS: ' http://a.example.com , http://b.example.com ',
  });
  assert.deepEqual(config.corsOrigins, [
    'http://a.example.com',
    'http://b.example.com',
  ]);
});

test('an empty CORS_ORIGINS is treated as unset', async () => {
  const config = await loadConfig({ CORS_ORIGINS: '' });
  assert.ok(config.corsOrigins instanceof RegExp);
  assert.equal(config.corsOriginsAreExplicit, false);
});

test('a CORS_ORIGINS of only separators falls back but still reads as explicit', async () => {
  // Documents a rough edge: the flag reflects "the variable was set", while the
  // value reflects "nothing usable was in it".
  const config = await loadConfig({ CORS_ORIGINS: ' , , ' });
  assert.ok(config.corsOrigins instanceof RegExp);
  assert.equal(config.corsOriginsAreExplicit, true);
});

/* ------------------------------------------------------------------ */
/* seedOnEmpty                                                         */
/* ------------------------------------------------------------------ */

test('seedOnEmpty defaults to true', async () => {
  const config = await loadConfig();
  assert.equal(config.seedOnEmpty, true);
});

test('seedOnEmpty is disabled only by the exact string "false"', async () => {
  assert.equal((await loadConfig({ SEED_ON_EMPTY: 'false' })).seedOnEmpty, false);
  assert.equal((await loadConfig({ SEED_ON_EMPTY: 'true' })).seedOnEmpty, true);
  assert.equal((await loadConfig({ SEED_ON_EMPTY: '0' })).seedOnEmpty, true);
  assert.equal((await loadConfig({ SEED_ON_EMPTY: 'no' })).seedOnEmpty, true);
});
