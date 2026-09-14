const TCGDEX_BASE_URL = 'https://api.tcgdex.net/v2/en';

export const getSets = async () => {
  const response = await fetch(`${TCGDEX_BASE_URL}/sets`);

  if (!response.ok) {
    throw new Error(`TCGdex error: ${response.status}`);
  }

  return response.json();
};

export const getSet = async (id: string) => {
  const response = await fetch(`${TCGDEX_BASE_URL}/sets/${id}`);

  if (!response.ok) {
    throw new Error(`TCGdex error: ${response.status}`);
  }

  return response.json();
};

export const getCard = async (id: string) => {
  const response = await fetch(`${TCGDEX_BASE_URL}/cards/${id}`);

  if (!response.ok) {
    throw new Error(`TCGdex error: ${response.status}`);
  }

  return response.json();
};
