import { NextRequest } from 'next/server';
import { z } from 'zod';

import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { reverseAnticipo, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow';
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write';

const schema = z.object({
  documentoDestinoId: z.string().min(1),
  montoReverso: z.coerce.number().positive(),
  observaciones: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const { id: anticipoId } = await params;
    const body = await request.json();
    const payload = schema.parse(body);

    const anticipo = await prisma.anticipo.findUnique({ where: { anticipoId }, select: { tenantId: true } });
    if (!anticipo) return errorResponse('Anticipo no encontrado', 404, 'ANTICIPO_NO_ENCONTRADO');

    const fechaOperacion = extraerFechaDeBody(body) ?? new Date();
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId: anticipo.tenantId,
      tipoOperacion: 'revertir_anticipo',
      actor: authResult.user.userId,
    });
    if (!validacionPeriodo.permitido) {
      return errorResponse(validacionPeriodo.error?.message ?? 'Período contable cerrado', 400, validacionPeriodo.error?.code ?? 'PERIODO_CERRADO');
    }

    const result = await prisma.$transaction(async (tx) => reverseAnticipo(tx, {
      anticipoId,
      documentoDestinoId: payload.documentoDestinoId,
      montoReverso: payload.montoReverso,
      observaciones: payload.observaciones,
      usuarioId: authResult.user.userId,
    }));

    return successResponse({ result });
  } catch (error) {
    console.error('Error al revertir anticipo mobile:', error);
    if (isAnticipoWorkflowError(error)) return errorResponse(error.message, error.status, error.code);
    if (error instanceof z.ZodError) return errorResponse('Payload inválido', 400, 'VALIDATION_ERROR', error.flatten());
    return errorResponse('Error al revertir anticipo', 500, 'INTERNAL_ERROR');
  }
}
