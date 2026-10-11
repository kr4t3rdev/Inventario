import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { ActionError } from '@/lib/server-actions';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { extraerFechaDeBody, validarEscrituraPeriodo } from '@/lib/services/validate-period-write';

export const dynamic = 'force-dynamic';

const PAYMENT_DATE_FIELDS = [
  'fechaOperacion',
  'fechaReconciliacion',
  'fechaTransferencia',
  'fecha',
  'fechaPago',
  'fechaCompra',
  'fechaServicio',
  'createdAt',
] as const;

/** @description Valida formato ISO y calendario antes de delegar el parseo a JavaScript. */
function isValidPaymentDate(value: string): boolean {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2}))?$/,
  );
  if (!match) return false;

  const [, rawYear, rawMonth, rawDay, rawHour, rawMinute, rawSecond, , offset] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return false;

  if (rawHour !== undefined) {
    if (Number(rawHour) > 23 || Number(rawMinute) > 59 || Number(rawSecond ?? '0') > 59) {
      return false;
    }
  }
  if (offset && offset !== 'Z') {
    const offsetHour = Number(offset.slice(1, 3));
    const offsetMinute = Number(offset.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }

  return Number.isFinite(new Date(value).getTime());
}

/** @description Detecta fechas de negocio presentes pero inválidas para evitar usar la fecha actual. */
function hasInvalidPaymentDate(body: Record<string, unknown>): boolean {
  for (const field of PAYMENT_DATE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const value = body[field];
    if (typeof value !== 'string' || !value.trim() || !isValidPaymentDate(value)) {
      return true;
    }
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'periodo')) return false;
  const periodo = body.periodo;
  if (typeof periodo !== 'string' || !/^\d{4}-\d{2}$/.test(periodo)) return true;
  const month = Number(periodo.slice(5));
  return month < 1 || month > 12;
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const { id } = await context.params;
    const parsedBody = await request.json();
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      return errorResponse('Los datos del pago de deuda no son válidos', 400, 'VALIDATION_ERROR');
    }
    const body = parsedBody as Record<string, unknown>;
    if (hasInvalidPaymentDate(body)) {
      return errorResponse('La fecha de operación no es válida', 400, 'VALIDATION_ERROR');
    }
    const bodyHasIdempotencyKey = Object.prototype.hasOwnProperty.call(body, 'idempotencyKey');
    const bodyIdempotencyKey = body.idempotencyKey;
    if (bodyHasIdempotencyKey && typeof bodyIdempotencyKey !== 'string') {
      return errorResponse('La clave de idempotencia no es válida', 400, 'VALIDATION_ERROR');
    }
    const idempotencyKey = bodyHasIdempotencyKey
      ? bodyIdempotencyKey as string
      : request.headers.get('Idempotency-Key') ?? undefined;
    if (idempotencyKey !== undefined &&
        (!idempotencyKey.trim() || idempotencyKey.trim().length > 64)) {
      return errorResponse('La clave de idempotencia no es válida', 400, 'VALIDATION_ERROR');
    }
    const fechaSolicitada = extraerFechaDeBody(body);
    const fechaOperacion = fechaSolicitada ?? new Date();
    type PaymentInput = Parameters<
      typeof AccountingCashOperationsMutationService.registerCashDebtPayment
    >[0]['input'];
    const input = {
      ...body,
      id,
      fechaOperacion: fechaSolicitada ?? undefined,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    } as PaymentInput;
    if (idempotencyKey) {
      const existingReplay = await AccountingCashOperationsMutationService.findCashDebtPaymentReplay({
        input,
        user: authResult.user,
      });
      if (existingReplay) return successResponse(existingReplay);
    }

    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId: authResult.user.tenantId ?? '',
      tipoOperacion: 'pago_deuda_cash',
      actor: authResult.user.userId,
    });

    if (!validacionPeriodo.permitido) {
      if (idempotencyKey) {
        const replayAfterGate = await AccountingCashOperationsMutationService.findCashDebtPaymentReplay({
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

    const result = await AccountingCashOperationsMutationService.registerCashDebtPayment({
      input,
      user: authResult.user,
    });

    return successResponse(result);
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, mapActionErrorStatus(error.code), error.code);
    }
    console.error('Error en mobile cash debt payment route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
