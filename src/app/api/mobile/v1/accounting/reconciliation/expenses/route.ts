import { z } from 'zod';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingReconciliationService } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { reconciliarGastoAdapter } from '@/features/contabilidad/api/reconciliacion-gastos-adapter';
import { extraerFechaDeBody, validarEscrituraPeriodo } from '@/lib/services/validate-period-write';

export const dynamic = 'force-dynamic';

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const result = await AccountingReconciliationService.listPendingExpenses({
      tenantId: authResult.user.tenantId ?? '',
      tipoGasto: searchParams.get('tipoGasto'),
      fechaDesde: searchParams.get('fechaDesde'),
      fechaHasta: searchParams.get('fechaHasta'),
      soloNoReconciliados: true,
      page: parsePositiveInt(searchParams.get('page'), 1),
      limit: parsePositiveInt(searchParams.get('limit'), 50),
    });

    return successResponse({ items: result.gastos, pagination: result.pagination });
  } catch (error) {
    console.error('Error en mobile accounting reconciliation expenses route:', error);
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
      tipoOperacion: 'reconciliacion_gastos',
      actor: authResult.user.userId,
    });

    if (!validacionPeriodo.permitido) {
      return errorResponse(
        validacionPeriodo.error?.message ?? 'Período contable cerrado',
        400,
        validacionPeriodo.error?.code ?? 'PERIODO_CERRADO',
      );
    }

    const result = await reconciliarGastoAdapter(body, authResult.user);
    return successResponse({
      reconciliaciones: result.reconciliaciones,
      cuentaPorPagar: result.cuentaPorPagar,
      pagoCuentaPorPagar: result.pagoCuentaPorPagar,
      distribucionMultiCuenta: result.distribucionMultiCuenta,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return errorResponse('Datos de entrada inválidos', 400, 'VALIDATION_ERROR');
    }

    const err = error as { status?: number; code?: string; message?: string };
    if (err.status && err.code) {
      return errorResponse(err.message || 'Error de validación', err.status, err.code);
    }

    console.error('Error en mobile accounting reconciliation expenses route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
