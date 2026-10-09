import { useSyncExternalStore } from 'react';

/**
 * Tiny hash-based router. Three routes is not worth a routing dependency,
 * but we still want shareable URLs and working back/forward buttons.
 */
export type Route =
  | { name: 'list' }
  | { name: 'create' }
  | { name: 'edit'; id: number };

export const paths = {
  list: '#/products',
  create: '#/products/new',
  edit: (id: number) => `#/products/${id}/edit`,
};

export function parseHash(hash: string): Route {
  const segments = hash.replace(/^#\/?/, '').split('/').filter(Boolean);

  // ['products', 'new'] | ['products', '12', 'edit'] | ['products'] | []
  if (segments[0] === 'products') {
    if (segments[1] === 'new') return { name: 'create' };

    if (segments[1] && segments[2] === 'edit') {
      const id = Number.parseInt(segments[1], 10);
      if (Number.isInteger(id) && id > 0) return { name: 'edit', id };
    }
  }

  return { name: 'list' };
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function getSnapshot() {
  return window.location.hash;
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getSnapshot, () => paths.list);
  return parseHash(hash);
}

export function navigate(hash: string): void {
  if (window.location.hash === hash) return;
  window.location.hash = hash;
}
