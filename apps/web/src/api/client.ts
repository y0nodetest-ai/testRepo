import type {
  FieldErrors,
  ListQuery,
  Product,
  ProductInput,
  ProductListResponse,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

/** Error that carries the API's per-field messages so the form can show them inline. */
export class ApiError extends Error {
  readonly status: number;
  readonly fields: FieldErrors;

  constructor(message: string, status: number, fields: FieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

interface ApiErrorBody {
  error?: { message?: string; fields?: FieldErrors };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    });
  } catch {
    throw new ApiError('Cannot reach the API. Is it running on port 4000?', 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const body: unknown = text ? safeJsonParse(text) : undefined;

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | undefined;
    throw new ApiError(
      errorBody?.error?.message ?? `Request failed with status ${response.status}.`,
      response.status,
      errorBody?.error?.fields ?? {},
    );
  }

  return body as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toQueryString(query: Partial<ListQuery>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const serialised = params.toString();
  return serialised ? `?${serialised}` : '';
}

export const productsApi = {
  list: (query: Partial<ListQuery> = {}) =>
    request<ProductListResponse>(`/products${toQueryString(query)}`),

  get: (id: number) => request<Product>(`/products/${id}`),

  categories: () =>
    request<{ categories: string[] }>('/products/meta').then((body) => body.categories),

  create: (input: ProductInput) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(input) }),

  update: (id: number, input: ProductInput) =>
    request<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(input) }),

  remove: (id: number) => request<void>(`/products/${id}`, { method: 'DELETE' }),
};
