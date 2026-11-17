export interface ProductCard {
  id: number;
  name: string;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  artist: string | null;
  category: string | null;
  hp: number | null;
  types: string[] | null;
  setId: number;
}

export interface ProductSeller {
  id: number;
  storeName: string;
  description: string | null;
}

export interface Product {
  id: number;
  sellerProfileId: number;
  cardId: number;
  condition: string;
  language: string;
  price: string;
  stock: number;
  isActive: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
  card: ProductCard;
  sellerProfile: ProductSeller;
  isFavorite: boolean;
}

export interface ProductsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProductsResponse {
  data: Product[];
  pagination: ProductsPagination;
}

export interface ProductDetailCard {
  id: number;
  name: string;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
}

export interface ProductDetail extends Omit<Product, 'card'> {
  card: ProductDetailCard;
}

export type ProductSort = 'id' | 'price' | 'stock' | 'createdAt';

export type ProductOrder = 'ASC' | 'DESC';

export interface ProductsFilters {
  cardId?: number;
  sellerProfileId?: number;
  condition?: string;
  language?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  setId?: number;
  rarity?: string;
  category?: string;
  number?: string;
  artist?: string;
  type?: string;
  minHp?: number;
  maxHp?: number;
  page?: number;
  limit?: number;
  sort?: ProductSort;
  order?: ProductOrder;
}
