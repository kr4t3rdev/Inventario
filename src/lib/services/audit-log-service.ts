import prisma from "@/lib/prisma";

export type AuditEntity = 
  | "CUENTA_BANCARIA" 
  | "CIERRE_CONTABLE" 
  | "RECONCILIACION" 
  | "TRANSFERENCIA" 
  | "AJUSTE_BANCARIO" 
  | "TASA_CAMBIO" 
  | "MONEDA"
  | "TIPO_PAGO"
  | "INYECCION_CAPITAL"
  | "DEUDA_CASH"
  | "PAGO_DEUDA"
  | "PRESTAMO_CASH"
  | "PAGO_PRESTAMO"
  | "ANTICIPO"
  | "CUENTA_POR_PAGAR"
  | "CUENTA_POR_COBRAR"
  | "ESCENARIO_EXCHANGE"
  | "REPORTE_PROGRAMADO";

export type AuditAction = 
  | "CREATE" 
  | "UPDATE" 
  | "DELETE" 
  | "SYNC" 
  | "EXECUTE"
  | "VALIDATE"
  | "EXPORT";

/**
 * @description Servicio para gestionar logs de auditoría en el sistema
 */
export class AuditLogService {
  /**
   * @description Registra una acción en el log de auditoría
   * @param params - Parámetros del log
   */
  static async log({
    accion,
    entidad,
    entidadId,
    usuarioId,
    detalles,
    ip = "internal",
    userAgent = "system"
  }: {
    accion: AuditAction;
    entidad: AuditEntity;
    entidadId: string;
    usuarioId: string;
    detalles?: Record<string, any>;
    ip?: string;
    userAgent?: string;
  }) {
    try {
      const log = await prisma.auditLog.create({
        data: {
          accion,
          entidad,
          entidadId,
          usuarioId,
          detalles: detalles || {},
          ip,
          userAgent
        }
      });
      return log;
    } catch (error) {
      console.error("[AUDIT_LOG_ERROR]", error);
      // No lanzamos error para no interrumpir el flujo principal
      return null;
    }
  }

  /**
   * @description Obtiene los logs de auditoría con filtros
   */
  static async getLogs(filters: {
    entidad?: string;
    usuarioId?: string;
    accion?: string;
    desde?: Date;
    hasta?: Date;
    limit?: number;
    offset?: number;
  }) {
    const { entidad, usuarioId, accion, desde, hasta, limit = 50, offset = 0 } = filters;

    const where: any = {};
    if (entidad) where.entidad = entidad;
    if (usuarioId) where.usuarioId = usuarioId;
    if (accion) where.accion = accion;
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = desde;
      if (hasta) where.createdAt.lte = hasta;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where })
    ]);

    return { logs, total };
  }
}
