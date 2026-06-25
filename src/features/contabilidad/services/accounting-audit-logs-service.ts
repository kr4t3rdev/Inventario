import { ActionError } from '@/lib/server-actions';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { hasTenantPermission, type TenantRole } from '@/lib/permissions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

/**
 * @description Servicio compartido para lectura de logs de auditoría contable.
 */
export const AccountingAuditLogsService = {
  async getLogs(params: {
    user: AuthenticatedUser;
    entidad?: string | null;
    accion?: string | null;
    desde?: string | null;
    hasta?: string | null;
    limit?: number;
    offset?: number;
  }) {
    const isGlobalAdmin = params.user.role === 'admin';
    const isTenantPrivileged = params.user.tenantRole && 
      (params.user.tenantRole === 'manager' || params.user.tenantRole === 'economico');

    if (!isGlobalAdmin && !isTenantPrivileged) {
      throw new ActionError('Prohibido', 'FORBIDDEN');
    }

    const AUDIT_LOG_PATH = '/api/contabilidad/logs';
    if (!isGlobalAdmin && !hasTenantPermission(params.user.tenantRole as TenantRole, AUDIT_LOG_PATH, 'GET')) {
      throw new ActionError('Prohibido', 'FORBIDDEN');
    }

    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    const result = await AuditLogService.getLogs({
      entidad: params.entidad || undefined,
      accion: params.accion || undefined,
      desde: params.desde ? new Date(params.desde) : undefined,
      hasta: params.hasta ? new Date(params.hasta) : undefined,
      limit,
      offset,
    });

    return {
      logs: result.logs,
      total: result.total,
      pagination: {
        limit,
        offset,
        total: result.total,
      },
    };
  },
};
