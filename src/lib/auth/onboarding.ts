import jwt, { SignOptions } from 'jsonwebtoken';

import { getJwtSecret } from '@/lib/secrets';

export interface OnboardingTokenPayload {
  userId: string;
  email: string;
  purpose: 'email-verification' | 'onboarding' | 'resend-verification';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @description Valida que el request tenga header x-request-id con UUID válido (mitigación CSRF).
 * @param {string | null} requestId - Valor del header x-request-id.
 * @returns {{ valid: false; error: string } | { valid: true }}
 */
export function validateCSRF(requestId: string | null): { valid: false; error: string } | { valid: true } {
  if (!requestId) {
    return { valid: false, error: 'Header x-request-id requerido' };
  }
  if (!UUID_RE.test(requestId)) {
    return { valid: false, error: 'Header x-request-id debe ser un UUID' };
  }
  return { valid: true };
}

/**
 * @description Genera un token temporal para verificación de email y onboarding.
 * @param {OnboardingTokenPayload} payload - Datos del usuario y propósito del token.
 * @param {string} expiresIn - Duración del token.
 * @returns {string} JWT firmado.
 */
export function signOnboardingToken(payload: OnboardingTokenPayload, expiresIn: string = '24h'): string {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, getJwtSecret(), options);
}

/**
 * @description Verifica y decodifica un token temporal de onboarding.
 * @param {string} token - JWT a validar.
 * @returns {OnboardingTokenPayload} Payload validado.
 */
export function verifyOnboardingToken(token: string): OnboardingTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret()) as OnboardingTokenPayload;
  if (decoded.purpose !== 'email-verification' && decoded.purpose !== 'onboarding') {
    throw new Error('Token de onboarding inválido');
  }
  return decoded;
}
