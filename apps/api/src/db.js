import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { config } from './config.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    sku         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    category    TEXT    NOT NULL,
    price       REAL    NOT NULL CHECK (price >= 0),
    quantity    INTEGER NOT NULL CHECK (quantity >= 0),
    in_stock    INTEGER NOT NULL DEFAULT 1 CHECK (in_stock IN (0, 1)),
    description TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
  CREATE INDEX IF NOT EXISTS idx_products_name     ON products (name COLLATE NOCASE);
`;

const SEED_ROWS = [
  ['Aeron Desk Chair', 'CHR-1001', 'Furniture', 899.0, 12, 1, 'Ergonomic mesh office chair.'],
  ['Standing Desk 60"', 'DSK-2002', 'Furniture', 649.5, 4, 1, 'Electric sit/stand desk.'],
  ['Mechanical Keyboard', 'KBD-3003', 'Electronics', 129.99, 0, 0, 'Hot-swappable, 75% layout.'],
  ['4K Monitor 27"', 'MON-4004', 'Electronics', 379.0, 7, 1, 'IPS panel, USB-C power delivery.'],
];

let db;

function seedIfEmpty(database) {
  const { count } = database.prepare('SELECT COUNT(*) AS count FROM products').get();
  if (count > 0) return;

  const now = new Date().toISOString();
  const insert = database.prepare(`
    INSERT INTO products (name, sku, category, price, quantity, in_stock, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  database.exec('BEGIN');
  try {
    for (const row of SEED_ROWS) {
      insert.run(...row, now, now);
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

/** Opens (once) and returns the shared database handle. */
export function getDb() {
  if (db) return db;

  if (config.databaseFile !== ':memory:') {
    fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true });
  }

  db = new DatabaseSync(config.databaseFile);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);

  if (config.seedOnEmpty) {
    seedIfEmpty(db);
  }

  return db;
}

export function closeDb() {
  if (!db) return;
  db.close();
  db = undefined;
}
