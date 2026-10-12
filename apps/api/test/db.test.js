import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * db.js builds on node:sqlite, which ships with Node, so there is nothing to
 * install. The database file is forced to :memory: before the module is
 * imported, which keeps the developer's apps/api/data/app.sqlite untouched.
 *
 * config.js captures process.env at evaluation time and db.js holds a single
 * module-level handle, so the env has to be set before the dynamic import
 * below - a static import would be hoisted above these assignments.
 */
process.env.DATABASE_FILE = ':memory:';
delete process.env.SEED_ON_EMPTY;

const { getDb, closeDb } = await import('../src/db.js');

const INSERT = `
  INSERT INTO products
    (name, sku, category, price, quantity, in_stock, description, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function insert(overrides = {}) {
  const now = new Date().toISOString();
  const row = {
    name: 'Sample',
    sku: `SKU-${Math.random().toString(36).slice(2, 10)}`,
    category: 'Other',
    price: 1,
    quantity: 1,
    in_stock: 1,
    description: '',
    ...overrides,
  };

  return getDb()
    .prepare(INSERT)
    .run(
      row.name,
      row.sku,
      row.category,
      row.price,
      row.quantity,
      row.in_stock,
      row.description,
      now,
      now,
    );
}

function countProducts() {
  return getDb().prepare('SELECT COUNT(*) AS count FROM products').get().count;
}

/* ------------------------------------------------------------------ */
/* opening and schema                                                  */
/* ------------------------------------------------------------------ */

test('getDb creates the products table', () => {
  const row = getDb()
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products'")
    .get();
  assert.equal(row.name, 'products');
});

test('getDb creates the lookup indexes', () => {
  const names = getDb()
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")
    .all()
    .map((row) => row.name)
    .sort();
  assert.deepEqual(names, ['idx_products_category', 'idx_products_name']);
});

test('getDb returns the same handle on every call', () => {
  assert.equal(getDb(), getDb());
});

/* ------------------------------------------------------------------ */
/* seeding                                                             */
/* ------------------------------------------------------------------ */

test('an empty database is seeded with the four demo products', () => {
  assert.equal(countProducts(), 4);
});

test('the seed data includes the known demo SKUs', () => {
  const skus = getDb()
    .prepare('SELECT sku FROM products ORDER BY sku')
    .all()
    .map((row) => row.sku);
  for (const sku of ['CHR-1001', 'DSK-2002', 'KBD-3003', 'MON-4004']) {
    assert.ok(skus.includes(sku), `expected seed SKU ${sku}`);
  }
});

test('seeding does not run again once rows exist', () => {
  const before = countProducts();
  getDb();
  assert.equal(countProducts(), before);
});

/* ------------------------------------------------------------------ */
/* constraints                                                         */
/* ------------------------------------------------------------------ */

test('a row with valid values inserts cleanly', () => {
  const before = countProducts();
  insert({ sku: 'OK-0001' });
  assert.equal(countProducts(), before + 1);
});

test('the schema rejects a negative price', () => {
  assert.throws(() => insert({ price: -1 }));
});

test('the schema rejects a negative quantity', () => {
  assert.throws(() => insert({ quantity: -1 }));
});

test('the schema rejects an in_stock value outside 0 and 1', () => {
  assert.throws(() => insert({ in_stock: 2 }));
});

test('the schema rejects a null name', () => {
  assert.throws(() => insert({ name: null }));
});

test('SKU uniqueness is case-insensitive', () => {
  insert({ sku: 'DUP-9001' });
  assert.throws(() => insert({ sku: 'dup-9001' }));
});

test('a price of zero is allowed', () => {
  const before = countProducts();
  insert({ sku: 'FREE-0001', price: 0 });
  assert.equal(countProducts(), before + 1);
});

/* ------------------------------------------------------------------ */
/* lifecycle - keep last, it discards the shared handle                */
/* ------------------------------------------------------------------ */

test('closeDb is safe to call twice', () => {
  closeDb();
  assert.doesNotThrow(() => closeDb());
});

test('getDb reopens after closeDb, and an in-memory database starts empty again', () => {
  const reopened = getDb();
  assert.ok(reopened);
  // A fresh :memory: database is empty, so the seed runs again.
  assert.equal(countProducts(), 4);
  closeDb();
});
