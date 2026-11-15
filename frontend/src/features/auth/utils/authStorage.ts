const AUTH_TOKEN_KEY = 'pokemarket_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // El almacenamiento puede no estar disponible.
  }
}

export function removeToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // El almacenamiento puede no estar disponible.
  }
}
