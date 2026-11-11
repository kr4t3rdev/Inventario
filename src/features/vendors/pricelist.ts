/**
 * @description Server Actions y helpers del pricelist de proveedor (F-3,
 * espejo Odoo vendor pricelist) y la vista 360 del proveedor.
 *
 * `ProveedorProducto` guarda el costo real por (tenant, vendor, producto) con
 * referencia a la última compra; el preferente es único por producto entre
 * vendors. El sync automático ocurre al registrar cada factura de compra.
 *
 * @module features/vendors/pricelist
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ActionError, withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

interface SyncProveedorProductosParams {
  tenantId: string;
  proveedorId: string;
  compraDocumentoId: string;
  items: { productoId: string; precioUnitario: number }[];
}

/**
 * @description Sincroniza el pricelist del proveedor con el costo real de los
 * ítems de una factura de compra (upsert por vendor+producto).
 * @param {any} tx - Cliente/tx Prisma (se llama dentro de la transacción de compra).
 * @param {SyncProveedorProductosParams} params - Tenant, proveedor, compra e ítems con costo.
 * @returns {Promise<void>}
 */
export async function sincronizarProveedorProductos(
  tx: any,
  params: SyncProveedorProductosParams,
): Promise<void> {
  const { tenantId, proveedorId, compraDocumentoId, items } = params;
  for (const item of items) {
    await tx.proveedorProducto.upsert({
      where: {
        tenantId_vendorId_productoId: {
          tenantId,
          vendorId: proveedorId,
          productoId: item.productoId,
        },
      },
      create: {
        tenantId,
        vendorId: proveedorId,
        productoId: item.productoId,
        costoUnitario: item.precioUnitario,
        ultimaCompraDocumentoId: compraDocumentoId,
        esPreferente: false,
      },
      update: {
        costoUnitario: item.precioUnitario,
        ultimaCompraDocumentoId: compraDocumentoId,
      },
    });
  }
}

interface ResolverPrecioParams {
  tenantId: string;
  proveedorId: string;
  productoId: string;
}

/**
 * @description Resuelve el costo de un producto para un proveedor: el
 * preferente si existe; si no, el registro más reciente.
 * @param {any} tx - Cliente/tx Prisma.
 * @param {ResolverPrecioParams} params - Tenant, proveedor y producto.
 * @returns {Promise<number|null>} Costo unitario en centavos o null si no hay registro.
 */
export async function resolverPrecioProveedor(
  tx: any,
  params: ResolverPrecioParams,
): Promise<number | null> {
  const registro = await tx.proveedorProducto.findFirst({
    where: {
      tenantId: params.tenantId,
      vendorId: params.proveedorId,
      productoId: params.productoId,
    },
    orderBy: [{ esPreferente: 'desc' }, { createdAt: 'desc' }],
  });
  return registro ? registro.costoUnitario : null;
}

const upsertProveedorProductoSchema = z.object({
  vendorId: z.string().min(1, 'El proveedor es requerido'),
  productoId: z.string().min(1, 'El producto es requerido'),
  costoUnitario: z.coerce.number().int().positive('El costo debe ser mayor a 0'),
  moneda: z.enum(['CUP', 'USD', 'EUR', 'MLC']).default('CUP'),
  cantidadMinima: z.coerce.number().int().positive().optional().nullable(),
  plazoEntregaDias: z.coerce.number().int().nonnegative().optional().nullable(),
  esPreferente: z.boolean().optional().default(false),
});

/**
 * @description Crea o actualiza un precio de proveedor (manual). Con
 * `esPreferente` desmarca primero a los demás vendors del mismo producto.
 * @param {z.input<typeof upsertProveedorProductoSchema>} input - Datos del precio.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Resultado con el registro persistido.
 */
export const upsertProveedorProductoAction = withAction(
  async (
    input: z.input<typeof upsertProveedorProductoSchema>,
    user: AuthenticatedUser,
  ) => {
    const parsed = upsertProveedorProductoSchema.parse(input);
    const tenantId = requireTenant(user);
    requireFeature(user, 'proveedores', 'gestionar precios de proveedores');

    const [vendor, producto] = await Promise.all([
      prisma.vendor.findFirst({
        where: { vendorId: parsed.vendorId, tenantId },
        select: { vendorId: true },
      }),
      prisma.producto.findFirst({
        where: { id: parsed.productoId, tenantId },
        select: { id: true },
      }),
    ]);
    if (!vendor) throw new ActionError('Proveedor no encontrado', 'NOT_FOUND');
    if (!producto) throw new ActionError('Producto no encontrado', 'NOT_FOUND');

    if (parsed.esPreferente) {
      await prisma.proveedorProducto.updateMany({
        where: { tenantId, productoId: parsed.productoId },
        data: { esPreferente: false },
      });
    }

    const registro = await prisma.proveedorProducto.upsert({
      where: {
        tenantId_vendorId_productoId: {
          tenantId,
          vendorId: parsed.vendorId,
          productoId: parsed.productoId,
        },
      },
      create: {
        tenantId,
        vendorId: parsed.vendorId,
        productoId: parsed.productoId,
        costoUnitario: parsed.costoUnitario,
        moneda: parsed.moneda,
        cantidadMinima: parsed.cantidadMinima ?? null,
        plazoEntregaDias: parsed.plazoEntregaDias ?? null,
        esPreferente: parsed.esPreferente,
      },
      update: {
        costoUnitario: parsed.costoUnitario,
        moneda: parsed.moneda,
        cantidadMinima: parsed.cantidadMinima ?? null,
        plazoEntregaDias: parsed.plazoEntregaDias ?? null,
        esPreferente: parsed.esPreferente,
      },
    });

    revalidatePath('/busy/vendor');
    return registro;
  },
);

/**
 * @description Marca un registro de pricelist como preferente de su producto,
 * desmarcando al resto de vendors para el mismo producto.
 * @param {string} proveedorProductoId - Identificador del registro.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Resultado con el registro actualizado.
 */
export const setProveedorProductoPreferenteAction = withAction(
  async (proveedorProductoId: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);
    requireFeature(user, 'proveedores', 'gestionar precios de proveedores');

    const registro = await prisma.proveedorProducto.findFirst({
      where: { proveedorProductoId, tenantId },
    });
    if (!registro) {
      throw new ActionError('Registro no encontrado', 'NOT_FOUND');
    }

    await prisma.proveedorProducto.updateMany({
      where: { tenantId, productoId: registro.productoId },
      data: { esPreferente: false },
    });
    const actualizado = await prisma.proveedorProducto.update({
      where: { proveedorProductoId },
      data: { esPreferente: true },
    });

    revalidatePath('/busy/vendor');
    return actualizado;
  },
);

/**
 * @description Compone la vista 360 del proveedor: perfil, pricelist, últimas
 * 20 compras, CxP abiertas, anticipos tipo PAGO activos, deudas cash,
 * contratos y métricas (comprado 12 meses). Todo filtrado por tenant.
 * @param {string} vendorId - Identificador del proveedor.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Resultado con las secciones del 360.
 */
export const getProveedor360Action = withAction(
  async (vendorId: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);
    requireFeature(user, 'proveedores', 'ver el detalle de proveedores');

    const vendor = await prisma.vendor.findFirst({
      where: { vendorId, tenantId },
    });
    if (!vendor) {
      throw new ActionError('Proveedor no encontrado', 'NOT_FOUND');
    }

    const hace12Meses = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const [pricelist, comprasRecientes, cuentasPorPagar, anticipos, deudasCash, contratos, metrica] =
      await Promise.all([
        prisma.proveedorProducto.findMany({
          where: { tenantId, vendorId },
          include: {
            producto: { select: { id: true, nombre: true, codigoInterno: true } },
          },
          orderBy: [{ esPreferente: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.compraDocumento.findMany({
          where: { tenantId, proveedorId: vendorId, deletedAt: null, estado: { not: 'ANULADA' } },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            compraDocumentoId: true,
            numeroFactura: true,
            estado: true,
            total: true,
            moneda: true,
            createdAt: true,
          },
        }),
        prisma.cuentaPorPagar.findMany({
          where: { tenantId, proveedorId: vendorId, estado: { not: 'PAGADA' }, deletedAt: null },
          orderBy: { fechaEmision: 'desc' },
        }),
        prisma.anticipo.findMany({
          where: { tenantId, proveedorId: vendorId, tipo: 'PAGO', estado: { not: 'ANULADO' } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.deudaCash.findMany({
          where: { tenantId, proveedorId: vendorId },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.contrato.findMany({
          where: { tenantId, vendorId },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.compraDocumento.aggregate({
          where: {
            tenantId,
            proveedorId: vendorId,
            deletedAt: null,
            estado: { not: 'ANULADA' },
            createdAt: { gte: hace12Meses },
          },
          _sum: { total: true },
        }),
      ]);

    return {
      vendor,
      pricelist,
      comprasRecientes,
      cuentasPorPagar,
      anticipos,
      deudasCash,
      contratos,
      metricas: {
        totalComprado12Meses: metrica._sum.total ?? 0,
        ultimaCompra: comprasRecientes[0]?.createdAt ?? null,
      },
    };
  },
);
