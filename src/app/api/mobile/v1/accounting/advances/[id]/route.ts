import { NextRequest } from 'next/server';
import { z } from 'zod';

import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { errorResponse, successResponse } from '@/lib/api-response';
import { ActionError } from '@/lib/server-actions';

const updateSchema = z.object({
  estado: z.enum(['RESERVADO', 'EJECUTADO', 'ANULADO']).optional(),
  saldoDisponible: z.number().nonnegative().optional(),
  vigenciaHasta: z.string().nullable().optional(),
  referenciaExterna: z.string().nullable().optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const tenantId = requireTenant(authResult.user);
    const { id } = await params;
    const anticipo = await prisma.anticipo.findFirst({
      where: { anticipoId: id, tenantId },
      include: {
        contrato: true,
        proveedor: true,
        cliente: true,
        movimientos: {
          orderBy: { createdAt: 'desc' },
          include: {
            anticipo: {
              select: {
                tipo: true,
                proveedor: { select: { nombre: true } },
                cliente: { select: { nombre: true } },
              },
            },
          },
        },
      },
    });

    if (!anticipo) return errorResponse('Anticipo no encontrado', 404, 'NOT_FOUND');
    return successResponse({ anticipo });
  } catch (error) {
    console.error('Error al obtener anticipo mobile:', error);
    return errorResponse('Error al obtener anticipo', 500, 'INTERNAL_ERROR');
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const tenantId = requireTenant(authResult.user);
    requireFeature(authResult.user, 'anticipos', 'actualizar anticipos');
    requirePermission(authResult.user, 'financiero.contabilidad.acceder', 'actualizar anticipos');
    const { id } = await params;
    const body = await request.json();
    if (body?.estado !== undefined || body?.saldoDisponible !== undefined) {
      return errorResponse(
        'El estado y saldo del anticipo solo cambian mediante un flujo documental.',
        409,
        'DOCUMENT_WORKFLOW_REQUIRED',
      );
    }
    const payload = updateSchema.parse(body);

    const existing = await prisma.anticipo.findFirst({ where: { anticipoId: id, tenantId }, select: { anticipoId: true } });
    if (!existing) return errorResponse('Anticipo no encontrado', 404, 'NOT_FOUND');

    const anticipo = await prisma.anticipo.update({
      where: { anticipoId: id, tenantId },
      data: {
        ...(payload.referenciaExterna !== undefined && { referenciaExterna: payload.referenciaExterna }),
        ...(payload.vigenciaHasta !== undefined && { vigenciaHasta: payload.vigenciaHasta ? new Date(payload.vigenciaHasta) : null }),
      },
    });

    return successResponse({ anticipo });
  } catch (error) {
    console.error('Error al actualizar anticipo mobile:', error);
    if (error instanceof z.ZodError) return errorResponse('Payload inválido', 400, 'VALIDATION_ERROR', error.flatten());
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' || error.code === 'FEATURE_NOT_AVAILABLE' ||
        error.code === 'TENANT_REQUIRED' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400;
      return errorResponse(error.message, status, error.code);
    }
    return errorResponse('Error al actualizar anticipo', 500, 'INTERNAL_ERROR');
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    requireTenant(authResult.user);
    requireFeature(authResult.user, 'anticipos', 'eliminar anticipos');
    requirePermission(authResult.user, 'financiero.contabilidad.acceder', 'eliminar anticipos');
    await params;
    return errorResponse(
      'Un anticipo con efectos financieros debe revertirse desde el documento relacionado.',
      409,
      'DOCUMENT_WORKFLOW_REQUIRED',
    );
  } catch (error) {
    console.error('Error al eliminar anticipo mobile:', error);
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' || error.code === 'FEATURE_NOT_AVAILABLE' ||
        error.code === 'TENANT_REQUIRED' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400;
      return errorResponse(error.message, status, error.code);
    }
    return errorResponse('Error al eliminar anticipo', 500, 'INTERNAL_ERROR');
  }
}
