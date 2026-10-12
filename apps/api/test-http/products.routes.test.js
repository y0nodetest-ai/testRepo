import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

/**
 * End-to-end HTTP tests against a real listening server and a real in-memory
 * database. No supertest, no mocks - just `fetch` against an ephemeral port.
 *
 * These live outside apps/api/test/ on purpose: they import express and cors,
 * so they cannot run in a checkout where dependencies have not been installed.
 * `npm test` stays dependency-free; `npm run test:http` runs these.
 */
process.env.DATABASE_FILE = ':memory:';
process.env.SEED_ON_EMPTY = 'false';
process.env.CORS_ORIGINS = 'http://localhost:5173';

const { createApp } = await import('../src/app.js');
const { getDb, closeDb } = await import('../src/db.js');

const server = createApp().listen(0);
await once(server, 'listening');
const BASE = `http://127.0.0.1:${server.address().port}`;

function validBody(overrides = {}) {
  return {
    name: 'Mechanical Keyboard',
    sku: 'KBD-3003',
    category: 'Electronics',
    price: 129.99,
    quantity: 5,
    description: 'Hot-swappable, 75% layout.',
    ...overrides,
  };
}

async function api(method, path, body, headers = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const response = await fetch(`${BASE}${path}`, init);
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) : null,
  };
}

/** Creates a product through the API and returns it. */
async function seed(overrides = {}) {
  const { body } = await api('POST', '/api/products', validBody(overrides));
  return body;
}

beforeEach(() => {
  getDb().exec('DELETE FROM products');
});

test.after(() => {
  server.close();
  closeDb();
});

/* ------------------------------------------------------------------ */
/* health and meta                                                     */
/* ------------------------------------------------------------------ */

test('GET /api/health reports ok', async () => {
  const { status, body } = await api('GET', '/api/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.uptime, 'number');
});

test('GET /api/products/meta lists the categories for the form dropdown', async () => {
  const { status, body } = await api('GET', '/api/products/meta');
  assert.equal(status, 200);
  assert.deepEqual(body.categories, [
    'Electronics',
    'Furniture',
    'Stationery',
    'Apparel',
    'Other',
  ]);
});

test('the server does not advertise Express', async () => {
  const { headers } = await api('GET', '/api/health');
  assert.equal(headers.get('x-powered-by'), null);
});

test('an allow-listed origin receives a CORS header', async () => {
  const { headers } = await api('GET', '/api/health', undefined, {
    origin: 'http://localhost:5173',
  });
  assert.equal(headers.get('access-control-allow-origin'), 'http://localhost:5173');
});

/* ------------------------------------------------------------------ */
/* list                                                                */
/* ------------------------------------------------------------------ */

test('GET /api/products returns an empty list with the echoed query', async () => {
  const { status, body } = await api('GET', '/api/products');
  assert.equal(status, 200);
  assert.deepEqual(body.items, []);
  assert.equal(body.total, 0);
  assert.deepEqual(body.query, {
    search: '',
    category: '',
    sortBy: 'created_at',
    sortDir: 'desc',
  });
});

test('GET /api/products counts the stored products', async () => {
  await seed({ sku: 'AAA-1' });
  await seed({ sku: 'BBB-2' });

  const { body } = await api('GET', '/api/products');
  assert.equal(body.total, 2);
  assert.equal(body.items.length, 2);
});

test('GET /api/products honours a search term', async () => {
  await seed({ sku: 'AAA-1', name: 'Mechanical Keyboard' });
  await seed({ sku: 'BBB-2', name: 'Aeron Desk Chair' });

  const { body } = await api('GET', '/api/products?search=keyb');
  assert.equal(body.total, 1);
  assert.equal(body.items[0].name, 'Mechanical Keyboard');
});

test('GET /api/products honours a category filter', async () => {
  await seed({ sku: 'AAA-1', category: 'Electronics' });
  await seed({ sku: 'BBB-2', category: 'Furniture' });

  const { body } = await api('GET', '/api/products?category=Furniture');
  assert.equal(body.total, 1);
  assert.equal(body.items[0].sku, 'BBB-2');
});

test('GET /api/products ignores an unknown sort column rather than erroring', async () => {
  await seed();
  const { status, body } = await api('GET', '/api/products?sortBy=hacked');
  assert.equal(status, 200);
  assert.equal(body.query.sortBy, 'created_at');
});

/* ------------------------------------------------------------------ */
/* read one                                                            */
/* ------------------------------------------------------------------ */

test('GET /api/products/:id returns the product', async () => {
  const created = await seed();
  const { status, body } = await api('GET', `/api/products/${created.id}`);
  assert.equal(status, 200);
  assert.equal(body.id, created.id);
  assert.equal(body.sku, 'KBD-3003');
});

test('GET /api/products/:id rejects a non-numeric id with 400', async () => {
  const { status, body } = await api('GET', '/api/products/abc');
  assert.equal(status, 400);
  assert.equal(body.error.message, 'Invalid product id.');
  assert.ok(body.error.fields.id);
});

test('GET /api/products/:id returns 404 for a missing product', async () => {
  const { status, body } = await api('GET', '/api/products/999999');
  assert.equal(status, 404);
  assert.equal(body.error.message, 'Product 999999 was not found.');
});

/* ------------------------------------------------------------------ */
/* create                                                             */
/* ------------------------------------------------------------------ */

test('POST /api/products creates a product and returns 201', async () => {
  const { status, body } = await api('POST', '/api/products', validBody());
  assert.equal(status, 201);
  assert.equal(typeof body.id, 'number');
  assert.equal(body.sku, 'KBD-3003');
  assert.equal(body.inStock, true);
});

test('POST /api/products upper-cases the SKU on the way in', async () => {
  const { body } = await api('POST', '/api/products', validBody({ sku: 'kbd-3003' }));
  assert.equal(body.sku, 'KBD-3003');
});

test('POST /api/products rejects an invalid payload with 422 and field errors', async () => {
  const { status, body } = await api(
    'POST',
    '/api/products',
    validBody({ name: 'A', category: 'Groceries', price: -5 }),
  );
  assert.equal(status, 422);
  assert.equal(body.error.message, 'Please fix the highlighted fields.');
  assert.ok(body.error.fields.name);
  assert.ok(body.error.fields.category);
  assert.ok(body.error.fields.price);
});

test('POST /api/products rejects a duplicate SKU with 409', async () => {
  await seed();
  const { status, body } = await api('POST', '/api/products', validBody());
  assert.equal(status, 409);
  assert.equal(body.error.message, 'That SKU is already in use.');
  assert.ok(body.error.fields.sku);
});

test('POST /api/products treats a differently cased SKU as a duplicate', async () => {
  await seed({ sku: 'KBD-3003' });
  const { status } = await api('POST', '/api/products', validBody({ sku: 'kbd-3003' }));
  assert.equal(status, 409);
});

/* ------------------------------------------------------------------ */
/* update                                                             */
/* ------------------------------------------------------------------ */

test('PUT /api/products/:id updates the product', async () => {
  const created = await seed();
  const { status, body } = await api(
    'PUT',
    `/api/products/${created.id}`,
    validBody({ name: 'Renamed Keyboard', quantity: 11 }),
  );
  assert.equal(status, 200);
  assert.equal(body.name, 'Renamed Keyboard');
  assert.equal(body.quantity, 11);
});

test('PUT /api/products/:id lets a product keep its own SKU', async () => {
  const created = await seed({ sku: 'KBD-3003' });
  const { status } = await api(
    'PUT',
    `/api/products/${created.id}`,
    validBody({ sku: 'KBD-3003', name: 'Same SKU, new name' }),
  );
  assert.equal(status, 200);
});

test('PUT /api/products/:id rejects a bad id with 400', async () => {
  const { status } = await api('PUT', '/api/products/abc', validBody());
  assert.equal(status, 400);
});

test('PUT /api/products/:id rejects an invalid payload with 422', async () => {
  const created = await seed();
  const { status } = await api(
    'PUT',
    `/api/products/${created.id}`,
    validBody({ sku: '' }),
  );
  assert.equal(status, 422);
});

test('PUT /api/products/:id returns 404 for a missing product', async () => {
  const { status, body } = await api('PUT', '/api/products/999999', validBody());
  assert.equal(status, 404);
  assert.equal(body.error.message, 'Product 999999 was not found.');
});

test('PUT validates the body before checking existence', async () => {
  // Documents the ordering in products.routes.js: a bad body on a missing id
  // reports 422, not 404.
  const { status } = await api('PUT', '/api/products/999999', validBody({ sku: '' }));
  assert.equal(status, 422);
});

test('PUT /api/products/:id rejects a SKU owned by another product with 409', async () => {
  await seed({ sku: 'KBD-3003' });
  const other = await seed({ sku: 'MON-4004' });

  const { status, body } = await api(
    'PUT',
    `/api/products/${other.id}`,
    validBody({ sku: 'KBD-3003' }),
  );
  assert.equal(status, 409);
  assert.ok(body.error.fields.sku);
});

/* ------------------------------------------------------------------ */
/* delete                                                             */
/* ------------------------------------------------------------------ */

test('DELETE /api/products/:id removes the product and returns 204', async () => {
  const created = await seed();

  const deleted = await api('DELETE', `/api/products/${created.id}`);
  assert.equal(deleted.status, 204);
  assert.equal(deleted.body, null);

  const after = await api('GET', `/api/products/${created.id}`);
  assert.equal(after.status, 404);
});

test('DELETE /api/products/:id returns 404 for a missing product', async () => {
  const { status } = await api('DELETE', '/api/products/999999');
  assert.equal(status, 404);
});

test('DELETE /api/products/:id rejects a bad id with 400', async () => {
  const { status } = await api('DELETE', '/api/products/abc');
  assert.equal(status, 400);
});

/* ------------------------------------------------------------------ */
/* app-level error handling                                            */
/* ------------------------------------------------------------------ */

test('an unknown route returns a descriptive 404', async () => {
  const { status, body } = await api('GET', '/api/nope');
  assert.equal(status, 404);
  assert.match(body.error.message, /No route for GET \/api\/nope/);
});

test('malformed JSON returns 400 rather than 500', async () => {
  const { status, body } = await api('POST', '/api/products', '{"name":');
  assert.equal(status, 400);
  assert.equal(body.error.message, 'Request body must be valid JSON.');
});

test('an oversized body returns 413', async () => {
  const huge = JSON.stringify(validBody({ description: 'x'.repeat(100_000) }));
  const { status, body } = await api('POST', '/api/products', huge);
  assert.equal(status, 413);
  assert.equal(body.error.message, 'Request body is too large.');
});
