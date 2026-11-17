export interface Store {
  id: number;
  storeName: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  productCount: number;
  salesCount: number;
  averageRating: number;
  reviewCount: number;
}

export type StoreDetail = Store;

export interface StoreProductCard {
  id: number;
  name: string;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  category: string | null;
  hp: number | null;
  artist: string | null;
  types: string[] | null;
}

export interface StoreProduct {
  id: number;
  condition: string;
  language: string;
  price: string;
  stock: number;
  isActive: boolean;
  description: string | null;
  createdAt: string;
  card: StoreProductCard;
}
