import { clearAccessToken, getAccessToken } from './tokenStorage';

/**
 * Utilidades de autenticación (JWT en memoria).
 * Decodifica sin verificar firma; la verificación real la hace el backend.
 */

export function decodeJWT(token) {
  if (!token || typeof token !== 'string') return null;

  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Devuelve los datos del usuario desde el access token en memoria.
 */
export function getUserFromToken() {
  const token = getAccessToken();
  if (!token) return null;

  const decoded = decodeJWT(token);
  if (!decoded) return null;

  return {
    userId: decoded.userId || '',
    nombre: decoded.nombre || '',
    apellido: decoded.apellido || '',
    telefono: decoded.telefono || '',
    rol: decoded.rol || '',
    iat: decoded.iat || null,
    exp: decoded.exp || null,
  };
}

export function getUserRole() {
  const user = getUserFromToken();
  return user?.rol ?? '';
}

export function isTokenExpired() {
  const user = getUserFromToken();
  if (!user?.exp) return true;

  const nowInSeconds = Math.floor(Date.now() / 1000);
  return user.exp <= nowInSeconds;
}

export function clearSession() {
  clearAccessToken();
}
