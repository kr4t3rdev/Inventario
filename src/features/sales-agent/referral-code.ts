import { randomBytes } from 'node:crypto';

const REFERRAL_CODE_BYTES = 8;

/**
 * @description Genera un código de referido salesAgent con entropía criptográfica.
 * @returns {string} Código con prefijo SA y 64 bits aleatorios.
 */
export function generateSalesAgentReferralCode(): string {
  return `SA-${randomBytes(REFERRAL_CODE_BYTES).toString('hex').toUpperCase()}`;
}

/**
 * @description Detecta una colisión de constraint unique reportada por Prisma.
 * @param {unknown} error - Error capturado durante la aprobación.
 * @returns {boolean} true únicamente para P2002.
 */
export function isUniqueConstraintCollision(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002',
  );
}
