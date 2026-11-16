export interface PokemonSet {
  id: number;
  tcgdexId: string;
  name: string;
  series: string | null;
  releaseDate: string | null;
  totalCards: number | null;
  logoUrl: string | null;
  symbolUrl: string | null;
  created_at: string;
  updated_at: string;
}
