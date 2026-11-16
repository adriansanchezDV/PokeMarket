export interface PokemonCard {
  id: number;
  tcgdexId: string;
  setId: number;
  name: string;
  number: string;
  rarity: string | null;
  imageUrl: string | null;
  category: string | null;
  hp: number | null;
  artist: string | null;
  description: string | null;
  types: string[];
  created_at: string;
  updated_at: string;
}

export interface CardsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CardsResponse {
  data: PokemonCard[];
  pagination: CardsPagination;
}

export interface CardsFilters {
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
}

export interface CardDetailSet {
  id: number;
  tcgdexId: string;
  name: string;
  series: string | null;
  releaseDate: string | null;
  totalCards: number | null;
  logoUrl: string | null;
  symbolUrl: string | null;
}

export interface CardDetailProduct {
  id: number;
  condition: string;
  language: string;
  price: string;
  stock: number;
  description: string | null;
  seller: {
    id: number;
    storeName: string;
    description: string | null;
  };
}

export interface CardDetail extends Omit<PokemonCard, 'setId' | 'created_at' | 'updated_at'> {
  set: CardDetailSet;
  products: CardDetailProduct[];
}
