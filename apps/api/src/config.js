import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, '..');

function parsePort(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback;
}

/**
 * `DATABASE_FILE=:memory:` is handy for tests and smoke runs.
 * Anything else is resolved relative to apps/api.
 */
function resolveDatabaseFile(value) {
  if (value === ':memory:') return ':memory:';
  return path.resolve(apiRoot, value ?? 'data/app.sqlite');
}

/**
 * Explicit allow-list wins. With no CORS_ORIGINS set we fall back to "any
 * localhost port", because Vite shifts ports when 5173 is taken. Always set
 * CORS_ORIGINS explicitly outside of local development.
 */
const LOCALHOST_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function resolveCorsOrigins(value) {
  const list = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return list.length > 0 ? list : LOCALHOST_ORIGIN;
}

export const config = {
  port: parsePort(process.env.PORT, 4000),
  databaseFile: resolveDatabaseFile(process.env.DATABASE_FILE),
  corsOrigins: resolveCorsOrigins(process.env.CORS_ORIGINS),
  corsOriginsAreExplicit: Boolean(process.env.CORS_ORIGINS),
  seedOnEmpty: process.env.SEED_ON_EMPTY !== 'false',
};
