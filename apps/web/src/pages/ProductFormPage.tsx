import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { ApiError, productsApi } from '../api/client';
import { navigate, paths } from '../router';
import type { FieldErrors, ProductInput } from '../types';

interface Props {
  /** Present when editing an existing product; omitted when creating. */
  productId?: number;
  onFlash: (kind: 'success' | 'error', message: string) => void;
}

interface FormState {
  name: string;
  sku: string;
  category: string;
  price: string;
  quantity: string;
  inStock: boolean;
  description: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  sku: '',
  category: '',
  price: '',
  quantity: '',
  inStock: true,
  description: '',
};

const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{1,39}$/;

/** Mirrors the server rules so users get feedback before a round trip. */
function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.';
  else if (form.name.trim().length > 120) errors.name = 'Name must be 120 characters or fewer.';

  const sku = form.sku.trim();
  if (!sku) errors.sku = 'SKU is required.';
  else if (!SKU_PATTERN.test(sku)) errors.sku = 'Use letters, numbers and dashes, e.g. KBD-3003.';

  if (!form.category) errors.category = 'Pick a category.';

  const price = Number(form.price);
  if (form.price.trim() === '') errors.price = 'Price is required.';
  else if (!Number.isFinite(price)) errors.price = 'Price must be a number.';
  else if (price < 0) errors.price = 'Price cannot be negative.';

  const quantity = Number(form.quantity);
  if (form.quantity.trim() === '') errors.quantity = 'Quantity is required.';
  else if (!Number.isInteger(quantity)) errors.quantity = 'Quantity must be a whole number.';
  else if (quantity < 0) errors.quantity = 'Quantity cannot be negative.';

  if (form.description.length > 500) errors.description = 'Description must be 500 characters or fewer.';

  return errors;
}

export function ProductFormPage({ productId, onFlash }: Props) {
  const isEdit = productId !== undefined;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [categories, setCategories] = useState<string[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    productsApi
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (productId === undefined) {
      setForm(EMPTY_FORM);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    productsApi
      .get(productId)
      .then((product) => {
        if (cancelled) return;
        setForm({
          name: product.name,
          sku: product.sku,
          category: product.category,
          price: String(product.price),
          quantity: String(product.quantity),
          inStock: product.inStock,
          description: product.description,
        });
        setFormError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFormError(error instanceof ApiError ? error.message : 'Could not load that product.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    // Clear the field error as soon as the user edits that field.
    setErrors((previous) => {
      if (!(key in previous)) return previous;
      const next = { ...previous };
      delete next[key as keyof FieldErrors];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const clientErrors = validate(form);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setFormError('Please fix the highlighted fields.');
      return;
    }

    const input: ProductInput = {
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      category: form.category,
      price: Number(form.price),
      quantity: Number(form.quantity),
      inStock: form.inStock,
      description: form.description.trim(),
    };

    setSaving(true);
    setFormError(null);

    try {
      const saved =
        productId !== undefined
          ? await productsApi.update(productId, input)
          : await productsApi.create(input);

      onFlash('success', productId !== undefined ? `Updated "${saved.name}".` : `Created "${saved.name}".`);
      navigate(paths.list);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fields);
        setFormError(error.message);
      } else {
        setFormError('Save failed. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section aria-labelledby="form-heading">
        <h1 id="form-heading">{isEdit ? 'Edit product' : 'New product'}</h1>
        <p className="muted">Loading…</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="form-heading">
      <header className="page-header">
        <div>
          <h1 id="form-heading">{isEdit ? 'Edit product' : 'New product'}</h1>
          <p className="muted">
            {isEdit ? 'Update the details and save your changes.' : 'Fill in the details to add a product.'}
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => navigate(paths.list)}>
          Back to list
        </button>
      </header>

      {formError && (
        <div className="banner banner-error" role="alert">
          {formError}
        </div>
      )}

      <form className="card form" onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="name">
              Name <span aria-hidden="true">*</span>
            </label>
            <input
              id="name"
              name="name"
              value={form.name}
              required
              maxLength={120}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'name-error' : undefined}
              onChange={(event) => update('name', event.target.value)}
            />
            {errors.name && (
              <p className="field-error" id="name-error">
                {errors.name}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="sku">
              SKU <span aria-hidden="true">*</span>
            </label>
            <input
              id="sku"
              name="sku"
              value={form.sku}
              required
              maxLength={40}
              placeholder="KBD-3003"
              aria-invalid={Boolean(errors.sku)}
              aria-describedby={errors.sku ? 'sku-error' : 'sku-hint'}
              onChange={(event) => update('sku', event.target.value)}
            />
            {errors.sku ? (
              <p className="field-error" id="sku-error">
                {errors.sku}
              </p>
            ) : (
              <p className="field-hint" id="sku-hint">
                Must be unique. Letters, numbers and dashes.
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="category">
              Category <span aria-hidden="true">*</span>
            </label>
            <select
              id="category"
              name="category"
              value={form.category}
              required
              aria-invalid={Boolean(errors.category)}
              aria-describedby={errors.category ? 'category-error' : undefined}
              onChange={(event) => update('category', event.target.value)}
            >
              <option value="">Select a category…</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="field-error" id="category-error">
                {errors.category}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="price">
              Price (USD) <span aria-hidden="true">*</span>
            </label>
            <input
              id="price"
              name="price"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.price}
              required
              aria-invalid={Boolean(errors.price)}
              aria-describedby={errors.price ? 'price-error' : undefined}
              onChange={(event) => update('price', event.target.value)}
            />
            {errors.price && (
              <p className="field-error" id="price-error">
                {errors.price}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="quantity">
              Quantity <span aria-hidden="true">*</span>
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              value={form.quantity}
              required
              aria-invalid={Boolean(errors.quantity)}
              aria-describedby={errors.quantity ? 'quantity-error' : undefined}
              onChange={(event) => update('quantity', event.target.value)}
            />
            {errors.quantity && (
              <p className="field-error" id="quantity-error">
                {errors.quantity}
              </p>
            )}
          </div>

          <div className="field field-checkbox">
            <input
              id="inStock"
              name="inStock"
              type="checkbox"
              checked={form.inStock}
              onChange={(event) => update('inStock', event.target.checked)}
            />
            <label htmlFor="inStock">Available for sale</label>
          </div>

          <div className="field field-wide">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={500}
              value={form.description}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? 'description-error' : 'description-hint'}
              onChange={(event) => update('description', event.target.value)}
            />
            {errors.description ? (
              <p className="field-error" id="description-error">
                {errors.description}
              </p>
            ) : (
              <p className="field-hint" id="description-hint">
                {form.description.length}/500 characters
              </p>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={saving}
            onClick={() => navigate(paths.list)}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
