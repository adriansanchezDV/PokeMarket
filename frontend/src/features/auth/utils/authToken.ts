interface JwtPayload {
  exp?: number;
}

export function getTokenExpiration(token: string): number | null {
  try {
    const payload = token.split('.')[1];

    if (!payload) {
      return null;
    }

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');

    const decoded = JSON.parse(atob(base64)) as JwtPayload;

    if (typeof decoded.exp !== 'number' || !Number.isFinite(decoded.exp)) {
      return null;
    }

    return decoded.exp * 1000;
  } catch {
    return null;
  }
}
