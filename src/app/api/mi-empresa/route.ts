import { NextRequest } from 'next/server';
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { ActionError } from '@/lib/server-actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { requireTenant } from '@/lib/services/tenant-scope';
import {
  getMiEmpresaByTenant,
  upsertMiEmpresa,
} from '@/features/mi-empresa/services/mi-empresa-service';

function mapActionErrorStatus(code: string): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404;
    case 'FORBIDDEN':
      return 403;
    case 'CONFIRMATION_REQUIRED':
      return 409;
    case 'VALIDATION_ERROR':
    case 'FEATURE_NOT_AVAILABLE':
      return 400;
    default:
      return 400;
  }
}

export const GET = withAuthGet(async (
  _request: NextRequest,
  _context: unknown,
  user: AuthenticatedUser,
) => {
  try {
    const tenantId = requireTenant(user);
    const miEmpresa = await getMiEmpresaByTenant(tenantId);
    return successResponse(miEmpresa);
  } catch (error) {
    console.error('Error al obtener Mi Empresa:', error);
    return errorResponse('Error al cargar Mi Empresa', 500, 'MI_EMPRESA_READ_FAILED');
  }
});

export const PUT = withAuthPost(async (
  request: NextRequest,
  _context: unknown,
  user: AuthenticatedUser,
) => {
  try {
    const input = await request.json();
    const result = await upsertMiEmpresa({ input, user });
    return successResponse(result);
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, mapActionErrorStatus(error.code), error.code);
    }

    console.error('Error al actualizar Mi Empresa:', error);
    return errorResponse('Error al actualizar Mi Empresa', 500, 'MI_EMPRESA_UPDATE_FAILED');
  }
});
