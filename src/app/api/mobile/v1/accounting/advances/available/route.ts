import { NextRequest } from 'next/server';
import { z } from 'zod';

import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import { requireTenant } from '@/lib/services/tenant-scope';
import { errorResponse, successResponse } from '@/lib/api-response';

const querySchema = z.object({
  contexto: z.enum(['compra', 'factura']).optional(),
  proveedorId: z.string().optional(),
  clienteId: z.string().optional(),
  moneda: z.string().optional(),
  estado: z.enum(['RESERVADO', 'EJECUTADO', 'ANULADO']).optional(),
});

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const tenantId = requireTenant(authResult.user);
    const { searchParams } = new URL(request.url);

    const params = querySchema.parse({
      contexto: searchParams.get('contexto') || undefined,
      proveedorId: searchParams.get('proveedorId') || undefined,
      clienteId: searchParams.get('clienteId') || undefined,
      moneda: searchParams.get('moneda') || undefined,
      estado: searchParams.get('estado') || undefined,
    });

    let tipoFilter: 'PAGO' | 'COBRO' | undefined;
    if (params.contexto === 'compra') tipoFilter = 'PAGO';
    else if (params.contexto === 'factura') tipoFilter = 'COBRO';

    const where: Record<string, unknown> = {
      tenantId,
      estado: params.estado || 'RESERVADO',
      saldoDisponible: { gt: 0 },
      OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: new Date() } }],
    };

    if (tipoFilter) where.tipo = tipoFilter;
    if (params.proveedorId) where.proveedorId = params.proveedorId;
    if (params.clienteId) where.clienteId = params.clienteId;
    if (params.moneda) where.moneda = params.moneda;

    const anticipos = await prisma.anticipo.findMany({
      where,
      include: {
        contrato: { select: { contratoId: true, numeroContrato: true, estado: true } },
        proveedor: { select: { vendorId: true, nombre: true } },
        cliente: { select: { clienteId: true, nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse({ anticipos });
  } catch (error) {
    console.error('Error al obtener anticipos disponibles mobile:', error);

    if (error instanceof z.ZodError) {
      return errorResponse('Parámetros inválidos', 400, 'VALIDATION_ERROR', error.flatten());
    }

    return errorResponse('Error al obtener anticipos disponibles', 500, 'INTERNAL_ERROR');
  }
}
