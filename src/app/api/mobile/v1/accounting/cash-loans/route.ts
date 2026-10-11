import { z, ZodError } from 'zod';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { ActionError } from '@/lib/server-actions';
import { AccountingCashOperationsService } from '@/features/contabilidad/services/accounting-cash-operations-service';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { validarEscrituraPeriodo } from '@/lib/services/validate-period-write';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  clienteId: z.string().min(1),
  montoCapital: z.coerce.number().positive(),
  moneda: z.string().optional().default('CUP'),
  tasaInteres: z.coerce.number().min(0).optional(),
  tasaCambioAlCrear: z.coerce.number().positive().optional(),
  fechaVencimiento: z.string().optional(),
  observaciones: z.string().optional(),
  solicitarCreditoOverride: z.boolean().optional(),
  motivoCreditoOverride: z.string().trim().max(500).optional(),
  cuentaBancariaId: z.string().min(1),
  idempotencyKey: z.string().trim().min(1).max(64).optional(),
});

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
    case 'DISABLED':
      return 404;
    case 'IDEMPOTENCY_CONFLICT':
      return 409;
    default:
      return 400;
  }
}

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const { searchParams } = new URL(request.url);
    const result = await AccountingCashOperationsService.listCashLoans({
      tenantId: authResult.user.tenantId ?? '',
      estado: searchParams.get('estado'),
      clienteId: searchParams.get('clienteId'),
      moneda: searchParams.get('moneda'),
      page: parsePositiveInt(searchParams.get('page'), 1),
      limit: parsePositiveInt(searchParams.get('limit'), 20),
    });

    return successResponse({ items: result.prestamos, pagination: result.pagination });
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, mapActionErrorStatus(error.code), error.code);
    }
    console.error('Error en mobile cash loans route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const bodyInput = createSchema.parse(await request.json());
    const hasBodyKey = bodyInput.idempotencyKey !== undefined;
    const headerKey = request.headers.get('Idempotency-Key');
    const rawKey = hasBodyKey ? bodyInput.idempotencyKey : headerKey;
    const keyWasProvided = hasBodyKey || headerKey !== null;
    const idempotencyKey = typeof rawKey === 'string' ? rawKey.trim() : undefined;
    if (keyWasProvided && (!idempotencyKey || idempotencyKey.length > 64)) {
      return errorResponse('La clave de idempotencia no es válida', 400, 'VALIDATION_ERROR');
    }
    const input = {
      ...bodyInput,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    };
    if (idempotencyKey) {
      const replay = await AccountingCashOperationsMutationService.findCashLoanCreateReplay({
        input,
        user: authResult.user,
      });
      if (replay) return successResponse(replay);
    }

    // Creation dates are server-owned. Client aliases such as fechaOperacion and
    // createdAt must not let a new operation bypass a closed accounting period.
    const operationDate = new Date();
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: operationDate,
      tenantId: authResult.user.tenantId ?? '',
      tipoOperacion: 'prestamo_cash',
      actor: authResult.user.userId,
    });

    if (!validacionPeriodo.permitido) {
      if (idempotencyKey) {
        const replayAfterGate = await AccountingCashOperationsMutationService.findCashLoanCreateReplay({
          input,
          user: authResult.user,
        });
        if (replayAfterGate) return successResponse(replayAfterGate);
      }
      return errorResponse(
        validacionPeriodo.error?.message ?? 'Período contable cerrado',
        400,
        validacionPeriodo.error?.code ?? 'PERIODO_CERRADO',
      );
    }

    const result = await AccountingCashOperationsMutationService.createCashLoan({
      input,
      user: authResult.user,
      operationDate,
    });

    return successResponse(result);
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, mapActionErrorStatus(error.code), error.code);
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return errorResponse('Los datos del préstamo no son válidos', 400, 'VALIDATION_ERROR');
    }
    console.error('Error en mobile cash loans create route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
