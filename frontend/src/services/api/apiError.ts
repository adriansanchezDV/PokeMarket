export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return fallback;
  }

  if (error.status === 'FETCH_ERROR') {
    return 'No se ha podido conectar con el servidor. Comprueba tu conexión.';
  }

  if (error.status === 429) {
    return 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.';
  }

  if (!('data' in error) || typeof error.data !== 'object' || error.data === null) {
    return fallback;
  }

  const data = error.data;
  const message = 'error' in data ? data.error : 'message' in data ? data.message : undefined;

  if (message === 'Validation failed' && 'details' in data && Array.isArray(data.details)) {
    const details = data.details
      .filter(
        (detail: unknown): detail is { field: string; message: string } =>
          typeof detail === 'object' &&
          detail !== null &&
          'field' in detail &&
          typeof detail.field === 'string' &&
          'message' in detail &&
          typeof detail.message === 'string',
      )
      .map((detail) => `${detail.field}: ${detail.message}`);

    if (details.length > 0) {
      return `Revisa los datos introducidos. ${details.join(' ')}`;
    }
  }

  const messages: Record<string, string> = {
    'Invalid email or password': 'El correo o la contraseña no son correctos.',
    'Email already registered': 'Ya existe una cuenta con ese correo electrónico.',
    'User account is banned': 'Tu cuenta está bloqueada.',
    'Invalid or expired token': 'Tu sesión ha caducado. Inicia sesión de nuevo.',
    'Seller profile is inactive': 'Tu tienda está desactivada.',
    'Insufficient permissions': 'No tienes permisos para realizar esta operación.',
    'Seller profile already exists': 'Ya tienes un perfil de vendedor.',
    'Store name already registered': 'Ya existe una tienda con ese nombre.',
    'Validation failed': 'Revisa los datos introducidos.',
  };

  if (typeof message === 'string' && messages[message]) {
    return messages[message];
  }

  return fallback;
}
