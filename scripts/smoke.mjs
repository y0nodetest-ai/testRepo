/**
 * End-to-end check of the products CRUD surface.
 * Boots the real Express app against an in-memory SQLite database on an
 * ephemeral port, then drives every endpoint over HTTP.
 *
 * Usage: npm run smoke
 */
process.env.DATABASE_FILE = ':memory:';
process.env.SEED_ON_EMPTY = 'false';

const { createApp } = await import('../apps/api/src/app.js');
const { getDb, closeDb } = await import('../apps/api/src/db.js');

getDb();

const server = createApp().listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;

let passed = 0;
const failures = [];

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` -> ${JSON.stringify(detail)}` : ''}`);
  }
}

async function call(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

const sample = {
  name: 'Smoke Test Widget',
  sku: 'smk-0001',
  category: 'Electronics',
  price: 19.995,
  quantity: 3,
  inStock: true,
  description: 'Created by the smoke test.',
};

console.log('\nhealth + meta');
check('GET /health returns ok', (await call('GET', '/health')).body?.status === 'ok');
const meta = await call('GET', '/products/meta');
check('GET /products/meta lists categories', Array.isArray(meta.body?.categories) && meta.body.categories.length > 0, meta.body);

console.log('\nCREATE');
const created = await call('POST', '/products', sample);
check('POST /products returns 201', created.status === 201, created);
check('server normalises SKU to upper case', created.body?.sku === 'SMK-0001', created.body);
check('server rounds price to 2dp', created.body?.price === 20, created.body);
const id = created.body?.id;
check('created row has a numeric id', Number.isInteger(id), created.body);

console.log('\nREAD');
const list = await call('GET', '/products');
check('GET /products includes the new row', list.body?.items?.some((item) => item.id === id), list.body);
const one = await call('GET', `/products/${id}`);
check('GET /products/:id returns the row', one.status === 200 && one.body?.id === id, one);
const searched = await call('GET', '/products?search=smoke');
check('GET /products?search= filters by name', searched.body?.items?.length === 1, searched.body);
const wrongCategory = await call('GET', '/products?category=Apparel');
check('GET /products?category= filters by category', wrongCategory.body?.items?.length === 0, wrongCategory.body);

console.log('\nUPDATE');
const updated = await call('PUT', `/products/${id}`, {
  ...sample,
  name: 'Smoke Test Widget v2',
  quantity: 0,
  inStock: false,
  price: 25,
});
check('PUT /products/:id returns 200', updated.status === 200, updated);
check('PUT persists the new name', updated.body?.name === 'Smoke Test Widget v2', updated.body);
check('PUT persists inStock=false', updated.body?.inStock === false, updated.body);
check('PUT bumps updated_at', updated.body?.updatedAt >= created.body?.updatedAt, updated.body);

console.log('\nvalidation + conflicts');
const invalid = await call('POST', '/products', { name: 'x', sku: '!!', category: 'Nope', price: -1, quantity: 1.5 });
check('POST with bad payload returns 422', invalid.status === 422, invalid);
check('422 body reports every bad field', ['name', 'sku', 'category', 'price', 'quantity'].every((field) => invalid.body?.error?.fields?.[field]), invalid.body);

const duplicate = await call('POST', '/products', { ...sample, sku: 'SMK-0001' });
check('POST with duplicate SKU returns 409', duplicate.status === 409, duplicate);

const badId = await call('GET', '/products/abc');
check('GET /products/abc returns 400', badId.status === 400, badId);
const missing = await call('GET', '/products/999999');
check('GET missing id returns 404', missing.status === 404, missing);
const noRoute = await call('GET', '/nope');
check('unknown route returns 404', noRoute.status === 404, noRoute);

console.log('\nDELETE');
const removed = await call('DELETE', `/products/${id}`);
check('DELETE /products/:id returns 204', removed.status === 204, removed);
const afterDelete = await call('GET', `/products/${id}`);
check('row is gone after delete', afterDelete.status === 404, afterDelete);
const deleteAgain = await call('DELETE', `/products/${id}`);
check('deleting twice returns 404', deleteAgain.status === 404, deleteAgain);
const emptyList = await call('GET', '/products');
check('list is empty again', emptyList.body?.items?.length === 0, emptyList.body);

server.close();
closeDb();

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error('Failed checks:', failures.join('; '));
  process.exit(1);
}
console.log('CRUD smoke test OK');
