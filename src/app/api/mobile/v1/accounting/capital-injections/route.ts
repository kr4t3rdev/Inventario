import { z } from 'zod';
import { ActionError } from '@/lib/server-actions';
import { authenticateUser } from '@/lib/auth-middleware';
import { requireFeature } from '@/lib/services/tenant-scope';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingOperationsReadService } from '@/features/contabilidad/services/accounting-operations-read-service';
import { AccountingOperationsMutationService } from '@/features/contabilidad/services/accounting-operations-mutation-service';
import { extraerFechaDeBody, validarEscrituraPeriodo } from '@/lib/services/validate-period-write';

export const dynamic = 'force-dynamic';

const capitalInjectionTypeSchema = z.enum(['CAPITAL_SOCIAL', 'DEUDA_EXTERNA']);

function mapActionErrorStatus(code: string): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404;
    case 'FORBIDDEN':
    case 'TENANT_REQUIRED':
    case 'FEATURE_NOT_AVAILABLE':
      return 403;
    case 'VALIDATION_ERROR':
      return 400;
    default:
      return 400;
  }
}

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    requireFeature(authResult.user, 'inyeccion-capital', 'administrar inyecciones de capital');
    const { searchParams } = new URL(request.url);
    const rawTipo = searchParams.get('tipo');
    const tipo = rawTipo
      ? capitalInjectionTypeSchema.safeParse(rawTipo)
      : { success: true as const, data: null };
    if (!tipo.success) {
      throw new ActionError('El tipo de inyección no es válido', 'VALIDATION_ERROR');
    }
    const result = await AccountingOperationsReadService.getCapitalInjections({
      tenantId,
      tipo: tipo.data,
    });

    return successResponse({ items: result.inyecciones });
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, mapActionErrorStatus(error.code), error.code);
    }
    console.error('Error en mobile accounting capital injections route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    requireFeature(authResult.user, 'inyeccion-capital', 'registrar inyecciones de capital');

    const body = await request.json();
    const fechaOperacion = extraerFechaDeBody(body) ?? new Date();
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId: authResult.user.tenantId ?? '',
      tipoOperacion: 'inyeccion_capital',
      actor: authResult.user.userId,
    });

    if (!validacionPeriodo.permitido) {
      return errorResponse(
        validacionPeriodo.error?.message ?? 'Período contable cerrado',
        400,
        validacionPeriodo.error?.code ?? 'PERIODO_CERRADO',
      );
    }

    const result = await AccountingOperationsMutationService.createCapitalInjection({
      input: body,
      user: authResult.user,
    });
    return successResponse(result);
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, mapActionErrorStatus(error.code), error.code);
    }
    if (error instanceof z.ZodError) {
      return errorResponse('Los datos de la inyección de capital no son válidos', 400, 'VALIDATION_ERROR');
    }
    console.error('Error en mobile accounting capital injections route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
