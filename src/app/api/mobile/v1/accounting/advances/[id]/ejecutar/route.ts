import { NextRequest } from 'next/server';
import { z } from 'zod';

import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { executeAnticipo, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow';
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write';

const schema = z.object({
  contexto: z.enum(['COMPRA_PRODUCTO', 'COMPRA_SERVICIO', 'FACTURA_OFERTA', 'FACTURA_DIRECTA']),
  documentoDestinoId: z.string().min(1),
  montoObjetivo: z.coerce.number().positive(),
  monedaObjetivo: z.string().min(1),
  tasaAplicada: z.coerce.number().positive().optional(),
  idempotencyKey: z.string().min(1),
  observaciones: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const { id: anticipoId } = await params;
    const body = await request.json();
    const payload = schema.parse(body);

    const anticipo = await prisma.anticipo.findUnique({ where: { anticipoId }, select: { saldoDisponible: true, tenantId: true } });
    if (!anticipo) return errorResponse('Anticipo no encontrado', 404, 'ANTICIPO_NO_ENCONTRADO');

    const fechaOperacion = extraerFechaDeBody(body) ?? new Date();
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId: anticipo.tenantId,
      tipoOperacion: 'ejecutar_anticipo',
      actor: authResult.user.userId,
    });
    if (!validacionPeriodo.permitido) {
      return errorResponse(validacionPeriodo.error?.message ?? 'Período contable cerrado', 400, validacionPeriodo.error?.code ?? 'PERIODO_CERRADO');
    }

    if (Math.abs(Number(anticipo.saldoDisponible) - payload.montoObjetivo) > 0.000001) {
      return errorResponse('La ejecución parcial del anticipo no está permitida. Debe ejecutar el saldo completo.', 409, 'EJECUCION_PARCIAL_NO_PERMITIDA', {
        saldoDisponible: Number(anticipo.saldoDisponible),
        montoObjetivo: payload.montoObjetivo,
      });
    }

    const result = await prisma.$transaction(async (tx) => executeAnticipo(tx, {
      anticipoId,
      contexto: payload.contexto,
      documentoDestinoId: payload.documentoDestinoId,
      montoObjetivo: payload.montoObjetivo,
      monedaObjetivo: payload.monedaObjetivo,
      tasaAplicada: payload.tasaAplicada,
      idempotencyKey: payload.idempotencyKey,
      observaciones: payload.observaciones,
      usuarioId: authResult.user.userId,
    }));

    return successResponse({ result });
  } catch (error) {
    console.error('Error al ejecutar anticipo mobile:', error);
    if (isAnticipoWorkflowError(error)) return errorResponse(error.message, error.status, error.code);
    if (error instanceof z.ZodError) return errorResponse('Payload inválido', 400, 'VALIDATION_ERROR', error.flatten());
    return errorResponse('Error al ejecutar anticipo', 500, 'INTERNAL_ERROR');
  }
}
