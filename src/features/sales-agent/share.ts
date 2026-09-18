/**
 * @description Construye un enlace first-party de registro con código de Gestor.
 * @param {string | null} origin - Origen público canónico o null seguro.
 * @param {string} referralCode - Código autoritativo del Gestor.
 * @returns {string} URL absoluta y codificada.
 */
export function buildSalesAgentShareUrl(origin: string | null, referralCode: string): string {
  if (!origin) return `/register?ref=${encodeURIComponent(referralCode)}`;
  const url = new URL('/register', origin);
  url.searchParams.set('ref', referralCode);
  return url.toString();
}

/**
 * @description Construye el enlace de WhatsApp sin enviar datos a terceros automáticamente.
 * @param {string} text - Mensaje editable por el Gestor.
 * @param {string} referralUrl - Enlace first-party de referido.
 * @returns {string} URL de apertura voluntaria de WhatsApp.
 */
export function buildWhatsAppShareUrl(text: string, referralUrl: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text.trim()} ${referralUrl}`.trim())}`;
}
