/**
 * Hand-rolled validation so the API stays dependency-light.
 * Every validator returns `{ value, errors }` where `errors` maps field -> message.
 */

export const CATEGORIES = ['Electronics', 'Furniture', 'Stationery', 'Apparel', 'Other'];

const MAX_NAME = 120;
const MAX_SKU = 40;
const MAX_DESCRIPTION = 500;
const MAX_PRICE = 1_000_000;
const MAX_QUANTITY = 1_000_000;

const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{1,39}$/;

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
}

function asBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return undefined;
}

/**
 * Validates a full product payload (used by both POST and PUT).
 * Returns normalised values ready to hand to the repository.
 */
export function validateProduct(body) {
  const errors = {};
  const payload = body && typeof body === 'object' ? body : {};

  const name = asTrimmedString(payload.name);
  if (name.length < 2) {
    errors.name = 'Name must be at least 2 characters.';
  } else if (name.length > MAX_NAME) {
    errors.name = `Name must be ${MAX_NAME} characters or fewer.`;
  }

  const sku = asTrimmedString(payload.sku).toUpperCase();
  if (!sku) {
    errors.sku = 'SKU is required.';
  } else if (sku.length > MAX_SKU) {
    errors.sku = `SKU must be ${MAX_SKU} characters or fewer.`;
  } else if (!SKU_PATTERN.test(sku)) {
    errors.sku = 'SKU may only contain letters, numbers and dashes (e.g. KBD-3003).';
  }

  const category = asTrimmedString(payload.category);
  if (!category) {
    errors.category = 'Category is required.';
  } else if (!CATEGORIES.includes(category)) {
    errors.category = `Category must be one of: ${CATEGORIES.join(', ')}.`;
  }

  const price = asNumber(payload.price);
  if (!Number.isFinite(price)) {
    errors.price = 'Price must be a number.';
  } else if (price < 0) {
    errors.price = 'Price cannot be negative.';
  } else if (price > MAX_PRICE) {
    errors.price = `Price cannot exceed ${MAX_PRICE}.`;
  }

  const quantity = asNumber(payload.quantity);
  if (!Number.isInteger(quantity)) {
    errors.quantity = 'Quantity must be a whole number.';
  } else if (quantity < 0) {
    errors.quantity = 'Quantity cannot be negative.';
  } else if (quantity > MAX_QUANTITY) {
    errors.quantity = `Quantity cannot exceed ${MAX_QUANTITY}.`;
  }

  // Defaults to "in stock when there is stock" if the client omits the flag.
  const inStockRaw = payload.inStock ?? payload.in_stock;
  let inStock = asBoolean(inStockRaw);
  if (inStockRaw === undefined || inStockRaw === null || inStockRaw === '') {
    inStock = Number.isInteger(quantity) ? quantity > 0 : true;
  } else if (inStock === undefined) {
    errors.inStock = 'In stock must be true or false.';
  }

  const description = asTrimmedString(payload.description);
  if (description.length > MAX_DESCRIPTION) {
    errors.description = `Description must be ${MAX_DESCRIPTION} characters or fewer.`;
  }

  return {
    errors,
    value: {
      name,
      sku,
      category,
      price: Number.isFinite(price) ? Math.round(price * 100) / 100 : price,
      quantity,
      inStock: Boolean(inStock),
      description,
    },
  };
}

/** Validates an `:id` route param. */
export function validateId(raw) {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id < 1 || String(id) !== String(raw).trim()) {
    return { errors: { id: 'Id must be a positive integer.' }, value: undefined };
  }
  return { errors: {}, value: id };
}

/** Validates/normalises the list query string. */
export function validateListQuery(query = {}) {
  const search = asTrimmedString(query.search).slice(0, 120);

  const category = asTrimmedString(query.category);
  const sortBy = ['name', 'price', 'quantity', 'created_at'].includes(query.sortBy)
    ? query.sortBy
    : 'created_at';
  const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

  return {
    errors: {},
    value: {
      search,
      category: CATEGORIES.includes(category) ? category : '',
      sortBy,
      sortDir,
    },
  };
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}
