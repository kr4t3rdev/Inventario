/**
 * @description Utilidades de token JWT en cliente.
 *
 * DEPRECATED: La autenticación ahora usa cookies httpOnly seteadas
 * por las Server Actions. El token JWT nunca está disponible en JS cliente.
 *
 * getAuthToken() siempre devuelve '' para no enviar Bearer header.
 * El servidor usa la cookie httpOnly 'auth_token' automáticamente.
 *
 * @deprecated Mantenido para compatibilidad. Todas las funciones son no-ops.
 */
export const getAuthToken = (): string => {
  return '';
};

export const setAuthToken = (_token: string): void => {
  // No-op: auth via cookies httpOnly
};

export const clearAuthToken = (): void => {
  // No-op: auth via cookies httpOnly
};
