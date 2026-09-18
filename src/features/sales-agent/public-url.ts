/**
 * @description Resuelve el origen público canónico sin confiar en headers de la solicitud.
 * @returns {string | null} Origen HTTPS configurado, localhost de desarrollo o null seguro.
 */
export function getConfiguredPublicAppUrl(): string | null {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    const isLocalDevelopment =
      process.env.NODE_ENV !== 'production' &&
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !isLocalDevelopment) return null;
    return url.origin;
  } catch {
    return null;
  }
}
