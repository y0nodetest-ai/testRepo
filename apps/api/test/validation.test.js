import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CATEGORIES,
  hasErrors,
  validateId,
  validateListQuery,
  validateProduct,
} from '../src/validation.js';

/**
 * validation.js is pure and imports nothing, so these run anywhere Node runs -
 * including a fresh clone with no node_modules installed.
 */

/** A payload that should always validate cleanly. */
function validPayload(overrides = {}) {
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

/* ------------------------------------------------------------------ */
/* CATEGORIES                                                          */
/* ------------------------------------------------------------------ */

test('CATEGORIES is the single source of truth for the dropdown', () => {
  assert.deepEqual(CATEGORIES, [
    'Electronics',
    'Furniture',
    'Stationery',
    'Apparel',
    'Other',
  ]);
});

/* ------------------------------------------------------------------ */
/* hasErrors                                                           */
/* ------------------------------------------------------------------ */

test('hasErrors is false for an empty error map', () => {
  assert.equal(hasErrors({}), false);
});

test('hasErrors is true once any field has failed', () => {
  assert.equal(hasErrors({ sku: 'SKU is required.' }), true);
});

/* ------------------------------------------------------------------ */
/* validateProduct - happy path and normalisation                      */
/* ------------------------------------------------------------------ */

test('validateProduct accepts a well-formed payload', () => {
  const { errors } = validateProduct(validPayload());
  assert.deepEqual(errors, {});
});

test('validateProduct returns normalised values ready for the repository', () => {
  const { value } = validateProduct(validPayload());
  assert.deepEqual(value, {
    name: 'Mechanical Keyboard',
    sku: 'KBD-3003',
    category: 'Electronics',
    price: 129.99,
    quantity: 5,
    inStock: true,
    description: 'Hot-swappable, 75% layout.',
  });
});

test('validateProduct upper-cases the SKU', () => {
  const { value } = validateProduct(validPayload({ sku: 'kbd-3003' }));
  assert.equal(value.sku, 'KBD-3003');
});

test('validateProduct trims surrounding whitespace from the name', () => {
  const { value } = validateProduct(validPayload({ name: '   Desk Lamp   ' }));
  assert.equal(value.name, 'Desk Lamp');
});

test('validateProduct trims the description', () => {
  const { value } = validateProduct(validPayload({ description: '  tidy  ' }));
  assert.equal(value.description, 'tidy');
});

test('validateProduct treats a non-object body as empty rather than throwing', () => {
  const { errors } = validateProduct(null);
  assert.equal(hasErrors(errors), true);
  assert.ok(errors.name);
  assert.ok(errors.sku);
  assert.ok(errors.category);
});

/* ------------------------------------------------------------------ */
/* validateProduct - name                                              */
/* ------------------------------------------------------------------ */

test('validateProduct rejects a name shorter than 2 characters', () => {
  const { errors } = validateProduct(validPayload({ name: 'A' }));
  assert.equal(errors.name, 'Name must be at least 2 characters.');
});

test('validateProduct rejects a name that is only whitespace', () => {
  const { errors } = validateProduct(validPayload({ name: '    ' }));
  assert.equal(errors.name, 'Name must be at least 2 characters.');
});

test('validateProduct rejects a name longer than 120 characters', () => {
  const { errors } = validateProduct(validPayload({ name: 'a'.repeat(121) }));
  assert.equal(errors.name, 'Name must be 120 characters or fewer.');
});

test('validateProduct accepts a name of exactly 120 characters', () => {
  const { errors } = validateProduct(validPayload({ name: 'a'.repeat(120) }));
  assert.equal(errors.name, undefined);
});

/* ------------------------------------------------------------------ */
/* validateProduct - SKU                                               */
/* ------------------------------------------------------------------ */

test('validateProduct requires a SKU', () => {
  const { errors } = validateProduct(validPayload({ sku: '' }));
  assert.equal(errors.sku, 'SKU is required.');
});

test('validateProduct rejects a SKU longer than 40 characters', () => {
  const { errors } = validateProduct(validPayload({ sku: 'A'.repeat(41) }));
  assert.equal(errors.sku, 'SKU must be 40 characters or fewer.');
});

test('validateProduct rejects a single-character SKU', () => {
  const { errors } = validateProduct(validPayload({ sku: 'A' }));
  assert.equal(
    errors.sku,
    'SKU may only contain letters, numbers and dashes (e.g. KBD-3003).',
  );
});

test('validateProduct rejects a SKU containing an underscore', () => {
  const { errors } = validateProduct(validPayload({ sku: 'KBD_3003' }));
  assert.ok(errors.sku);
});

test('validateProduct rejects a SKU starting with a dash', () => {
  const { errors } = validateProduct(validPayload({ sku: '-KBD3003' }));
  assert.ok(errors.sku);
});

test('validateProduct accepts a SKU of letters, digits and dashes', () => {
  const { errors } = validateProduct(validPayload({ sku: 'AB-12-cd' }));
  assert.equal(errors.sku, undefined);
});

/* ------------------------------------------------------------------ */
/* validateProduct - category                                          */
/* ------------------------------------------------------------------ */

test('validateProduct requires a category', () => {
  const { errors } = validateProduct(validPayload({ category: '' }));
  assert.equal(errors.category, 'Category is required.');
});

test('validateProduct rejects a category outside the allow-list', () => {
  const { errors } = validateProduct(validPayload({ category: 'Groceries' }));
  assert.equal(
    errors.category,
    'Category must be one of: Electronics, Furniture, Stationery, Apparel, Other.',
  );
});

test('validateProduct is case-sensitive about categories', () => {
  const { errors } = validateProduct(validPayload({ category: 'electronics' }));
  assert.ok(errors.category);
});

/* ------------------------------------------------------------------ */
/* validateProduct - price                                             */
/* ------------------------------------------------------------------ */

test('validateProduct coerces a numeric price string', () => {
  const { errors, value } = validateProduct(validPayload({ price: '19.99' }));
  assert.equal(errors.price, undefined);
  assert.equal(value.price, 19.99);
});

test('validateProduct rejects a non-numeric price', () => {
  const { errors } = validateProduct(validPayload({ price: 'free' }));
  assert.equal(errors.price, 'Price must be a number.');
});

test('validateProduct rejects an empty price', () => {
  const { errors } = validateProduct(validPayload({ price: '' }));
  assert.equal(errors.price, 'Price must be a number.');
});

test('validateProduct rejects a negative price', () => {
  const { errors } = validateProduct(validPayload({ price: -1 }));
  assert.equal(errors.price, 'Price cannot be negative.');
});

test('validateProduct accepts a price of zero', () => {
  const { errors, value } = validateProduct(validPayload({ price: 0 }));
  assert.equal(errors.price, undefined);
  assert.equal(value.price, 0);
});

test('validateProduct rejects a price above the maximum', () => {
  const { errors } = validateProduct(validPayload({ price: 1_000_001 }));
  assert.equal(errors.price, 'Price cannot exceed 1000000.');
});

test('validateProduct rounds the price down to two decimal places', () => {
  const { value } = validateProduct(validPayload({ price: 12.344 }));
  assert.equal(value.price, 12.34);
});

test('validateProduct rounds the price up to two decimal places', () => {
  const { value } = validateProduct(validPayload({ price: 12.346 }));
  assert.equal(value.price, 12.35);
});

/* ------------------------------------------------------------------ */
/* validateProduct - quantity                                          */
/* ------------------------------------------------------------------ */

test('validateProduct coerces an integer quantity string', () => {
  const { errors, value } = validateProduct(validPayload({ quantity: '7' }));
  assert.equal(errors.quantity, undefined);
  assert.equal(value.quantity, 7);
});

test('validateProduct rejects a fractional quantity', () => {
  const { errors } = validateProduct(validPayload({ quantity: 1.5 }));
  assert.equal(errors.quantity, 'Quantity must be a whole number.');
});

test('validateProduct rejects a non-numeric quantity', () => {
  const { errors } = validateProduct(validPayload({ quantity: 'many' }));
  assert.equal(errors.quantity, 'Quantity must be a whole number.');
});

test('validateProduct rejects a negative quantity', () => {
  const { errors } = validateProduct(validPayload({ quantity: -2 }));
  assert.equal(errors.quantity, 'Quantity cannot be negative.');
});

test('validateProduct rejects a quantity above the maximum', () => {
  const { errors } = validateProduct(validPayload({ quantity: 1_000_001 }));
  assert.equal(errors.quantity, 'Quantity cannot exceed 1000000.');
});

/* ------------------------------------------------------------------ */
/* validateProduct - inStock                                           */
/* ------------------------------------------------------------------ */

test('validateProduct defaults inStock to true when there is stock', () => {
  const payload = validPayload({ quantity: 3 });
  delete payload.inStock;
  const { value } = validateProduct(payload);
  assert.equal(value.inStock, true);
});

test('validateProduct defaults inStock to false when quantity is zero', () => {
  const payload = validPayload({ quantity: 0 });
  delete payload.inStock;
  const { value } = validateProduct(payload);
  assert.equal(value.inStock, false);
});

test('validateProduct treats an empty inStock as "derive from quantity"', () => {
  const { value } = validateProduct(validPayload({ quantity: 0, inStock: '' }));
  assert.equal(value.inStock, false);
});

test('validateProduct honours an explicit false even with stock on hand', () => {
  const { errors, value } = validateProduct(
    validPayload({ quantity: 9, inStock: false }),
  );
  assert.equal(errors.inStock, undefined);
  assert.equal(value.inStock, false);
});

test('validateProduct accepts the string "false" for inStock', () => {
  const { value } = validateProduct(validPayload({ inStock: 'false' }));
  assert.equal(value.inStock, false);
});

test('validateProduct accepts the string "true" for inStock', () => {
  const { value } = validateProduct(validPayload({ quantity: 0, inStock: 'true' }));
  assert.equal(value.inStock, true);
});

test('validateProduct accepts 1 and 0 for inStock', () => {
  assert.equal(validateProduct(validPayload({ inStock: 1 })).value.inStock, true);
  assert.equal(validateProduct(validPayload({ inStock: 0 })).value.inStock, false);
});

test('validateProduct accepts the snake_case in_stock alias', () => {
  const payload = validPayload({ quantity: 4 });
  delete payload.inStock;
  payload.in_stock = false;
  const { value } = validateProduct(payload);
  assert.equal(value.inStock, false);
});

test('validateProduct rejects an uninterpretable inStock value', () => {
  const { errors } = validateProduct(validPayload({ inStock: 'maybe' }));
  assert.equal(errors.inStock, 'In stock must be true or false.');
});

/* ------------------------------------------------------------------ */
/* validateProduct - description                                       */
/* ------------------------------------------------------------------ */

test('validateProduct allows an omitted description and defaults it to empty', () => {
  const payload = validPayload();
  delete payload.description;
  const { errors, value } = validateProduct(payload);
  assert.equal(errors.description, undefined);
  assert.equal(value.description, '');
});

test('validateProduct rejects a description longer than 500 characters', () => {
  const { errors } = validateProduct(validPayload({ description: 'x'.repeat(501) }));
  assert.equal(errors.description, 'Description must be 500 characters or fewer.');
});

test('validateProduct accepts a description of exactly 500 characters', () => {
  const { errors } = validateProduct(validPayload({ description: 'x'.repeat(500) }));
  assert.equal(errors.description, undefined);
});

/* ------------------------------------------------------------------ */
/* validateId                                                          */
/* ------------------------------------------------------------------ */

test('validateId accepts a positive integer string', () => {
  const { errors, value } = validateId('5');
  assert.deepEqual(errors, {});
  assert.equal(value, 5);
});

test('validateId accepts a number', () => {
  const { value } = validateId(7);
  assert.equal(value, 7);
});

test('validateId tolerates surrounding whitespace', () => {
  const { errors, value } = validateId(' 7 ');
  assert.deepEqual(errors, {});
  assert.equal(value, 7);
});

test('validateId rejects zero', () => {
  const { errors, value } = validateId('0');
  assert.equal(errors.id, 'Id must be a positive integer.');
  assert.equal(value, undefined);
});

test('validateId rejects a negative id', () => {
  const { errors } = validateId('-3');
  assert.ok(errors.id);
});

test('validateId rejects a non-numeric id', () => {
  const { errors } = validateId('abc');
  assert.ok(errors.id);
});

test('validateId rejects a fractional id rather than truncating it', () => {
  const { errors } = validateId('1.5');
  assert.ok(errors.id);
});

test('validateId rejects a numeric prefix followed by text', () => {
  const { errors } = validateId('7abc');
  assert.ok(errors.id);
});

test('validateId rejects undefined', () => {
  const { errors } = validateId(undefined);
  assert.ok(errors.id);
});

/* ------------------------------------------------------------------ */
/* validateListQuery                                                   */
/* ------------------------------------------------------------------ */

test('validateListQuery supplies defaults for an absent query', () => {
  const { errors, value } = validateListQuery();
  assert.deepEqual(errors, {});
  assert.deepEqual(value, {
    search: '',
    category: '',
    sortBy: 'created_at',
    sortDir: 'desc',
  });
});

test('validateListQuery trims the search term', () => {
  const { value } = validateListQuery({ search: '  keyboard  ' });
  assert.equal(value.search, 'keyboard');
});

test('validateListQuery caps the search term at 120 characters', () => {
  const { value } = validateListQuery({ search: 'z'.repeat(200) });
  assert.equal(value.search, 'z'.repeat(120));
});

test('validateListQuery keeps a known category', () => {
  const { value } = validateListQuery({ category: 'Furniture' });
  assert.equal(value.category, 'Furniture');
});

test('validateListQuery discards an unknown category instead of failing', () => {
  const { errors, value } = validateListQuery({ category: 'Groceries' });
  assert.deepEqual(errors, {});
  assert.equal(value.category, '');
});

test('validateListQuery accepts every allow-listed sort column', () => {
  for (const sortBy of ['name', 'price', 'quantity', 'created_at']) {
    assert.equal(validateListQuery({ sortBy }).value.sortBy, sortBy);
  }
});

test('validateListQuery falls back to created_at for an unknown sort column', () => {
  // This is the SQL-injection guard: sortBy is interpolated into ORDER BY.
  const { value } = validateListQuery({ sortBy: 'id; DROP TABLE products' });
  assert.equal(value.sortBy, 'created_at');
});

test('validateListQuery accepts an ascending direction', () => {
  assert.equal(validateListQuery({ sortDir: 'asc' }).value.sortDir, 'asc');
});

test('validateListQuery treats any other direction as descending', () => {
  assert.equal(validateListQuery({ sortDir: 'sideways' }).value.sortDir, 'desc');
  assert.equal(validateListQuery({ sortDir: 'ASC' }).value.sortDir, 'desc');
});
