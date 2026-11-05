import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { ORIGEN_REVERSO_ASIENTO } from './financial-ledger-closing-scope';

/** Problema detectado en el vínculo entre un asiento original y su reverso. */
export interface ProblemaIntegridadReverso {
  /** Código estable del problema. */
  codigo: 'ORIGINAL_REVERSO_AUSENTE' | 'REVERSO_NO_ENCONTRADO' | 'ORIGINAL_REVERSO_INCONSISTENTE';
  /** Identificador del asiento en el que se detectó el problema. */
  asientoId: string;
  /** Descripción legible del problema. */
  detalle: string;
}

/** Parámetros de la verificación de integridad de reversos. */
export interface VerificarIntegridadParams {
  /** Tenant propietario de los asientos. */
  tenantId: string;
  /** Cliente transaccional opcional para leer en el mismo contexto. */
  client?: Prisma.TransactionClient;
}
/**
 * @description Verifica que cada reverso tenga su original y que cada original
 * revertido apunte a un reverso contabilizado del mismo tenant. Sin esta
 * comprobación un par incompleto produce saldos formalmente incorrectos que
 * ningún consumidor puede detectar.
 * @param {VerificarIntegridadParams} params - Tenant y cliente transaccional opcional.
 * @returns {Promise<ProblemaIntegridadReverso[]>} Problemas detectados; vacío si el vínculo es íntegro.
 */
export async function verifyReversalIntegrity(
  params: VerificarIntegridadParams,
): Promise<ProblemaIntegridadReverso[]> {
  if (!params.tenantId.trim()) {
    throw new Error('El tenant es obligatorio para verificar la integridad de reversos');
  }

  const db = params.client ?? prisma;
  const asientos = await db.asiento.findMany({
    where: { tenantId: params.tenantId },
    select: {
      asientoId: true,
      origenTipo: true,
      origenId: true,
      estado: true,
      revertidoPorId: true,
    },
  });

  const porId = new Map(asientos.map((asiento) => [asiento.asientoId, asiento]));
  const problemas: ProblemaIntegridadReverso[] = [];

  for (const asiento of asientos) {
    if (asiento.origenTipo === ORIGEN_REVERSO_ASIENTO) {
      const original = porId.get(asiento.origenId);
      if (!original) {
        problemas.push({
          codigo: 'ORIGINAL_REVERSO_AUSENTE',
          asientoId: asiento.asientoId,
          detalle: `El reverso ${asiento.asientoId} no tiene el asiento original ${asiento.origenId}`,
        });
      } else if (original.revertidoPorId !== asiento.asientoId) {
        problemas.push({
          codigo: 'ORIGINAL_REVERSO_INCONSISTENTE',
          asientoId: asiento.asientoId,
          detalle: `El original ${original.asientoId} no apunta al reverso ${asiento.asientoId}`,
        });
      }
    }

    if (asiento.revertidoPorId) {
      const reverso = porId.get(asiento.revertidoPorId);
      if (!reverso) {
        problemas.push({
          codigo: 'REVERSO_NO_ENCONTRADO',
          asientoId: asiento.asientoId,
          detalle: `El asiento ${asiento.asientoId} declara el reverso ${asiento.revertidoPorId}, que no existe`,
        });
      } else if (
        asiento.estado !== 'ANULADO' ||
        reverso.estado !== 'CONTABILIZADO' ||
        reverso.origenId !== asiento.asientoId
      ) {
        problemas.push({
          codigo: 'ORIGINAL_REVERSO_INCONSISTENTE',
          asientoId: asiento.asientoId,
          detalle: `El reverso ${reverso.asientoId} no es coherente con el original ${asiento.asientoId}`,
        });
      }
    }
  }

  return problemas;
}
