import { ActionError } from '@/lib/server-actions';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingReconciliationService } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { extraerFechaDeBody, validarEscrituraPeriodo } from '@/lib/services/validate-period-write';

export const dynamic = 'force-dynamic';

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function mapActionErrorStatus(code: string): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404;
    case 'FORBIDDEN':
    case 'TENANT_REQUIRED':
      return 403;
    case 'VALIDATION_ERROR':
    case 'INVALID_INPUT':
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

  try {
    const { searchParams } = new URL(request.url);
    const result = await AccountingReconciliationService.listPendingSales({
      tenantId: authResult.user.tenantId ?? '',
      fechaInicio: searchParams.get('fechaInicio'),
      fechaFin: searchParams.get('fechaFin'),
      puntoDeVentaId: searchParams.get('puntoDeVentaId'),
      page: parsePositiveInt(searchParams.get('page'), 1),
      limit: parsePositiveInt(searchParams.get('limit'), 50),
    });

    return successResponse({ items: result.ventas, pagination: result.pagination });
  } catch (error) {
    console.error('Error en mobile accounting reconciliation sales route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const body = await request.json();
    const fechaOperacion = extraerFechaDeBody(body) ?? new Date();
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId: authResult.user.tenantId ?? '',
      tipoOperacion: 'reconciliacion_ventas',
      actor: authResult.user.userId,
    });

    if (!validacionPeriodo.permitido) {
      return errorResponse(
        validacionPeriodo.error?.message ?? 'Período contable cerrado',
        400,
        validacionPeriodo.error?.code ?? 'PERIODO_CERRADO',
      );
    }

    const result = await AccountingReconciliationService.reconcileSale({
      input: body,
      user: authResult.user,
    });
    return successResponse(result);
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, mapActionErrorStatus(error.code), error.code);
    }
    console.error('Error en mobile accounting reconciliation sales route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
