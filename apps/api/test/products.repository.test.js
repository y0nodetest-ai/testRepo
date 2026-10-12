import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Repository tests run against a real in-memory SQLite database rather than a
 * mock, so the SQL itself is exercised. Seeding is switched off so each test
 * controls its own fixtures.
 *
 * As in db.test.js, the env has to be set before the dynamic imports because
 * config.js reads it at module evaluation time.
 */
process.env.DATABASE_FILE = ':memory:';
process.env.SEED_ON_EMPTY = 'false';

const { getDb, closeDb } = await import('../src/db.js');
const repo = await import('../src/products.repository.js');

/** Fixture builder. Values already validated, as the routes would pass them. */
function product(overrides = {}) {
  return {
    name: 'Mechanical Keyboard',
    sku: 'KBD-3003',
    category: 'Electronics',
    price: 129.99,
    quantity: 5,
    inStock: true,
    description: 'Hot-swappable, 75% layout.',
    ...overrides,
  };
}

beforeEach(() => {
  getDb().exec('DELETE FROM products');
});

test.after(() => {
  closeDb();
});

/* ------------------------------------------------------------------ */
/* createProduct                                                       */
/* ------------------------------------------------------------------ */

test('createProduct returns the created row in frontend shape', () => {
  const created = repo.createProduct(product());

  assert.equal(typeof created.id, 'number');
  assert.equal(created.name, 'Mechanical Keyboard');
  assert.equal(created.sku, 'KBD-3003');
  assert.equal(created.category, 'Electronics');
  assert.equal(created.price, 129.99);
  assert.equal(created.quantity, 5);
  assert.equal(created.inStock, true);
  assert.equal(created.description, 'Hot-swappable, 75% layout.');
  assert.equal(typeof created.createdAt, 'string');
  assert.equal(typeof created.updatedAt, 'string');
});

test('createProduct maps inStock false to the stored 0', () => {
  const created = repo.createProduct(product({ inStock: false, quantity: 0 }));
  assert.equal(created.inStock, false);
});

test('createProduct exposes in_stock as a boolean, not a number', () => {
  const created = repo.createProduct(product());
  assert.equal(typeof created.inStock, 'boolean');
  assert.equal(created.in_stock, undefined);
});

test('createProduct assigns increasing ids', () => {
  const first = repo.createProduct(product({ sku: 'AAA-1' }));
  const second = repo.createProduct(product({ sku: 'BBB-2' }));
  assert.ok(second.id > first.id);
});

/* ------------------------------------------------------------------ */
/* getProductById                                                      */
/* ------------------------------------------------------------------ */

test('getProductById finds a stored product', () => {
  const created = repo.createProduct(product());
  const found = repo.getProductById(created.id);
  assert.deepEqual(found, created);
});

test('getProductById returns undefined for an unknown id', () => {
  assert.equal(repo.getProductById(999_999), undefined);
});

/* ------------------------------------------------------------------ */
/* listProducts                                                        */
/* ------------------------------------------------------------------ */

test('listProducts returns an empty array when there is nothing stored', () => {
  assert.deepEqual(repo.listProducts(), []);
});

test('listProducts returns every product when called with no arguments', () => {
  repo.createProduct(product({ sku: 'AAA-1' }));
  repo.createProduct(product({ sku: 'BBB-2' }));
  assert.equal(repo.listProducts().length, 2);
});

test('listProducts puts the newest product first by default', () => {
  const first = repo.createProduct(product({ sku: 'AAA-1', name: 'Older' }));
  const second = repo.createProduct(product({ sku: 'BBB-2', name: 'Newer' }));

  const ids = repo.listProducts().map((row) => row.id);
  assert.deepEqual(ids, [second.id, first.id]);
});

test('listProducts matches a partial name, ignoring case', () => {
  repo.createProduct(product({ sku: 'AAA-1', name: 'Mechanical Keyboard' }));
  repo.createProduct(product({ sku: 'BBB-2', name: 'Aeron Desk Chair' }));

  const names = repo.listProducts({ search: 'keyb' }).map((row) => row.name);
  assert.deepEqual(names, ['Mechanical Keyboard']);
});

test('listProducts matches on SKU as well as name', () => {
  repo.createProduct(product({ sku: 'KBD-3003' }));
  repo.createProduct(product({ sku: 'CHR-1001', name: 'Aeron Desk Chair' }));

  const skus = repo.listProducts({ search: 'chr' }).map((row) => row.sku);
  assert.deepEqual(skus, ['CHR-1001']);
});

test('listProducts filters by category', () => {
  repo.createProduct(product({ sku: 'AAA-1', category: 'Electronics' }));
  repo.createProduct(product({ sku: 'BBB-2', category: 'Furniture' }));

  const rows = repo.listProducts({ category: 'Furniture' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sku, 'BBB-2');
});

test('listProducts combines a search term and a category', () => {
  repo.createProduct(product({ sku: 'AAA-1', name: 'Desk Lamp', category: 'Electronics' }));
  repo.createProduct(product({ sku: 'BBB-2', name: 'Desk Chair', category: 'Furniture' }));

  const rows = repo.listProducts({ search: 'desk', category: 'Furniture' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Desk Chair');
});

test('listProducts sorts by name ascending', () => {
  repo.createProduct(product({ sku: 'AAA-1', name: 'Zebra' }));
  repo.createProduct(product({ sku: 'BBB-2', name: 'Apple' }));

  const names = repo
    .listProducts({ sortBy: 'name', sortDir: 'asc' })
    .map((row) => row.name);
  assert.deepEqual(names, ['Apple', 'Zebra']);
});

test('listProducts sorts by price descending', () => {
  repo.createProduct(product({ sku: 'AAA-1', price: 10 }));
  repo.createProduct(product({ sku: 'BBB-2', price: 900 }));

  const prices = repo
    .listProducts({ sortBy: 'price', sortDir: 'desc' })
    .map((row) => row.price);
  assert.deepEqual(prices, [900, 10]);
});

test('listProducts sorts by quantity ascending', () => {
  repo.createProduct(product({ sku: 'AAA-1', quantity: 9 }));
  repo.createProduct(product({ sku: 'BBB-2', quantity: 2 }));

  const quantities = repo
    .listProducts({ sortBy: 'quantity', sortDir: 'asc' })
    .map((row) => row.quantity);
  assert.deepEqual(quantities, [2, 9]);
});

test('listProducts returns nothing when the search matches no row', () => {
  repo.createProduct(product());
  assert.deepEqual(repo.listProducts({ search: 'nothing-matches-this' }), []);
});

/* ------------------------------------------------------------------ */
/* findBySku                                                           */
/* ------------------------------------------------------------------ */

test('findBySku returns the id of a matching product', () => {
  const created = repo.createProduct(product({ sku: 'KBD-3003' }));
  assert.equal(repo.findBySku('KBD-3003'), created.id);
});

test('findBySku ignores case', () => {
  const created = repo.createProduct(product({ sku: 'KBD-3003' }));
  assert.equal(repo.findBySku('kbd-3003'), created.id);
});

test('findBySku returns undefined when no product matches', () => {
  assert.equal(repo.findBySku('NOPE-0000'), undefined);
});

test('findBySku skips the excluded id, which lets a product keep its own SKU', () => {
  const created = repo.createProduct(product({ sku: 'KBD-3003' }));
  assert.equal(repo.findBySku('KBD-3003', created.id), undefined);
});

test('findBySku still reports a clash owned by a different product', () => {
  const keeper = repo.createProduct(product({ sku: 'KBD-3003' }));
  const other = repo.createProduct(product({ sku: 'MON-4004' }));
  assert.equal(repo.findBySku('KBD-3003', other.id), keeper.id);
});

/* ------------------------------------------------------------------ */
/* updateProduct                                                       */
/* ------------------------------------------------------------------ */

test('updateProduct writes every mutable field', () => {
  const created = repo.createProduct(product());

  const updated = repo.updateProduct(
    created.id,
    product({
      name: '4K Monitor 27"',
      sku: 'MON-4004',
      category: 'Electronics',
      price: 379,
      quantity: 7,
      inStock: true,
      description: 'IPS panel, USB-C power delivery.',
    }),
  );

  assert.equal(updated.id, created.id);
  assert.equal(updated.name, '4K Monitor 27"');
  assert.equal(updated.sku, 'MON-4004');
  assert.equal(updated.price, 379);
  assert.equal(updated.quantity, 7);
  assert.equal(updated.description, 'IPS panel, USB-C power delivery.');
});

test('updateProduct keeps the original createdAt', () => {
  const created = repo.createProduct(product());
  const updated = repo.updateProduct(created.id, product({ name: 'Renamed' }));
  assert.equal(updated.createdAt, created.createdAt);
});

test('updateProduct can clear the stock flag', () => {
  const created = repo.createProduct(product({ inStock: true }));
  const updated = repo.updateProduct(
    created.id,
    product({ inStock: false, quantity: 0 }),
  );
  assert.equal(updated.inStock, false);
});

test('updateProduct returns undefined for an unknown id', () => {
  assert.equal(repo.updateProduct(999_999, product()), undefined);
});

test('updateProduct does not create a row when the id is unknown', () => {
  repo.updateProduct(999_999, product());
  assert.deepEqual(repo.listProducts(), []);
});

/* ------------------------------------------------------------------ */
/* deleteProduct                                                       */
/* ------------------------------------------------------------------ */

test('deleteProduct reports success and removes the row', () => {
  const created = repo.createProduct(product());
  assert.equal(repo.deleteProduct(created.id), true);
  assert.equal(repo.getProductById(created.id), undefined);
});

test('deleteProduct reports failure for an unknown id', () => {
  assert.equal(repo.deleteProduct(999_999), false);
});

test('deleteProduct is not idempotent in its return value', () => {
  const created = repo.createProduct(product());
  assert.equal(repo.deleteProduct(created.id), true);
  assert.equal(repo.deleteProduct(created.id), false);
});

test('deleteProduct leaves other products alone', () => {
  const doomed = repo.createProduct(product({ sku: 'AAA-1' }));
  const keeper = repo.createProduct(product({ sku: 'BBB-2' }));

  repo.deleteProduct(doomed.id);

  const ids = repo.listProducts().map((row) => row.id);
  assert.deepEqual(ids, [keeper.id]);
});
