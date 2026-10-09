import { Router } from 'express';

import * as repo from './products.repository.js';
import { CATEGORIES, hasErrors, validateId, validateListQuery, validateProduct } from './validation.js';

function fail(res, status, message, fields) {
  return res.status(status).json({ error: { message, ...(fields ? { fields } : {}) } });
}

export const productsRouter = Router();

/** Lets the form build its category dropdown from a single source of truth. */
productsRouter.get('/meta', (_req, res) => {
  res.json({ categories: CATEGORIES });
});

// READ (list) -------------------------------------------------------------
productsRouter.get('/', (req, res) => {
  const { value: query } = validateListQuery(req.query);
  const items = repo.listProducts(query);
  res.json({ items, total: items.length, query });
});

// READ (one) --------------------------------------------------------------
productsRouter.get('/:id', (req, res) => {
  const { errors, value: id } = validateId(req.params.id);
  if (hasErrors(errors)) return fail(res, 400, 'Invalid product id.', errors);

  const product = repo.getProductById(id);
  if (!product) return fail(res, 404, `Product ${id} was not found.`);

  res.json(product);
});

// CREATE ------------------------------------------------------------------
productsRouter.post('/', (req, res) => {
  const { errors, value } = validateProduct(req.body);
  if (hasErrors(errors)) return fail(res, 422, 'Please fix the highlighted fields.', errors);

  if (repo.findBySku(value.sku)) {
    return fail(res, 409, 'That SKU is already in use.', { sku: 'A product with this SKU already exists.' });
  }

  res.status(201).json(repo.createProduct(value));
});

// UPDATE ------------------------------------------------------------------
productsRouter.put('/:id', (req, res) => {
  const { errors: idErrors, value: id } = validateId(req.params.id);
  if (hasErrors(idErrors)) return fail(res, 400, 'Invalid product id.', idErrors);

  const { errors, value } = validateProduct(req.body);
  if (hasErrors(errors)) return fail(res, 422, 'Please fix the highlighted fields.', errors);

  if (!repo.getProductById(id)) return fail(res, 404, `Product ${id} was not found.`);

  if (repo.findBySku(value.sku, id)) {
    return fail(res, 409, 'That SKU is already in use.', { sku: 'A product with this SKU already exists.' });
  }

  const updated = repo.updateProduct(id, value);
  if (!updated) return fail(res, 404, `Product ${id} was not found.`);

  res.json(updated);
});

// DELETE ------------------------------------------------------------------
productsRouter.delete('/:id', (req, res) => {
  const { errors, value: id } = validateId(req.params.id);
  if (hasErrors(errors)) return fail(res, 400, 'Invalid product id.', errors);

  if (!repo.deleteProduct(id)) return fail(res, 404, `Product ${id} was not found.`);

  res.status(204).end();
});
