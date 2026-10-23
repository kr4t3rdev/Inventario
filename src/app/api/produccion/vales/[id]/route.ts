import { NextRequest, NextResponse } from 'next/server';
import { withAuthGet, withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { ActionError } from '@/lib/server-actions/types';

const updateValeSchema = z.object({
  concepto: z.string().min(1).max(200).optional(),
  observaciones: z.string().max(1000).optional().nullable(),
});

const valeInclude = {
  ValeSalidaItem: {
    include: { Producto: { select: { id: true, nombre: true, precioCosto: true, stock: true, tenantId: true } } },
  },
};

const valePatchInclude = {
  ValeSalidaItem: {
    include: { Producto: { select: { id: true, nombre: true, tenantId: true } } },
  },
};

function safeValeResponse<T extends { ValeSalidaItem: Array<{ tenantId: string; Producto: { tenantId: string } | null }> }>(vale: T, tenantId: string) {
  if (vale.ValeSalidaItem.some((item) => item.tenantId !== tenantId || item.Producto?.tenantId !== tenantId)) return null;
  return {
    ...vale,
    ValeSalidaItem: vale.ValeSalidaItem.map(({ Producto, ...item }) => ({
      ...item,
      Producto: Producto ? (({ tenantId: _tenantId, ...product }) => product)(Producto) : null,
    })),
  };
}

/** @description Obtiene un vale dentro del tenant autenticado. */
export const GET = withAuthGet(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }, user: AuthenticatedUser) => {
  try {
    if (!user.tenantId) return NextResponse.json({ error: 'Sin contexto de tenant.' }, { status: 403 });
    const tenantId = requireTenant(user);
    requirePermission(user, 'produccion.vales.gestionar', 'gestionar vales de salida');
    const { id } = await params;
    const vale = await prisma.valeSalida.findFirst({
      where: { valeSalidaId: id, tenantId },
      include: valeInclude,
    });
    if (!vale) return NextResponse.json({ error: 'Vale de salida no encontrado.' }, { status: 404 });
    const safe = safeValeResponse(vale, tenantId);
    if (!safe) return NextResponse.json({ error: 'Vale de salida no encontrado.' }, { status: 404 });
    return NextResponse.json(safe);
  } catch (error) {
    if (error instanceof ActionError) return NextResponse.json({ error: error.message }, { status: error.code === 'FORBIDDEN' ? 403 : 400 });
    console.error('Error al obtener vale de salida:', error);
    return NextResponse.json({ error: 'Error al obtener vale de salida.' }, { status: 500 });
  }
});

/** @description Actualiza los campos editables de un vale pendiente del tenant. */
export const PATCH = withAuth(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }, user: AuthenticatedUser) => {
  try {
    if (!user.tenantId) return NextResponse.json({ error: 'Sin contexto de tenant.' }, { status: 403 });
    const tenantId = requireTenant(user);
    requirePermission(user, 'produccion.vales.gestionar', 'gestionar vales de salida');
    const { id } = await params;
    const payload = updateValeSchema.parse(await request.json());
    const current = await prisma.valeSalida.findFirst({
      where: { valeSalidaId: id, tenantId },
      include: valePatchInclude,
    });
    if (!current) return NextResponse.json({ error: 'Vale de salida no encontrado.' }, { status: 404 });
    if (current.estado !== 'pendiente') return NextResponse.json({ error: 'Solo se pueden modificar vales pendientes.' }, { status: 400 });
    if (!safeValeResponse(current, tenantId)) {
      return NextResponse.json({ error: 'Vale de salida no encontrado.' }, { status: 404 });
    }
    const updated = await prisma.valeSalida.updateMany({
      where: { valeSalidaId: id, tenantId, estado: 'pendiente' },
      data: payload,
    });
    if (updated.count !== 1) return NextResponse.json({ error: 'Solo se pueden modificar vales pendientes.' }, { status: 400 });
    const vale = await prisma.valeSalida.findFirst({
      where: { valeSalidaId: id, tenantId },
      include: valePatchInclude,
    });
    const safe = vale ? safeValeResponse(vale, tenantId) : null;
    if (!safe) return NextResponse.json({ error: 'Vale de salida no encontrado.' }, { status: 404 });
    return NextResponse.json(safe);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos para actualizar vale.', issues: error.issues }, { status: 400 });
    if (error instanceof ActionError) return NextResponse.json({ error: error.message }, { status: error.code === 'FORBIDDEN' ? 403 : 400 });
    console.error('Error al actualizar vale de salida:', error);
    return NextResponse.json({ error: 'Error al actualizar vale de salida.' }, { status: 500 });
  }
});

/** @description Anula el vale y restaura su stock una sola vez. */
export const DELETE = withAuth(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }, user: AuthenticatedUser) => {
  try {
    if (!user.tenantId) return NextResponse.json({ error: 'Sin contexto de tenant.' }, { status: 403 });
    const tenantId = requireTenant(user);
    requirePermission(user, 'produccion.vales.gestionar', 'gestionar vales de salida');
    const { id } = await params;
    const current = await prisma.valeSalida.findFirst({ where: { valeSalidaId: id, tenantId } });
    if (!current) return NextResponse.json({ error: 'Vale de salida no encontrado.' }, { status: 404 });
    if (String(current.estado).toLowerCase() === 'anulada') return NextResponse.json({ error: 'El vale ya está anulado.' }, { status: 400 });

    const claimed = await prisma.$transaction(async (tx) => {
      const items = await tx.valeSalidaItem.findMany({
        where: { valeSalidaId: id },
        include: { Producto: { select: { id: true, tenantId: true } } },
      });
      const restorations: Array<{ productoId: string; tipoUbicacion: 'almacen'; ubicacionId: string; cantidad: number }> = [];
      for (const item of items) {
        if (
          item.tenantId !== tenantId || item.Producto?.tenantId !== tenantId ||
          item.sourceTipoUbicacion !== 'almacen' || !item.sourceUbicacionId
        ) {
          throw new ActionError('Vale de salida no encontrado.', 'NOT_FOUND');
        }
        const product = await tx.producto.findFirst({
          where: { id: item.productoId, tenantId },
          select: { id: true },
        });
        if (!product) {
          throw new ActionError('Vale de salida no encontrado.', 'NOT_FOUND');
        }
        const warehouse = await tx.almacen.findFirst({
          where: { almacenId: item.sourceUbicacionId, tenantId },
          select: { almacenId: true },
        });
        const stockLocation = warehouse ? await tx.stockUbicacion.findFirst({
          where: { tenantId, productoId: product.id, tipoUbicacion: item.sourceTipoUbicacion, ubicacionId: warehouse.almacenId },
          select: { id: true },
        }) : null;
        if (!warehouse || !stockLocation) throw new ActionError('Vale de salida no encontrado.', 'NOT_FOUND');
        restorations.push({
          productoId: product.id,
          tipoUbicacion: item.sourceTipoUbicacion,
          ubicacionId: warehouse.almacenId,
          cantidad: item.cantidad,
        });
      }
      const result = await tx.valeSalida.updateMany({
        where: { valeSalidaId: id, tenantId, estado: current.estado },
        data: { estado: 'anulada' },
      });
      if (result.count !== 1) return false;
      for (const restoration of restorations) {
        await upsertStockUbicacion(tx, {
          tenantId, productoId: restoration.productoId, tipoUbicacion: restoration.tipoUbicacion,
          ubicacionId: restoration.ubicacionId, modo: 'increment', delta: restoration.cantidad,
        });
      }
      return true;
    });
    if (!claimed) return NextResponse.json({ error: 'El vale ya está anulado.' }, { status: 400 });
    return NextResponse.json({ success: true, message: 'Vale anulado correctamente.' });
  } catch (error) {
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error('Error al anular vale de salida:', error);
    return NextResponse.json({ error: 'Error al anular vale de salida.' }, { status: 500 });
  }
});
