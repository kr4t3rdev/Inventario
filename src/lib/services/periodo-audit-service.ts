/**
 * @description Servicio para registrar y consultar auditoría de períodos contables.
 *
 * Proporciona trazabilidad completa de todas las transiciones de estado,
 * intentos de bypass y eventos relevantes del ciclo de vida del período.
 */

import { prisma } from '@/lib/prisma';
import type { AuditoriaPeriodo } from '@/generated/prisma';

/**
 * @description Servicio de auditoría de períodos contables.
 */
export class PeriodoAuditService {
  /**
   * Registra un evento de auditoría en la base de datos.
   *
   * @param {Object} params - Parámetros del evento.
   * @param {string} params.periodoId - ID del período afectado.
   * @param {string} params.tenantId - ID del tenant.
   * @param {string} params.evento - Tipo de evento (APERTURA, CIERRE, etc.).
   * @param {string} params.actor - ID del usuario o 'system'.
   * @param {string} [params.entidadAfectada] - Tipo de entidad afectada.
   * @param {string} [params.motivo] - Motivo del evento (requerido para reaperturas).
   * @param {Record<string, unknown>} [params.payload] - Contexto adicional.
   * @returns {Promise<AuditoriaPeriodo>} El registro de auditoría creado.
   */
  async registrar(params: {
    periodoId: string;
    tenantId: string;
    evento: string;
    actor: string;
    entidadAfectada?: string;
    motivo?: string;
    payload?: Record<string, unknown>;
  }): Promise<AuditoriaPeriodo> {
    return prisma.auditoriaPeriodo.create({
      data: {
        periodoId: params.periodoId,
        tenantId: params.tenantId,
        evento: params.evento,
        actor: params.actor,
        entidadAfectada: params.entidadAfectada,
        motivo: params.motivo,
        payload: params.payload as Record<string, unknown> | undefined,
      },
    });
  }

  /**
   * Obtiene el timeline completo de un período ordenado cronológicamente.
   *
   * @param {string} periodoId - ID del período.
   * @returns {Promise<AuditoriaPeriodo[]>} Timeline ordenado por timestamp ascendente.
   */
  async obtenerTimeline(periodoId: string): Promise<AuditoriaPeriodo[]> {
    return prisma.auditoriaPeriodo.findMany({
      where: { periodoId },
      orderBy: { timestamp: 'asc' },
    });
  }

  /**
   * Busca eventos de bloqueo en modo audit-only para reporte.
   * Filtra por tenant y rango de fechas, retornando eventos
   * de tipo BLOQUEO, INTENTO_BYPASS y ERROR.
   *
   * @param {string} tenantId - ID del tenant.
   * @param {Date} desde - Fecha de inicio del rango.
   * @param {Date} hasta - Fecha de fin del rango.
   * @returns {Promise<AuditoriaPeriodo[]>} Eventos de bloqueo encontrados.
   */
  async obtenerBloqueosAudit(
    tenantId: string,
    desde: Date,
    hasta: Date,
  ): Promise<AuditoriaPeriodo[]> {
    return prisma.auditoriaPeriodo.findMany({
      where: {
        tenantId,
        timestamp: {
          gte: desde,
          lte: hasta,
        },
        evento: {
          in: ['BLOQUEO', 'INTENTO_BYPASS', 'ERROR'],
        },
      },
      orderBy: { timestamp: 'asc' },
    });
  }
}
