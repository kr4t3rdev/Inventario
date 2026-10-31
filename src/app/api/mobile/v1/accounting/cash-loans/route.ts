import { z, ZodError } from 'zod';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { ActionError } from '@/lib/server-actions';
import { AccountingCashOperationsService } from '@/features/contabilidad/services/accounting-cash-operations-service';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { validarEscrituraPeriodo } from '@/lib/services/validate-period-write';
import { requireFeature, requirePermission } from '@/lib/services/tenant-scope';
import {
  isCashCreateIdempotencyUniqueConflict,
  runCashCreateWithReplay,
} from '@/lib/services/cash-create-idempotency';

export const dynamic = 'force-dynamic';

const requiredAnnualRateSchema = z.preprocess(
  (value) => value === null || typeof value === 'boolean' ||
    (typeof value === 'string' && value.trim() === '') ? undefined : value,
  z.coerce.number().finite().min(0),
);

const createSchema = z.object({
  clienteId: z.string().min(1),
  montoCapital: z.coerce.number().positive(),
  moneda: z.string().optional().default('CUP'),
  tasaInteres: requiredAnnualRateSchema,
  tasaInteresMoratorio: requiredAnnualRateSchema,
  tasaCambioAlCrear: z.coerce.number().positive().optional(),
  fechaVencimiento: z.string().optional(),
  observaciones: z.string().optional(),
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
    case 'FEATURE_NOT_AVAILABLE':
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
    requirePermission(authResult.user, 'financiero.contabilidad.acceder', 'consultar préstamos cash');
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
    requirePermission(authResult.user, 'financiero.contabilidad.acceder', 'crear préstamos cash');
    const body = createSchema.parse(await request.json());
    const headerKey = request.headers.get('Idempotency-Key');
    const rawKey = body.idempotencyKey !== undefined ? body.idempotencyKey : headerKey;
    if (rawKey !== null && rawKey !== undefined && typeof rawKey !== 'string') {
      return errorResponse('La clave de idempotencia no es válida', 400, 'VALIDATION_ERROR');
    }
    const idempotencyKey = typeof rawKey === 'string' ? rawKey.trim() : undefined;
    if ((headerKey !== null || body.idempotencyKey !== undefined) &&
      (!idempotencyKey || idempotencyKey.length > 64)) {
      return errorResponse('La clave de idempotencia no es válida', 400, 'VALIDATION_ERROR');
    }
    const input = {
      ...body,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    };
    const operationDate = new Date();
    const result = await runCashCreateWithReplay({
      findReplay: () => AccountingCashOperationsMutationService.findCashLoanCreateReplay({
        input,
        user: authResult.user,
      }),
      validatePeriod: async () => {
        requireFeature(authResult.user, 'prestamos-cash', 'crear préstamos cash');
        const validation = await validarEscrituraPeriodo({
          fecha: operationDate,
          tenantId: authResult.user.tenantId ?? '',
          tipoOperacion: 'prestamo_cash',
          actor: authResult.user.userId,
        });
        if (!validation.permitido) {
          throw new ActionError(
            validation.error?.message ?? 'Período contable cerrado',
            validation.error?.code ?? 'PERIODO_CERRADO',
          );
        }
      },
      write: () => AccountingCashOperationsMutationService.createCashLoan({
        input,
        user: authResult.user,
        operationDate,
      }),
      canRecover: (error) => {
        if (error instanceof ActionError && [
          'PERIODO_CERRADO',
          'PERIODO_APROBADO',
          'PERIODO_EN_CIERRE',
        ].includes(error.code ?? '')) return true;
        return isCashCreateIdempotencyUniqueConflict(error);
      },
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
