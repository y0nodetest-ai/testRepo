import { getDb } from './db.js';

/** Maps a raw sqlite row to the JSON shape the frontend consumes. */
function toProduct(row) {
  if (!row) return undefined;
  return {
    id: Number(row.id),
    name: row.name,
    sku: row.sku,
    category: row.category,
    price: Number(row.price),
    quantity: Number(row.quantity),
    inStock: Number(row.in_stock) === 1,
    description: row.description ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS = `
  id, name, sku, category, price, quantity, in_stock, description, created_at, updated_at
`;

export function listProducts({ search = '', category = '', sortBy = 'created_at', sortDir = 'desc' } = {}) {
  const clauses = [];
  const params = [];

  if (search) {
    clauses.push('(name LIKE ? COLLATE NOCASE OR sku LIKE ? COLLATE NOCASE)');
    const like = `%${search}%`;
    params.push(like, like);
  }

  if (category) {
    clauses.push('category = ?');
    params.push(category);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  // `sortBy` / `sortDir` are allow-listed in validation.js before reaching this point,
  // so they are safe to interpolate. All user values go through bound parameters.
  const orderBy = `ORDER BY ${sortBy} ${sortDir === 'asc' ? 'ASC' : 'DESC'}, id DESC`;

  const rows = getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM products ${where} ${orderBy}`)
    .all(...params);

  return rows.map(toProduct);
}

export function getProductById(id) {
  const row = getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM products WHERE id = ?`)
    .get(id);
  return toProduct(row);
}

export function findBySku(sku, excludeId) {
  const db = getDb();
  const row = excludeId
    ? db.prepare('SELECT id FROM products WHERE sku = ? COLLATE NOCASE AND id <> ?').get(sku, excludeId)
    : db.prepare('SELECT id FROM products WHERE sku = ? COLLATE NOCASE').get(sku);
  return row ? Number(row.id) : undefined;
}

export function createProduct(input) {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `INSERT INTO products
         (name, sku, category, price, quantity, in_stock, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.sku,
      input.category,
      input.price,
      input.quantity,
      input.inStock ? 1 : 0,
      input.description,
      now,
      now,
    );

  return getProductById(Number(result.lastInsertRowid));
}

export function updateProduct(id, input) {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `UPDATE products
          SET name = ?, sku = ?, category = ?, price = ?, quantity = ?,
              in_stock = ?, description = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(
      input.name,
      input.sku,
      input.category,
      input.price,
      input.quantity,
      input.inStock ? 1 : 0,
      input.description,
      now,
      id,
    );

  if (result.changes === 0) return undefined;
  return getProductById(id);
}

export function deleteProduct(id) {
  const result = getDb().prepare('DELETE FROM products WHERE id = ?').run(id);
  return result.changes > 0;
}
