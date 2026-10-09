export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  price: number;
  quantity: number;
  inStock: boolean;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/** What the form sends to the API. */
export interface ProductInput {
  name: string;
  sku: string;
  category: string;
  price: number;
  quantity: number;
  inStock: boolean;
  description: string;
}

export type FieldErrors = Partial<Record<keyof ProductInput | 'id', string>>;

export interface ListQuery {
  search: string;
  category: string;
  sortBy: 'name' | 'price' | 'quantity' | 'created_at';
  sortDir: 'asc' | 'desc';
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  query: ListQuery;
}
