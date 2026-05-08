/**
 * @description Server Actions para el feature de Productos.
 *
 * Reemplazan las API routes + RTK Query por Server Actions con Prisma directo.
 * Cada acción está envuelta con withAction() que provee:
 * - Autenticación automática (via getCurrentUser)
 * - Manejo estandarizado de errores (Zod, Prisma, ActionError)
 * - Formato consistente { success, data?/error? }
 *
 * @module features/productos/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { productoSchema, productoUpdateSchema, stockUbicacionQuerySchema } from './schemas';
import type { ProductoInput, ProductoUpdateInput, StockUbicacionQuery } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Select reutilizable ──────────────────────────────────

const PRODUCTO_SELECT = {
  id: true,
  nombre: true,
  descripcion: true,
  precioCosto: true,
  precioVenta: true,
  stock: true,
  stockMinimo: true,
  codigoInterno: true,
  codigoNegocio: true,
  proveedorCodigo: true,
  categoriaId: true,
  subcategoriaId: true,
  unidadId: true,
  vendorId: true,
  almacenId: true,
  puntoDeVentaId: true,
  fotos: true,
  esCompuesto: true,
  createdAt: true,
  updatedAt: true,
  tenantId: true,
  categoria: { select: { catId: true, nombre: true } },
  subcategoria: { select: { catId: true, nombre: true } },
  unidad: { select: { unidadId: true, simbolo: true } },
  vendor: { select: { vendorId: true, nombre: true } },
} as const;

// ─── Server Actions ────────────────────────────────────────

/**
 * @description Lista todos los productos del tenant autenticado.
 */
export const getProductosAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  return prisma.producto.findMany({
    where: { tenantId },
    select: PRODUCTO_SELECT,
    orderBy: { createdAt: 'desc' },
  });
});

/**
 * @description Crea un nuevo producto con validación Zod.
 */
export const createProductoAction = withAction(async (input: ProductoInput, user: AuthenticatedUser) => {
  const parsed = productoSchema.parse(input);
  const tenantId = requireTenant(user);

  const producto = await prisma.producto.create({
    data: {
      nombre: parsed.nombre,
      descripcion: parsed.descripcion ?? null,
      precioCosto: parsed.precioCosto,
      precioVenta: parsed.precioVenta,
      stock: parsed.stock,
      stockMinimo: parsed.stockMinimo ?? 0,
      codigoInterno: parsed.codigoInterno ?? null,
      proveedorCodigo: parsed.proveedorCodigo ?? null,
      categoriaId: parsed.categoriaId,
      subcategoriaId: parsed.subcategoriaId ?? null,
      unidadId: parsed.unidadId ?? null,
      vendorId: parsed.vendorId ?? null,
      almacenId: parsed.almacenId,
      puntoDeVentaId: parsed.puntoDeVentaId ?? null,
      fotos: parsed.fotos ?? [],
      tenantId,
    },
    select: PRODUCTO_SELECT,
  });

  revalidatePath('/busy/products');
  return producto;
});

/**
 * @description Actualiza un producto existente.
 *
 * @throws ActionError si el producto no existe
 */
export const updateProductoAction = withAction(async (input: ProductoUpdateInput, user: AuthenticatedUser) => {
  const parsed = productoUpdateSchema.parse(input);
  const { id, ...updateData } = parsed;

  const tenantId = requireTenant(user);

  const existing = await prisma.producto.findUnique({
    where: { id },
    select: { id: true, tenantId: true },
  });

  if (!existing) {
    throw new ActionError('Producto no encontrado', 'NOT_FOUND');
  }

  const producto = await prisma.producto.update({
    where: { id },
    data: {
      ...(updateData.nombre !== undefined && { nombre: updateData.nombre }),
      ...(updateData.descripcion !== undefined && { descripcion: updateData.descripcion }),
      ...(updateData.precioCosto !== undefined && { precioCosto: updateData.precioCosto }),
      ...(updateData.precioVenta !== undefined && { precioVenta: updateData.precioVenta }),
      ...(updateData.stock !== undefined && { stock: updateData.stock }),
      ...(updateData.stockMinimo !== undefined && { stockMinimo: updateData.stockMinimo }),
      ...(updateData.codigoInterno !== undefined && { codigoInterno: updateData.codigoInterno }),
      ...(updateData.proveedorCodigo !== undefined && { proveedorCodigo: updateData.proveedorCodigo }),
      ...(updateData.categoriaId !== undefined && { categoriaId: updateData.categoriaId }),
      ...(updateData.subcategoriaId !== undefined && { subcategoriaId: updateData.subcategoriaId }),
      ...(updateData.unidadId !== undefined && { unidadId: updateData.unidadId }),
      ...(updateData.vendorId !== undefined && { vendorId: updateData.vendorId }),
      ...(updateData.almacenId !== undefined && { almacenId: updateData.almacenId }),
      ...(updateData.puntoDeVentaId !== undefined && { puntoDeVentaId: updateData.puntoDeVentaId }),
      ...(updateData.fotos !== undefined && { fotos: updateData.fotos }),
    },
    select: PRODUCTO_SELECT,
  });

  revalidatePath('/busy/products');
  return producto;
});

/**
 * @description Elimina un producto por ID.
 *
 * @throws ActionError si el producto no existe
 */
export const deleteProductoAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);

  const existing = await prisma.producto.findUnique({
    where: { id },
    select: { id: true, tenantId: true },
  });

  if (!existing) {
    throw new ActionError('Producto no encontrado', 'NOT_FOUND');
  }

  await prisma.producto.delete({ where: { id } });
  revalidatePath('/busy/products');

  return { id, eliminado: true };
});

// ─── Select reutilizable para stock por ubicación ──────────

const PRODUCTO_CON_STOCK_SELECT = {
  id: true,
  nombre: true,
  descripcion: true,
  codigoInterno: true,
  codigoNegocio: true,
  fotos: true,
  precioCosto: true,
  precioVenta: true,
  stock: true,
  stockMinimo: true,
  categoriaId: true,
  subcategoriaId: true,
  unidadId: true,
  vendorId: true,
  almacenId: true,
  categoria: { select: { catId: true, nombre: true } },
  subcategoria: { select: { catId: true, nombre: true, parentId: true } },
  unidad: { select: { unidadId: true, nombre: true, simbolo: true } },
  vendor: { select: { vendorId: true, nombre: true } },
} as const;

/**
 * @description Obtiene productos con su stock en una ubicación específica
 *   (almacén o punto de venta).
 *
 * - Si includeZero es false: solo productos con stock > 0 en la ubicación.
 * - Si includeZero es true: todos los productos de la ubicación, con stock=0
 *   donde no haya registro en StockUbicacion.
 *
 * @param input - { ubicacionId, tipoUbicacion, includeZero? }
 * @returns Producto[] con campos stockUbicacion y stockTotal agregados
 */
export const getStockPorUbicacionAction = withAction(
  async (input: StockUbicacionQuery, user: AuthenticatedUser) => {
    const { ubicacionId, tipoUbicacion, includeZero } =
      stockUbicacionQuerySchema.parse(input);
    const tenantId = requireTenant(user);

    // ── Path 1: solo productos con stock ──
    if (!includeZero) {
      const registros = await prisma.stockUbicacion.findMany({
        where: {
          ubicacionId,
          tipoUbicacion,
          tenantId,
          cantidad: { gt: 0 },
        },
        include: {
          producto: { select: PRODUCTO_CON_STOCK_SELECT },
        },
      });

      return registros.map((r) => ({
        ...r.producto,
        stockUbicacion: r.cantidad,
        stockTotal: r.producto.stock,
      }));
    }

    // ── Path 2: todos los productos con stock (incluye ceros) ──
    // Consulta base de productos filtrados por almacén si aplica
    const whereProductos: Record<string, unknown> = { tenantId };
    if (tipoUbicacion === 'almacen') {
      whereProductos.almacenId = ubicacionId;
    }

    const [productosBase, registrosStock] = await Promise.all([
      prisma.producto.findMany({
        where: whereProductos,
        select: PRODUCTO_CON_STOCK_SELECT,
      }),
      prisma.stockUbicacion.findMany({
        where: { ubicacionId, tipoUbicacion, tenantId },
        select: { productoId: true, cantidad: true },
      }),
    ]);

    const stockMap = new Map(
      registrosStock.map((r) => [r.productoId, r.cantidad]),
    );

    return productosBase.map((p) => ({
      ...p,
      stockUbicacion: stockMap.get(p.id) ?? 0,
      stockTotal: p.stock,
    }));
  },
);
