import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import { requireTenant } from '@/lib/services/tenant-scope';
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write';
import { createAnticipo, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow';
import { errorResponse, successResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  tipo: z.enum(['PAGO', 'COBRO']),
  contratoId: z.string().min(1),
  proveedorId: z.string().optional(),
  clienteId: z.string().optional(),
  monto: z.coerce.number().positive(),
  moneda: z.string().min(1),
  cuentaOrigenId: z.string().optional(),
  tipoPagoOrigenId: z.string().optional(),
  referenciaExterna: z.string().optional(),
  vigenciaHasta: z.string().optional(),
});

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const tenantId = requireTenant(authResult.user);
    const anticipos = await prisma.anticipo.findMany({
      where: { tenantId },
      include: {
        contrato: { select: { contratoId: true, estado: true, fechaInicio: true, fechaFin: true } },
        proveedor: { select: { vendorId: true, nombre: true } },
        cliente: { select: { clienteId: true, nombre: true } },
        creador: { select: { userId: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse({ anticipos });
  } catch (error) {
    console.error('Error al listar anticipos mobile:', error);
    return errorResponse('Error al listar anticipos', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const tenantId = requireTenant(authResult.user);
    const body = await request.json();
    const payload = createSchema.parse(body);

    const fechaOperacion = extraerFechaDeBody(body) ?? new Date();
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId,
      tipoOperacion: 'anticipo',
      actor: authResult.user.userId,
    });
    if (!validacionPeriodo.permitido) {
      return errorResponse(
        validacionPeriodo.error?.message ?? 'Período contable cerrado',
        400,
        validacionPeriodo.error?.code ?? 'PERIODO_CERRADO',
      );
    }

    const anticipo = await prisma.$transaction(async (tx) => createAnticipo(tx, {
      ...payload,
      tenantId,
      vigenciaHasta: payload.vigenciaHasta || undefined,
      usuarioId: authResult.user.userId,
    }));

    return successResponse({ anticipo }, 201);
  } catch (error) {
    console.error('Error al crear anticipo mobile:', error);

    if (isAnticipoWorkflowError(error)) {
      return errorResponse(error.message, error.status, error.code);
    }

    if (error instanceof z.ZodError) {
      return errorResponse('Payload inválido', 400, 'VALIDATION_ERROR', error.flatten());
    }

    return errorResponse('Error al crear anticipo', 500, 'INTERNAL_ERROR');
  }
}
