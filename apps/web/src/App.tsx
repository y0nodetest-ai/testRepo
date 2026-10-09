import { useCallback, useEffect, useState } from 'react';

import { ProductFormPage } from './pages/ProductFormPage';
import { ProductsListPage } from './pages/ProductsListPage';
import { navigate, paths, useRoute } from './router';

interface Flash {
  kind: 'success' | 'error';
  message: string;
  key: number;
}

export default function App() {
  const route = useRoute();
  const [flash, setFlash] = useState<Flash | null>(null);

  const onFlash = useCallback((kind: Flash['kind'], message: string) => {
    setFlash({ kind, message, key: Date.now() });
  }, []);

  // Auto-dismiss so stale confirmations do not linger.
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 5000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  return (
    <div className="app">
      <nav className="topbar" aria-label="Main">
        <button type="button" className="brand" onClick={() => navigate(paths.list)}>
          Product Inventory
        </button>
        <div className="topbar-links">
          <button
            type="button"
            className={route.name === 'list' ? 'navlink navlink-active' : 'navlink'}
            aria-current={route.name === 'list' ? 'page' : undefined}
            onClick={() => navigate(paths.list)}
          >
            Listing
          </button>
          <button
            type="button"
            className={route.name === 'create' ? 'navlink navlink-active' : 'navlink'}
            aria-current={route.name === 'create' ? 'page' : undefined}
            onClick={() => navigate(paths.create)}
          >
            Form
          </button>
        </div>
      </nav>

      <main className="container">
        {/* Screen readers announce flash messages without stealing focus. */}
        <div aria-live="polite" aria-atomic="true">
          {flash && (
            <div
              key={flash.key}
              className={flash.kind === 'success' ? 'banner banner-success' : 'banner banner-error'}
            >
              <span>{flash.message}</span>
              <button
                type="button"
                className="btn btn-ghost"
                aria-label="Dismiss message"
                onClick={() => setFlash(null)}
              >
                ×
              </button>
            </div>
          )}
        </div>

        {route.name === 'list' && <ProductsListPage onFlash={onFlash} />}
        {route.name === 'create' && <ProductFormPage onFlash={onFlash} />}
        {route.name === 'edit' && <ProductFormPage productId={route.id} onFlash={onFlash} />}
      </main>
    </div>
  );
}
