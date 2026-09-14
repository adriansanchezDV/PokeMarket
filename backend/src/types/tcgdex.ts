export interface TcgdexSet {
  id: string;
  name: string;
  serie?: {
    name: string;
  };
  releaseDate?: string;
  cardCount?: {
    total: number;
    official?: number;
  };
  logo?: string;
  symbol?: string;
  cards?: TcgdexSetCard[];
}

export interface TcgdexSetCard {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

export interface TcgdexCard {
  id: string;
  localId: string;
  name: string;
  image?: string;
  category?: string;
  illustrator?: string;
  rarity?: string;
  hp?: number;
  description?: string;
  types?: string[];
  set: {
    id: string;
    name: string;
  };
}
