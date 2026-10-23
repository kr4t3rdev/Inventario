import { NextResponse } from 'next/server';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions/types';
import { requireFeature } from '@/lib/services/tenant-scope';

/**
 * @description Exige el feature de contratos antes de consultar datos del módulo.
 * El administrador global conserva el bypass definido por `requireFeature`.
 * @param {AuthenticatedUser} user - Usuario autenticado con contexto de plan.
 * @returns {void} No retorna valor; lanza ActionError cuando falta tenant o feature.
 */
export function requireContratosFeature(user: AuthenticatedUser): void {
  if (user.role !== 'admin' && !user.tenantId) {
    throw new ActionError('Se requiere una membresía de empresa activa para acceder a este recurso', 'TENANT_REQUIRED');
  }
  requireFeature(user, 'contratos', 'gestionar contratos');
}

/**
 * @description Convierte rechazos de tenant, feature o RBAC en una respuesta HTTP 403.
 * @param {unknown} error - Error capturado por un handler de contratos.
 * @returns {NextResponse | null} Respuesta 403 o null si el error no es de acceso.
 */
export function contratosAccessErrorResponse(error: unknown): NextResponse | null {
  if (
    error instanceof Error &&
    error.message === 'Se requiere una membresía de empresa activa para acceder a este recurso'
  ) {
    return NextResponse.json(
      { error: error.message, code: 'TENANT_REQUIRED' },
      { status: 403 },
    );
  }
  if (!(error instanceof ActionError) ||
      !['TENANT_REQUIRED', 'FORBIDDEN', 'FEATURE_NOT_AVAILABLE'].includes(error.code)) return null;
  return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
}
