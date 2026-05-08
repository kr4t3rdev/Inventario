/**
 * @description Server Actions para compras de servicios.
 *
 * @module features/compras-servicios/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { applyAnticipoAllocations } from '@/lib/services/anticipos-workflow';
import { createCompraServicioSchema, updateCompraServicioSchema } from './schemas';
import type { CreateCompraServicioInput, UpdateCompraServicioInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const COMPRA_SERVICIO_INCLUDE = {
  servicio: true,
  proveedor: true,
} as const;

export const getComprasServiciosAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  return prisma.compraServicio.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: COMPRA_SERVICIO_INCLUDE,
  });
});

export const getCompraServicioByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const compra = await prisma.compraServicio.findFirst({
    where: { compraServicioId: id, tenantId },
    include: COMPRA_SERVICIO_INCLUDE,
  });
  if (!compra) throw new ActionError('Servicio recibido no encontrado', 'NOT_FOUND');
  return compra;
});

export const createCompraServicioAction = withAction(async (input: CreateCompraServicioInput, user: AuthenticatedUser) => {
  const parsed = createCompraServicioSchema.parse(input);
  const tenantId = requireTenant(user);

  // Verificar servicio
  const servicio = await prisma.servicios.findUnique({
    where: { servicioId: parsed.servicioId },
  });
  if (!servicio) throw new ActionError('Servicio no encontrado', 'NOT_FOUND');

  // Verificar proveedor si se especificó
  if (parsed.proveedorId) {
    const proveedor = await prisma.vendor.findUnique({
      where: { vendorId: parsed.proveedorId },
    });
    if (!proveedor) throw new ActionError('Proveedor no encontrado', 'NOT_FOUND');
  }

  const total = parsed.costoUnitario * parsed.cantidad;
  const fechaServicio = parsed.fechaServicio ? new Date(parsed.fechaServicio) : new Date();
  const fechaVencimiento = parsed.fechaVencimiento ? new Date(parsed.fechaVencimiento) : null;

  if (Number.isNaN(fechaServicio.getTime())) {
    throw new ActionError('Fecha de servicio inválida', 'VALIDATION_ERROR');
  }
  if (fechaVencimiento && Number.isNaN(fechaVencimiento.getTime())) {
    throw new ActionError('Fecha de vencimiento inválida', 'VALIDATION_ERROR');
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const compraServicio = await tx.compraServicio.create({
      data: {
        tenantId,
        servicioId: parsed.servicioId,
        proveedorId: parsed.proveedorId || null,
        numeroFactura: parsed.numeroFactura || null,
        costoUnitario: parsed.costoUnitario,
        cantidad: parsed.cantidad,
        total,
        formaPago: parsed.formaPago,
        estado: parsed.estado,
        descripcion: parsed.descripcion || null,
        fechaServicio,
        fechaVencimiento,
      },
      include: COMPRA_SERVICIO_INCLUDE,
    });

    let allocationsResult: any[] = [];
    if (parsed.anticipos && parsed.anticipos.length > 0) {
      const tipoPagoDefault = await tx.tipoPago.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      const cuentaDefault = await tx.cuentaBancaria.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      allocationsResult = await applyAnticipoAllocations(tx, parsed.anticipos, {
        documentoDestinoId: compraServicio.compraServicioId,
        contexto: 'COMPRA_SERVICIO',
        usuarioId: user.userId || 'system',
        observaciones: `Anticipo aplicado a servicio recibido ${compraServicio.compraServicioId}`,
      });

      for (const alloc of allocationsResult) {
        const anticipo = await tx.anticipo.findUnique({
          where: { anticipoId: alloc.anticipoId },
          select: { tipo: true, cuentaOrigenId: true, tipoPagoOrigenId: true, proveedorId: true },
        });

        await tx.reconciliacionGasto.create({
          data: {
            tenantId,
            tipoGasto: 'COMPRA_SERVICIO',
            referenciaId: compraServicio.compraServicioId,
            cuentaId: anticipo?.cuentaOrigenId || cuentaDefault?.cuentaId || '',
            tipoPagoId: anticipo?.tipoPagoOrigenId || tipoPagoDefault?.tipoId || '',
            monto: alloc.montoAplicado,
            moneda: anticipo?.tipo === 'PAGO' ? 'CUP' : 'USD',
            descripcion: `Pago anticipado de servicio ${compraServicio.compraServicioId}`,
            reconciliadoPor: user.userId || 'system',
          },
        });
      }
    }

    return { compraServicio, allocationsResult };
  });

  revalidatePath('/busy/compras-servicios');
  return resultado;
});

export const updateCompraServicioAction = withAction(async (input: UpdateCompraServicioInput, user: AuthenticatedUser) => {
  const parsed = updateCompraServicioSchema.parse(input);
  const { compraServicioId, ...data } = parsed;
  const tenantId = requireTenant(user);

  const existing = await prisma.compraServicio.findFirst({
    where: { compraServicioId, tenantId },
    select: { compraServicioId: true },
  });
  if (!existing) throw new ActionError('Servicio recibido no encontrado', 'NOT_FOUND');

  const updateData: Record<string, unknown> = {};
  if (typeof data.numeroFactura !== 'undefined') updateData.numeroFactura = data.numeroFactura || null;
  if (typeof data.descripcion !== 'undefined') updateData.descripcion = data.descripcion || null;
  if (typeof data.formaPago !== 'undefined') updateData.formaPago = data.formaPago;
  if (typeof data.estado !== 'undefined') updateData.estado = data.estado;
  if (typeof data.costoUnitario !== 'undefined') updateData.costoUnitario = Number(data.costoUnitario);
  if (typeof data.cantidad !== 'undefined') updateData.cantidad = Number(data.cantidad);
  if (typeof data.proveedorId !== 'undefined') updateData.proveedorId = data.proveedorId || null;
  if (typeof data.fechaServicio !== 'undefined') updateData.fechaServicio = data.fechaServicio ? new Date(data.fechaServicio) : undefined;
  if (typeof data.fechaVencimiento !== 'undefined') updateData.fechaVencimiento = data.fechaVencimiento ? new Date(data.fechaVencimiento) : null;

  if (Object.keys(updateData).length === 0) {
    throw new ActionError('No hay campos para actualizar', 'VALIDATION_ERROR');
  }

  const updated = await prisma.compraServicio.update({
    where: { compraServicioId },
    data: updateData,
    include: COMPRA_SERVICIO_INCLUDE,
  });

  revalidatePath('/busy/compras-servicios');
  return updated;
});

export const deleteCompraServicioAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const existing = await prisma.compraServicio.findFirst({
    where: { compraServicioId: id, tenantId },
    select: { compraServicioId: true },
  });
  if (!existing) throw new ActionError('Servicio recibido no encontrado', 'NOT_FOUND');

  await prisma.compraServicio.delete({ where: { compraServicioId: id } });
  revalidatePath('/busy/compras-servicios');
  return { id, eliminado: true };
});
