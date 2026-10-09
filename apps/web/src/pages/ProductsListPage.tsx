import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, productsApi } from '../api/client';
import { navigate, paths } from '../router';
import type { ListQuery, Product } from '../types';

interface Props {
  onFlash: (kind: 'success' | 'error', message: string) => void;
}

const SORT_OPTIONS: Array<{ value: ListQuery['sortBy']; label: string }> = [
  { value: 'created_at', label: 'Date added' },
  { value: 'name', label: 'Name' },
  { value: 'price', label: 'Price' },
  { value: 'quantity', label: 'Quantity' },
];

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

export function ProductsListPage({ onFlash }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState<ListQuery['sortBy']>('created_at');
  const [sortDir, setSortDir] = useState<ListQuery['sortDir']>('desc');

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo<ListQuery>(
    () => ({ search, category, sortBy, sortDir }),
    [search, category, sortBy, sortDir],
  );

  const requestId = useRef(0);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    try {
      const { items } = await productsApi.list(query);
      if (current !== requestId.current) return; // a newer request already won
      setProducts(items);
      setLoadError(null);
    } catch (error) {
      if (current !== requestId.current) return;
      setLoadError(error instanceof ApiError ? error.message : 'Could not load products.');
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    productsApi
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  async function handleDelete(product: Product) {
    const confirmed = window.confirm(`Delete "${product.name}" (${product.sku})? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(product.id);
    try {
      await productsApi.remove(product.id);
      onFlash('success', `Deleted "${product.name}".`);
      await load();
    } catch (error) {
      onFlash('error', error instanceof ApiError ? error.message : 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  }

  const isFiltered = search !== '' || category !== '';

  return (
    <section aria-labelledby="list-heading">
      <header className="page-header">
        <div>
          <h1 id="list-heading">Products</h1>
          <p className="muted">
            {loading ? 'Loading…' : `${products.length} ${products.length === 1 ? 'product' : 'products'}`}
            {isFiltered && !loading ? ' matching your filters' : ''}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate(paths.create)}>
          Add product
        </button>
      </header>

      <div className="toolbar">
        <div className="field">
          <label htmlFor="search">Search name or SKU</label>
          <input
            id="search"
            type="search"
            value={searchInput}
            placeholder="e.g. keyboard or KBD-3003"
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="category-filter">Category</label>
          <select
            id="category-filter"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="sort-by">Sort by</label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as ListQuery['sortBy'])}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="sort-dir">Direction</label>
          <select
            id="sort-dir"
            value={sortDir}
            onChange={(event) => setSortDir(event.target.value as ListQuery['sortDir'])}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>

        {isFiltered && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setSearchInput('');
              setCategory('');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {loadError && (
        <div className="banner banner-error" role="alert">
          <span>{loadError}</span>
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      <div className="table-wrap" aria-busy={loading}>
        <table>
          <caption className="sr-only">Product inventory with edit and delete actions</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">SKU</th>
              <th scope="col">Category</th>
              <th scope="col" className="numeric">
                Price
              </th>
              <th scope="col" className="numeric">
                Qty
              </th>
              <th scope="col">Stock</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!loading && products.length === 0 && !loadError && (
              <tr>
                <td colSpan={7} className="empty">
                  {isFiltered ? (
                    <>No products match those filters.</>
                  ) : (
                    <>
                      Nothing here yet.{' '}
                      <button type="button" className="link" onClick={() => navigate(paths.create)}>
                        Add your first product
                      </button>
                      .
                    </>
                  )}
                </td>
              </tr>
            )}

            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <span className="cell-title">{product.name}</span>
                  {product.description && <span className="cell-sub">{product.description}</span>}
                </td>
                <td><code>{product.sku}</code></td>
                <td>{product.category}</td>
                <td className="numeric">{currency.format(product.price)}</td>
                <td className="numeric">{product.quantity}</td>
                <td>
                  <span className={product.inStock ? 'pill pill-ok' : 'pill pill-off'}>
                    {product.inStock ? 'In stock' : 'Out of stock'}
                  </span>
                </td>
                <td className="actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => navigate(paths.edit(product.id))}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={deletingId === product.id}
                    onClick={() => void handleDelete(product)}
                  >
                    {deletingId === product.id ? 'Deleting…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
