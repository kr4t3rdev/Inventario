/**
 * @description Server Actions para ventas de servicios.
 *
 * @module features/venta-servicios/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant, requireFeature } from '@/lib/services/tenant-scope';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import { applyAnticipoAllocations } from '@/lib/services/anticipos-workflow';
import { ventaServicioLegacySchema, ventaMixtaSchema, updateVentaServicioSchema } from './schemas';
import type { VentaServicioInput, VentaMixtaInput, VentaServicioUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const VENTA_SERVICIO_INCLUDE = {
  servicio: true,
  cliente: true,
} as const;

export const getVentaServiciosAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'ver servicios');
  return prisma.ventaServicios.findMany({
    where: { tenantId },
    include: VENTA_SERVICIO_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
});

export const getVentaServicioByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'ver servicios');
  const venta = await prisma.ventaServicios.findFirst({
    where: { ventaServicioId: id, tenantId },
    include: VENTA_SERVICIO_INCLUDE,
  });
  if (!venta) throw new ActionError('Venta de servicio no encontrada', 'NOT_FOUND');
  return venta;
});

export const createVentaServicioAction = withAction(withPeriodValidation(
  () => new Date(),
  async (input: VentaServicioInput | VentaMixtaInput, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'crear servicios');

  // Detectar modo: mixto (con lineas) vs legacy (single servicio)
  const raw = input as any;
  if (raw.lineas && Array.isArray(raw.lineas)) {
    const payload = ventaMixtaSchema.parse(raw);

    const lineasServicio = payload.lineas.filter((l: any) => l.tipoLinea === 'SERVICIO');
    const lineasProducto = payload.lineas.filter((l: any) => l.tipoLinea === 'PRODUCTO');

    if (lineasProducto.length > 0) {
      throw new ActionError('Las líneas de producto deben registrarse por /api/ventas', 'PRODUCT_LINE_NOT_SUPPORTED_IN_THIS_ENDPOINT');
    }

    const created = await prisma.$transaction(
      lineasServicio.map((linea: any) =>
        prisma.ventaServicios.create({
          data: {
            tenantId,
            servicioId: linea.servicioId!,
            cantidad: linea.cantidad,
            costo: linea.costo ?? 0,
            total: linea.cantidad * linea.precioUnitario,
            observaciones: linea.observaciones ?? payload.observaciones ?? null,
            clienteId: payload.clienteId ?? null,
          },
        })
      )
    );

    revalidatePath('/busy/venta-servicios');
    return {
      mode: 'MIXED_LINES' as const,
      lineasProcesadas: created.length,
      lineasProductoPendientes: lineasProducto.length,
      ventasServicios: created,
    };
  }

  // Legacy mode (single servicio)
  const data = ventaServicioLegacySchema.parse(raw);

  const resultado = await prisma.$transaction(async (tx) => {
    const ventaServicio = await tx.ventaServicios.create({
      data: {
        tenantId,
        servicioId: data.servicioId,
        cantidad: data.cantidad,
        costo: data.costo ?? 0,
        total: data.total,
        observaciones: data.observaciones ?? null,
        clienteId: data.clienteId ?? null,
      },
    });

    let allocationsResult: any[] = [];
    if (data.anticipos && data.anticipos.length > 0) {
      const tipoPagoDefault = await tx.tipoPago.findFirst({
        where: { isActive: true, tenantId },
        orderBy: { createdAt: 'asc' },
      });
      const cuentaDefault = await tx.cuentaBancaria.findFirst({
        where: { isActive: true, tenantId },
        orderBy: { createdAt: 'asc' },
      });

      allocationsResult = await applyAnticipoAllocations(tx, data.anticipos, {
        documentoDestinoId: ventaServicio.ventaServicioId,
        contexto: 'FACTURA_DIRECTA',
        usuarioId: data.clienteId || 'system',
        observaciones: `Anticipo aplicado a venta de servicio ${ventaServicio.ventaServicioId}`,
      });

      for (const alloc of allocationsResult) {
        const anticipo = await tx.anticipo.findUnique({
          where: { anticipoId: alloc.anticipoId },
          select: { tipo: true, cuentaOrigenId: true, tipoPagoOrigenId: true, clienteId: true },
        });

        await tx.reconciliacionServicio.create({
          data: {
            tenantId,
            ventaServicioId: ventaServicio.ventaServicioId,
            cuentaId: anticipo?.cuentaOrigenId || cuentaDefault?.cuentaId || '',
            tipoPagoId: anticipo?.tipoPagoOrigenId || tipoPagoDefault?.tipoId || '',
            monto: alloc.montoAplicado,
            moneda: anticipo?.tipo === 'COBRO' ? 'CUP' : 'USD',
            observaciones: `Cobro anticipado en servicio ${ventaServicio.ventaServicioId}`,
            reconciliadoPor: data.clienteId || 'system',
          },
        });
      }
    }

    return { ventaServicio, allocationsResult };
  });

  revalidatePath('/busy/venta-servicios');
  return resultado;
}));

export const updateVentaServicioAction = withAction(async (input: VentaServicioUpdateInput, user: AuthenticatedUser) => {
  const parsed = updateVentaServicioSchema.parse(input);
  const { ventaServicioId, ...data } = parsed;
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'editar servicios');

  const existing = await prisma.ventaServicios.findFirst({
    where: { ventaServicioId, tenantId },
    select: { ventaServicioId: true },
  });
  if (!existing) throw new ActionError('Venta de servicio no encontrada', 'NOT_FOUND');

  const updateData: Record<string, unknown> = {};
  if (data.cantidad !== undefined) updateData.cantidad = data.cantidad;
  if (data.costo !== undefined) updateData.costo = data.costo;
  if (data.total !== undefined) updateData.total = data.total;
  if (data.observaciones !== undefined) updateData.observaciones = data.observaciones;
  if (data.clienteId !== undefined) updateData.clienteId = data.clienteId;

  const updated = await prisma.ventaServicios.update({
    where: { ventaServicioId },
    data: updateData,
  });

  revalidatePath('/busy/venta-servicios');
  return updated;
});

export const deleteVentaServicioAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'eliminar servicios');
  const existing = await prisma.ventaServicios.findFirst({
    where: { ventaServicioId: id, tenantId },
    select: { ventaServicioId: true },
  });
  if (!existing) throw new ActionError('Venta de servicio no encontrada', 'NOT_FOUND');

  await prisma.ventaServicios.delete({ where: { ventaServicioId: id } });
  revalidatePath('/busy/venta-servicios');
  return { id, eliminado: true };
});
