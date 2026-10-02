/**
 * @description Reintentos de la transacción del cupo de crédito (tarea
 * 4.4.b.5.c del change remediacion-integridad-ventas-credito-fiscal).
 *
 * Módulo hoja: sólo importa el tipo de error de server actions para no crear
 * ciclos con los servicios de ventas.
 */
import { ActionError } from '@/lib/server-actions/types';

/** Configuración de reintentos de la transacción del cupo. */
export interface ReintentosCreditoConfig {
  maxIntentos?: number;
  delayBaseMs?: number;
  jitterMs?: number;
}

const CREDITO_RETRY_DEFAULTS = { maxIntentos: 3, delayBaseMs: 25, jitterMs: 50 };

/**
 * @description Detecta conflictos transaccionales que justifican reintentar
 * la operación completa: P2034 de Prisma (conflicto de escritura/serialización)
 * y deadlock de PostgreSQL (40P01, por código de causa o mensaje del servidor).
 * @param {unknown} error - Error capturado de la transacción.
 * @returns {boolean} true si la transacción puede reintentarse de forma segura.
 */
export function esConflictoTransaccional(error: unknown): boolean {
  if (!(error instanceof Error) && typeof error !== 'object') return false;
  const candidato = error as { code?: string; message?: string; cause?: { code?: string } };
  if (candidato?.code === 'P2034') return true;
  const codigoCausa = candidato?.cause?.code;
  if (codigoCausa === '40P01' || codigoCausa === '40001') return true;
  const mensaje = candidato?.message?.toLowerCase() ?? '';
  return mensaje.includes('deadlock detected') || mensaje.includes('could not serialize');
}

/**
 * @description Ejecuta la transacción completa del cupo con reintentos ante
 * conflictos transaccionales (P2034/deadlock) y backoff con jitter. La factory
 * debe crear una transacción NUEVA en cada intento (nunca reutilizar la tx
 * abortada). Al agotar los intentos falla cerrado con CREDITO_CONFLICTO; los
 * errores de dominio se propagan sin reintento.
 * @param {() => Promise<T>} factory - Crea la transacción a ejecutar.
 * @param {ReintentosCreditoConfig} config - Límites de intentos y temporización.
 * @returns {Promise<T>} Resultado de la transacción confirmada.
 */
export async function conReintentosCredito<T>(
  factory: () => Promise<T>,
  config: ReintentosCreditoConfig = {},
): Promise<T> {
  const { maxIntentos, delayBaseMs, jitterMs } = { ...CREDITO_RETRY_DEFAULTS, ...config };
  let ultimoError: unknown;
  for (let intento = 1; intento <= maxIntentos; intento += 1) {
    try {
      return await factory();
    } catch (error) {
      ultimoError = error;
      if (!esConflictoTransaccional(error) || intento === maxIntentos) break;
      const espera = delayBaseMs * intento + Math.random() * jitterMs;
      await new Promise((resolve) => setTimeout(resolve, espera));
    }
  }
  if (esConflictoTransaccional(ultimoError)) {
    const detalle = ultimoError instanceof Error ? ultimoError.message : String(ultimoError);
    throw new ActionError(
      `No se pudo confirmar la operación de crédito tras ${maxIntentos} intentos: ${detalle}`,
      'CREDITO_CONFLICTO',
    );
  }
  throw ultimoError;
}
