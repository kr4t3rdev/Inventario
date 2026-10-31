import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { extraerFechaDeBody, validarEscrituraPeriodo } from '@/lib/services/validate-period-write';
import { AccountingCashOperationsMutationService, validateCashPaymentAmount } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';

const pagoSchema = z.object({
  monto: z.coerce.number().positive('El monto debe ser positivo'),
  cuentaId: z.string().min(1, 'La cuenta bancaria es requerida'),
  tipoPagoId: z.string().min(1, 'El tipo de pago es requerido'),
  moneda: z.string().optional(),
  tasaCambio: z.coerce.number().positive().optional(),
  observaciones: z.string().optional(),
  idempotencyKey: z.string().trim().min(1).max(64).optional(),
});

/**
 * @description Verifica si el módulo de deudas cash está habilitado.
 * @returns {boolean} true si está habilitado.
 */
function deudasCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEUDAS_CASH !== 'false';
}

/**
 * @description Registra o reproduce un pago de deuda cash mediante el writer compartido.
 * @param {NextRequest} request - Solicitud con el pago y su clave opcional de idempotencia.
 * @param {unknown} context - Contexto de ruta con el identificador de la deuda.
 * @param {AuthenticatedUser} user - Usuario autenticado y asociado al tenant.
 * @returns {Promise<Response>} Reconciliación con el contrato HTTP heredado.
 */
export const POST = withAuthPost(async (
  request: NextRequest,
  context: unknown,
  user: AuthenticatedUser,
) => {
  try {
    if (!deudasCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 });
    }
    requirePermission(user, 'financiero.contabilidad.acceder', 'registrar pagos de deudas cash');

    const { params } = context as { params: Promise<{ id: string }> };
    const { id } = await params;
    const body = pagoSchema.parse(await request.json());
    const amount = validateCashPaymentAmount(body.monto).toNumber();
    const idempotencyKey = body.idempotencyKey ??
      request.headers.get('Idempotency-Key')?.trim() ?? undefined;
    const input = {
      id,
      monto: amount,
      cuentaId: body.cuentaId,
      tipoPagoId: body.tipoPagoId,
      moneda: body.moneda,
      tasaCambio: body.tasaCambio,
      observaciones: body.observaciones,
      idempotencyKey,
    };

    const replay = await AccountingCashOperationsMutationService.findCashDebtPaymentReplay({
      input,
      user,
    });
    if (replay) {
      return NextResponse.json({ reconciliacion: replay }, { status: 201 });
    }

    const tenantId = requireTenant(user);
    const fechaOperacion = extraerFechaDeBody(body as unknown as Record<string, unknown>) ?? new Date();
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId,
      tipoOperacion: 'pago_deuda_cash',
      actor: user.userId,
    });
    if (!validacionPeriodo.permitido) {
      return NextResponse.json(
        {
          error: validacionPeriodo.error?.message ?? 'Período contable cerrado',
          code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO',
        },
        { status: 400 },
      );
    }

    const reconciliacion = await AccountingCashOperationsMutationService.registerCashDebtPayment({
      input,
      user,
    });
    return NextResponse.json({ reconciliacion }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 });
    }
    if (error instanceof ActionError) {
      const status = error.code === 'IDEMPOTENCY_CONFLICT' ? 409
        : error.code === 'NOT_FOUND' ? 404
          : error.code === 'DISABLED' ? 404
            : ['TENANT_REQUIRED', 'FORBIDDEN', 'FEATURE_NOT_AVAILABLE'].includes(error.code) ? 403
              : ['INVALID_AMOUNT', 'VALIDATION_ERROR', 'FX_EVIDENCE_REQUIRED'].includes(error.code)
                ? 400
                : 500;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error('Error registrando pago de deuda:', error);
    return NextResponse.json({ error: 'Error registrando pago de deuda' }, { status: 500 });
  }
});
