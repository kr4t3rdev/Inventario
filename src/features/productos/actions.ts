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
import { z } from 'zod';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { executeProductInstanceCreationWorkflow } from '@/lib/restock-utils';
import {
  productoSchema,
  productoUpdateSchema,
  stockUbicacionQuerySchema,
  restockSchema,
} from './schemas';
import type {
  ProductoInput,
  ProductoUpdateInput,
  StockUbicacionQuery,
  RestockInput,
} from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type {
  RestockHistoryQueryInput,
  RestockHistoryResponse,
  RestockHistoryItem,
} from './types';

// ─── EAN-13: shared utilities ─────────────────────────────
import {
  resolveTaxonomySegments,
  generateProductCodeWithRetry,
  normalizeProveedorCodigo,
} from '@/lib/product-business-code';
import {
  FindNextAvailableSurtido,
  ValidateAssembledCode,
} from '@/lib/ean13-utils';

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
  idSeccionCodigo: true,
  especificoCodigo: true,
  surtidoCodigo: true,
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
  subcategoria: { select: { catId: true, nombre: true, parentId: true } },
  unidad: { select: { unidadId: true, nombre: true, simbolo: true } },
  vendor: { select: { vendorId: true, nombre: true } },
  precios: { select: { listaPrecioId: true, precio: true } },
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
 * @description Obtiene un producto por ID dentro del tenant autenticado.
 */
export const getProductoByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);

  const producto = await prisma.producto.findFirst({
    where: { id, tenantId },
    select: PRODUCTO_SELECT,
  });

  if (!producto) {
    throw new ActionError('Producto no encontrado', 'NOT_FOUND');
  }

  return producto;
});

/**
 * @description Crea un nuevo producto con validación Zod.
 * Cuando la empresa usa EAN-13, genera el código de negocio completo
 * (sección, específico, surtido, dígito de control) de forma automática.
 */
export const createProductoAction = withAction(async (input: ProductoInput, user: AuthenticatedUser) => {
  const parsed = productoSchema.parse(input);
  const tenantId = requireTenant(user);

  // ── Detectar si la empresa usa EAN-13 ──
  const miEmpresa = await prisma.miEmpresa.findFirst({
    select: { usaCodigoEan13: true },
  });
  const usaCodigoEan13 = miEmpresa?.usaCodigoEan13 ?? false;

  if (usaCodigoEan13) {
    // ── Resolver proveedor ──
    let proveedorCodigo: string;
    let resolvedVendorId: string | null = parsed.vendorId ?? null;

    if (parsed.vendorId) {
      const vendor = await prisma.vendor.findUnique({
        where: { vendorId: parsed.vendorId },
        select: {
          vendorId: true,
          vendorCode: true,
        },
      });

      if (!vendor) {
        throw new ActionError('El proveedor seleccionado no existe', 'VALIDATION_ERROR');
      }

      if (vendor.vendorCode) {
        proveedorCodigo = normalizeProveedorCodigo(vendor.vendorCode);
      } else if (parsed.proveedorCodigo) {
        proveedorCodigo = normalizeProveedorCodigo(parsed.proveedorCodigo);
      } else {
        throw new ActionError(
          'El proveedor seleccionado no tiene código configurado para generar el EAN-13',
          'VALIDATION_ERROR',
        );
      }
    } else {
      if (!parsed.proveedorCodigo) {
        throw new ActionError(
          'Debe ingresar el código de proveedor (2 dígitos) para generar el EAN-13',
          'VALIDATION_ERROR',
        );
      }
      proveedorCodigo = normalizeProveedorCodigo(parsed.proveedorCodigo);
      resolvedVendorId = null;
    }

    // ── Validar categoría/subcategoría ──
    if (!parsed.categoriaId) {
      throw new ActionError('La categoría es requerida para generar el código de negocio', 'VALIDATION_ERROR');
    }
    if (!parsed.subcategoriaId) {
      throw new ActionError('La subcategoría es requerida para generar el código de negocio', 'VALIDATION_ERROR');
    }

    const [categoria, subcategoria] = await Promise.all([
      prisma.categoria.findUnique({
        where: { catId: parsed.categoriaId },
        select: { catId: true, nombre: true },
      }),
      prisma.categoria.findUnique({
        where: { catId: parsed.subcategoriaId },
        select: { catId: true, nombre: true, parentId: true },
      }),
    ]);

    if (!categoria) {
      throw new ActionError('La categoría seleccionada no existe', 'VALIDATION_ERROR');
    }
    if (!subcategoria) {
      throw new ActionError('La subcategoría seleccionada no existe', 'VALIDATION_ERROR');
    }
    if (subcategoria.parentId !== parsed.categoriaId) {
      throw new ActionError('La subcategoría debe pertenecer a la categoría seleccionada', 'VALIDATION_ERROR');
    }

    const resolvedSegments = resolveTaxonomySegments(
      categoria.nombre,
      subcategoria.nombre
    );

    // ── Generar código EAN-13 en transacción ──
    const resultado = await prisma.$transaction(async (tx) => {
      const surtido = await FindNextAvailableSurtido(
        tx,
        tenantId,
        proveedorCodigo
      );

      const generatedCode = await generateProductCodeWithRetry(
        tx,
        {
          proveedorCodigo,
          idSeccionCodigo: resolvedSegments.idSeccionCodigo,
          especificoCodigo: resolvedSegments.especificoCodigo,
          surtidoCodigo: surtido,
        },
        3
      );

      if (!ValidateAssembledCode(generatedCode.codigoNegocio)) {
        throw new ActionError('El código EAN-13 generado no pasó validación', 'VALIDATION_ERROR');
      }

      const producto = await tx.producto.create({
        data: {
          nombre: parsed.nombre,
          descripcion: parsed.descripcion ?? null,
          precioCosto: parsed.precioCosto,
          precioVenta: parsed.precioVenta,
          stock: parsed.stock,
          stockMinimo: parsed.stockMinimo ?? 0,
          codigoInterno: parsed.codigoInterno ?? null,
          // EAN-13 fields
          codigoNegocio: generatedCode.codigoNegocio,
          proveedorCodigo: generatedCode.proveedorCodigo,
          idSeccionCodigo: generatedCode.idSeccionCodigo,
          especificoCodigo: generatedCode.especificoCodigo,
          surtidoCodigo: generatedCode.surtidoCodigo,
          dcCodigo: generatedCode.dcCodigo,
          categoriaId: parsed.categoriaId,
          subcategoriaId: parsed.subcategoriaId ?? null,
          unidadId: parsed.unidadId ?? null,
          vendorId: resolvedVendorId,
          almacenId: parsed.almacenId,
          puntoDeVentaId: parsed.puntoDeVentaId ?? null,
          fotos: parsed.fotos ?? [],
          tenantId,
          ...(parsed.precios?.length
            ? {
                precios: {
                  create: parsed.precios.map((p) => ({
                    listaPrecioId: p.listaPrecioId,
                    precio: p.precio,
                  })),
                },
              }
            : {}),
        },
        select: PRODUCTO_SELECT,
      });

      if (parsed.stock > 0) {
        await upsertStockUbicacion(tx, {
          productoId: producto.id,
          tipoUbicacion: 'almacen',
          ubicacionId: parsed.almacenId,
          modo: 'set',
          valor: parsed.stock,
        });
      }

      return { producto, generatedCode };
    });

    // ── GastoCompra para stock inicial ──
    if (parsed.stock > 0 && resolvedVendorId) {
      const now = new Date();
      const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await prisma.gastoCompra.create({
        data: {
          tenantId,
          productoId: resultado.producto.id,
          vendorId: resolvedVendorId,
          cantidad: parsed.stock,
          precioUnitario: parsed.precioCosto,
          total: parsed.stock * parsed.precioCosto,
          fechaCompra: now,
          descripcion: `Compra inicial - ${parsed.nombre}`,
          periodo,
        },
      });
    }

    revalidatePath('/busy/products');
    return resultado.producto;
  }

  // ── Sin EAN-13: create simple ──
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
      ...(parsed.precios?.length
        ? {
            precios: {
              create: parsed.precios.map((p) => ({
                listaPrecioId: p.listaPrecioId,
                precio: p.precio,
              })),
            },
          }
        : {}),
    },
    select: PRODUCTO_SELECT,
  });

  if (parsed.stock > 0) {
    await upsertStockUbicacion(prisma, {
      productoId: producto.id,
      tipoUbicacion: 'almacen',
      ubicacionId: parsed.almacenId,
      modo: 'set',
      valor: parsed.stock,
    });
  }

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

  // Upsert precios por lista antes de actualizar el producto
  if (parsed.precios?.length) {
    await Promise.all(
      parsed.precios.map((p) =>
        prisma.precioProducto.upsert({
          where: {
            listaPrecioId_productoId: {
              listaPrecioId: p.listaPrecioId,
              productoId: id,
            },
          },
          update: { precio: p.precio },
          create: {
            listaPrecioId: p.listaPrecioId,
            productoId: id,
            precio: p.precio,
          },
        }),
      ),
    );
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
  proveedorCodigo: true,
  idSeccionCodigo: true,
  especificoCodigo: true,
  surtidoCodigo: true,
  dcCodigo: true,
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

/**
 * Schema para bulk update de stock mínimo.
 */
const bulkUpdateSchema = z.object({
  updates: z.array(z.object({
    productoId: z.string().min(1),
    stockMinimo: z.number().int().min(0),
  })).min(1),
});

/**
 * @description Actualiza masivamente el stock mínimo de múltiples productos.
 *
 * Cada producto se actualiza de forma independiente; si uno falla, los demás
 * continúan. Retorna un resumen con conteo de éxitos y errores.
 *
 * @param input - { updates: { productoId, stockMinimo }[] }
 * @returns { updated, errors[], results[] }
 */
export const bulkUpdateStockMinimoAction = withAction(
  async (input: z.infer<typeof bulkUpdateSchema>, user: AuthenticatedUser) => {
    const { updates } = bulkUpdateSchema.parse(input);
    requireTenant(user);

    const results: Array<{ productoId: string; success: boolean }> = [];
    const errors: Array<{ productoId: string; error: string }> = [];

    for (const update of updates) {
      try {
        await prisma.producto.update({
          where: { id: update.productoId },
          data: { stockMinimo: update.stockMinimo },
        });
        results.push({ productoId: update.productoId, success: true });
      } catch {
        errors.push({ productoId: update.productoId, error: 'Error al actualizar' });
        results.push({ productoId: update.productoId, success: false });
      }
    }

    revalidatePath('/busy/products');
    return {
      updated: results.filter((r) => r.success).length,
      errors,
      results,
    };
  },
);

/**
 * @description Obtiene el historial de restock paginado de un producto.
 *
 * @param input - { productoId, page?, limit?, sortBy?, sortOrder? }
 * @returns Historial paginado con resumen estadístico
 */
export const getRestockHistoryAction = withAction(
  async (input: RestockHistoryQueryInput, user: AuthenticatedUser): Promise<RestockHistoryResponse> => {
    requireTenant(user);
    const {
      productoId,
      page = 1,
      limit = 15,
      sortBy = 'fecha',
      sortOrder = 'desc',
    } = input;

    const skip = (page - 1) * limit;

    const [rawHistory, totalItems, summary] = await Promise.all([
      prisma.gastoCompra.findMany({
        where: { productoId, tenantId: (user as { tenantId: string }).tenantId },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        include: {
          producto: { select: { id: true, nombre: true, precioCosto: true, precioVenta: true } },
          vendor: { select: { nombre: true, contacto: true } },
        },
      }),
      prisma.gastoCompra.count({
        where: { productoId, tenantId: (user as { tenantId: string }).tenantId },
      }),
      prisma.gastoCompra.aggregate({
        where: { productoId, tenantId: (user as { tenantId: string }).tenantId },
        _count: { productoId: true },
        _sum: { cantidad: true, total: true },
      }),
    ]);

    const history: RestockHistoryItem[] = rawHistory.map((record) => ({
      id: record.gastoCompraId,
      fecha: record.createdAt.toISOString(),
      cantidad: record.cantidad,
      precioCostoAnterior: 0,
      precioCostoNuevo: record.precioUnitario,
      precioVentaAnterior: record.producto?.precioVenta ?? 0,
      precioVentaNuevo: record.producto?.precioVenta ?? 0,
      totalCompra: record.total,
      descripcion: record.descripcion,
      tipoOperacion: 'restock_same_prices' as const,
      vendor: {
        nombre: record.vendor?.nombre ?? 'Desconocido',
        contacto: record.vendor?.contacto ?? null,
      },
    }));

    const totalPages = Math.ceil(totalItems / limit);
    const totalRestocks = summary._count.productoId || 0;
    const totalQuantityAdded = summary._sum.cantidad || 0;
    const totalCostSpent = summary._sum.total || 0;

    return {
      history,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      summary: {
        totalRestocks,
        totalQuantityAdded,
        totalCostSpent,
        averageCostPerRestock: totalRestocks > 0 ? Math.round(totalCostSpent / totalRestocks) : 0,
        priceChanges: 0,
      },
    };
  },
);

// ─── Select reutilizable para restock ─────────────────────

const PRODUCTO_RESTOOK_SELECT = {
  id: true,
  nombre: true,
  descripcion: true,
  codigoInterno: true,
  precioCosto: true,
  precioVenta: true,
  stock: true,
  fotos: true,
  categoriaId: true,
  subcategoriaId: true,
  unidadId: true,
  vendorId: true,
  almacenId: true,
  puntoDeVentaId: true,
  tenantId: true,
  proveedorCodigo: true,
  codigoNegocio: true,
  stockMinimo: true,
  esCompuesto: true,
  categoria: { select: { catId: true, nombre: true } },
  unidad: { select: { unidadId: true, simbolo: true } },
  vendor: { select: { vendorId: true, nombre: true } },
  almacen: { select: { almacenId: true, nombre: true } },
} as const;

/**
 * @description Realiza un restock de producto: actualiza stock, crea GastoCompra,
 *   gestiona flujo de pagos (completo o parcial) y maneja conversión de monedas.
 *
 * Replica la lógica core de restockProductoHandler como Server Action.
 * El handler legacy se mantiene como fallback (no se elimina).
 *
 * @param input - Payload del restock validado con restockSchema
 * @returns { success, data: { producto, gastoCompra } }
 * @throws ActionError en caso de producto no encontrado, cuenta inactiva, etc.
 */
export const restockProductoAction = withAction(withPeriodValidation(
  () => new Date(),
  async (input: RestockInput, user: AuthenticatedUser) => {
    const parsed = restockSchema.parse(input);
    const {
      productoId,
      cantidad,
      precioCosto,
      precioVenta,
      descripcion,
      numeroFactura,
      facturaUrl,
      formaPago,
      estado,
      moneda,
      tasaCambio,
      montoConvertido,
      monedaOriginal,
      montoOriginal,
      cuentaId: cuentaIdParam,
      tipoRestock,
    } = parsed;

    const tenantId = requireTenant(user);

    // ── 1. Verificar existencia del producto ──
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      include: {
        categoria: true,
        unidad: true,
        vendor: true,
        almacen: true,
      },
    });

    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND');
    }

    // ── 2. Ejecutar workflow de instancia ──
    const forceNewInstance = tipoRestock === 'nueva_instancia';
    const forceSumStock = tipoRestock === 'sumar_stock';

    const workflowResult = executeProductInstanceCreationWorkflow({
      currentProduct: {
        id: producto.id,
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        codigoInterno: producto.codigoInterno,
        precioCosto: producto.precioCosto,
        precioVenta: producto.precioVenta,
        stock: producto.stock,
        fotos: producto.fotos || [],
        categoriaId: producto.categoriaId,
        unidadId: producto.unidadId,
        vendorId: producto.vendorId,
        almacenId: producto.almacenId,
        puntoDeVentaId: producto.puntoDeVentaId,
      },
      restockQuantity: cantidad,
      newCostPrice: precioCosto,
      newSellingPrice: precioVenta,
      forceNewInstance,
      forceSumStock,
    });

    // ── 3. Transacción: stock + gastos + pagos ──
    const result = await prisma.$transaction(
      async (tx) => {
        let updatedProducto: typeof producto;
        let newProductInstance: typeof producto | null = null;
        let gastoCompra: Awaited<ReturnType<typeof tx.gastoCompra.create>>;
        let compraProducto: Awaited<
          ReturnType<typeof tx.compraProducto.create>
        > | null = null;

        const now = new Date();
        const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // ── 3a. Crear nueva instancia si aplica ──
        if (
          workflowResult.needsNewInstance &&
          workflowResult.newInstance
        ) {
          newProductInstance = await tx.producto.create({
            data: {
              ...workflowResult.newInstance.data,
              tenantId,
            },
            include: {
              categoria: true,
              unidad: true,
              vendor: true,
              almacen: true,
            },
          });

          const targetProducto = newProductInstance;
          const costPrice =
            precioCosto ?? targetProducto.precioCosto;
          const totalCost = cantidad * costPrice;

          // GastoCompra asociado a la nueva instancia
          gastoCompra = await tx.gastoCompra.create({
            data: {
              productoId: targetProducto.id,
              vendorId: targetProducto.vendorId!,
              cantidad,
              precioUnitario: costPrice,
              total: totalCost,
              fechaCompra: now,
              descripcion:
                descripcion ||
                `Restock - ${targetProducto.nombre}`,
              periodo,
              numeroFactura: numeroFactura || undefined,
              tenantId,
            },
          });

          // CompraProducto asociado
          if (tx.compraProducto?.create) {
            compraProducto = await tx.compraProducto.create({
              data: {
                productoId: targetProducto.id,
                proveedorId: targetProducto.vendorId ?? '',
                numeroFactura: numeroFactura || '',
                facturaUrl: facturaUrl || '',
                cantidad,
                precioUnitario: costPrice,
                total: totalCost,
                formaPago: formaPago || 'PAGO_COMPLETO',
                estado: estado || 'PAGADA',
                tipoOperacion: 'RESTOCK',
                descripcion:
                  descripcion ||
                  `Restock - ${targetProducto.nombre}`,
                fechaCompra: now,
                gastoCompraId: gastoCompra.gastoCompraId,
                tenantId,
              },
            });
          }

          // ── Upsert StockUbicacion para la nueva instancia ──
          await upsertStockUbicacion(tx, {
            productoId: targetProducto.id,
            tipoUbicacion: 'almacen',
            ubicacionId: targetProducto.almacenId!,
            modo: 'set',
            valor: targetProducto.stock,
          });

          // ── Flujo de pagos para nueva instancia ──
          const targetProductoFinal =
            targetProducto;

          await handlePaymentInTransaction(
            tx,
            {
              formaPagoFinal:
                (formaPago || 'PAGO_COMPLETO').toUpperCase(),
              cuentaIdParam,
              totalCost,
              monedaOriginal,
              montoOriginal,
              tasaCambio,
              montoConvertido,
              periodo,
              productoNombre: targetProductoFinal.nombre,
  // @ts-expect-error
              userId: (user as Record<string, unknown>)
                .userId as string,
              gastoCompraId: gastoCompra.gastoCompraId,
              vendorId: targetProductoFinal.vendorId!,
              vendorNombre:
                targetProductoFinal.vendor?.nombre ||
                'Proveedor no especificado',
              numeroFactura,
              now,
              compraProductoId:
                compraProducto?.compraProductoId,
              tenantId,
            },
          );
        } else {
          // ── 3b. Actualizar stock del producto original ──
          const updateData: Record<string, unknown> = {
            stock: workflowResult.originalProductUpdate.newStock,
          };
          if (precioCosto !== undefined) {
            updateData.precioCosto =
              workflowResult.originalProductUpdate.newPrecioCosto;
          }
          if (precioVenta !== undefined) {
            updateData.precioVenta =
              workflowResult.originalProductUpdate.newPrecioVenta;
          }

          updatedProducto = await tx.producto.update({
            where: { id: productoId },
            data: updateData,
            include: {
              categoria: true,
              unidad: true,
              vendor: true,
              almacen: true,
            },
          });

          // Upsert StockUbicacion
          await upsertStockUbicacion(tx, {
            productoId,
            tipoUbicacion: 'almacen',
            ubicacionId: producto.almacenId!,
            modo: 'set',
            valor:
              workflowResult.originalProductUpdate.newStock,
          });

          const costPrice =
            precioCosto ?? producto.precioCosto;
          const totalCost = cantidad * costPrice;

          // GastoCompra
          gastoCompra = await tx.gastoCompra.create({
            data: {
              productoId: producto.id,
              vendorId: producto.vendorId!,
              cantidad,
              precioUnitario: costPrice,
              total: totalCost,
              fechaCompra: now,
              descripcion:
                descripcion ||
                `Restock - ${producto.nombre}`,
              periodo,
              numeroFactura: numeroFactura || undefined,
              tenantId,
            },
          });

          // CompraProducto
          if (tx.compraProducto?.create) {
            compraProducto = await tx.compraProducto.create({
              data: {
                productoId: producto.id,
                proveedorId: producto.vendorId ?? '',
                numeroFactura: numeroFactura || '',
                facturaUrl: facturaUrl || '',
                cantidad,
                precioUnitario: costPrice,
                total: totalCost,
                formaPago: formaPago || 'PAGO_COMPLETO',
                estado: estado || 'PAGADA',
                tipoOperacion: 'RESTOCK',
                descripcion:
                  descripcion ||
                  `Restock - ${producto.nombre}`,
                fechaCompra: now,
                gastoCompraId: gastoCompra.gastoCompraId,
                tenantId,
              },
            });
          }

          // ── Flujo de pagos ──
          await handlePaymentInTransaction(
            tx,
            {
              formaPagoFinal:
                (formaPago || 'PAGO_COMPLETO').toUpperCase(),
              cuentaIdParam,
              totalCost,
              monedaOriginal,
              montoOriginal,
              tasaCambio,
              montoConvertido,
              periodo,
              productoNombre: producto.nombre,
  // @ts-expect-error
              userId: (user as Record<string, unknown>)
                .userId as string,
              gastoCompraId: gastoCompra.gastoCompraId,
              vendorId: producto.vendorId!,
              vendorNombre:
                producto.vendor?.nombre ||
                'Proveedor no especificado',
              numeroFactura,
              now,
              compraProductoId:
                compraProducto?.compraProductoId,
              tenantId,
            },
          );
        }

        return {
  // @ts-expect-error
          producto: updatedProducto ?? newProductInstance!,
          gastoCompra,
          newProductInstance,
          compraProducto,
          workflowResult,
        };
      },
      {
        maxWait: 5000,
        timeout: 10000,
      },
    );

    revalidatePath('/busy/products');

    return {
      producto: result.producto,
      gastoCompra: result.gastoCompra,
      productInstance: result.newProductInstance,
      weightedAverages: {
        precioCosto:
          result.workflowResult.weightedAverages.costPrice
            .weightedAverage,
        precioVenta:
          result.workflowResult.weightedAverages.sellingPrice
            .weightedAverage,
      },
      restockDetails: {
        cantidadAnterior: producto.stock,
        cantidadNueva: result.producto.stock,
        cantidadAgregada: cantidad,
        costoTotal: result.gastoCompra.total,
        reason: result.workflowResult.reason,
      },
    };
  },
));

// ─── Helpers para restock (no exportados) ──────────────────

/**
 * Parámetros para el flujo de pagos dentro de la transacción de restock.
 */
interface PaymentParams {
  formaPagoFinal: string;
  cuentaIdParam?: string;
  totalCost: number;
  monedaOriginal?: string;
  montoOriginal?: number;
  tasaCambio?: number;
  montoConvertido?: number;
  periodo: string;
  productoNombre: string;
  userId: string;
  gastoCompraId: string;
  vendorId: string;
  vendorNombre: string;
  numeroFactura?: string;
  now: Date;
  compraProductoId?: string;
  tenantId: string;
}

/**
 * @description Maneja el flujo de pagos (PAGO_COMPLETO o PAGO_PARCIAL)
 *   dentro de una transacción Prisma.
 *
 * - PAGO_COMPLETO: crea ReconciliacionGasto, decrementa saldo bancario.
 * - PAGO_PARCIAL: crea CuentaPorPagar.
 */
async function handlePaymentInTransaction(
  tx: any,
  params: PaymentParams,
): Promise<void> {
  const {
    formaPagoFinal,
    cuentaIdParam,
    totalCost,
    monedaOriginal,
    montoOriginal,
    tasaCambio,
    montoConvertido,
    periodo,
    productoNombre,
    userId,
    gastoCompraId,
    vendorId,
    vendorNombre,
    numeroFactura,
    now,
    compraProductoId,
    tenantId,
  } = params;

  const canRun =
    !!tx.tipoPago?.findFirst &&
    !!tx.cuentaBancaria?.findUnique &&
    !!tx.reconciliacionGasto?.create &&
    !!tx.cuentaBancaria?.update &&
    !!tx.cuentaPorPagar?.create;

  if (formaPagoFinal === 'PAGO_COMPLETO' && canRun) {
    let cuentaId = cuentaIdParam;

    // Resolver cuenta por defecto si no se especificó
    if (!cuentaId) {
      const tipoPago = await tx.tipoPago.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { tipoId: true, cuentaDefecto: true },
      });

      if (tipoPago) {
        cuentaId = tipoPago.cuentaDefecto;
        if (!cuentaId) {
          const fallback = await tx.cuentaBancaria.findFirst({
            where: { isActive: true, tenantId },
            orderBy: { createdAt: 'asc' },
            select: { cuentaId: true },
          });
          cuentaId = fallback?.cuentaId;
        }
      }
    }

    if (!cuentaId) {
      throw new ActionError(
        'No hay cuentas bancarias activas disponibles',
        'PAYMENT_ACCOUNT_MISSING',
      );
    }

    const cuentaBancaria =
      await tx.cuentaBancaria.findUnique({
        where: { cuentaId },
        select: { cuentaId: true, isActive: true },
      });

    if (!cuentaBancaria || !cuentaBancaria.isActive) {
      throw new ActionError(
        'La cuenta bancaria seleccionada no está activa',
        'INACTIVE_ACCOUNT',
      );
    }

    const tipoPagoData = await tx.tipoPago.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { tipoId: true },
    });

    const isForeignCurrency =
      monedaOriginal && monedaOriginal !== 'CUP';

    const reconciliacionMonto = isForeignCurrency
      ? montoOriginal!
      : totalCost;
    const reconciliacionMoneda = isForeignCurrency
      ? monedaOriginal!
      : 'CUP';
    const reconciliacionTasaCambio = isForeignCurrency
      ? tasaCambio ?? null
      : null;
    const reconciliacionMontoConvertido = isForeignCurrency
      ? montoConvertido ?? null
      : null;

    await tx.reconciliacionGasto.create({
      data: {
        tipoGasto: 'compra',
        referenciaId: gastoCompraId,
        cuentaId,
        tipoPagoId: tipoPagoData?.tipoId ?? '',
        gastoCompraId,
        monto: reconciliacionMonto,
        moneda: reconciliacionMoneda,
        tasaCambio: reconciliacionTasaCambio,
        montoConvertido: reconciliacionMontoConvertido,
        descripcion: `Restock pagado - ${productoNombre}`,
        periodo,
        estado: 'PAGADA',
        reconciliadoPor: userId || 'system',
        tenantId,
      },
    });

    const saldoADescontar = isForeignCurrency
      ? (montoConvertido ?? totalCost)
      : totalCost;

    await tx.cuentaBancaria.update({
      where: { cuentaId },
      data: { saldo: { decrement: saldoADescontar } },
    });
  } else if (formaPagoFinal === 'PAGO_PARCIAL' && canRun) {
    const isForeignCurrency =
      monedaOriginal && monedaOriginal !== 'CUP';

    const deudaMonto = isForeignCurrency
      ? montoOriginal!
      : totalCost;
    const deudaMoneda = isForeignCurrency
      ? monedaOriginal!
      : 'CUP';

    const cuentaPorPagar = await tx.cuentaPorPagar.create({
      data: {
        numeroFactura:
          numeroFactura || `RESTOCK-${now.getTime()}`,
        tipo: 'compra',
        gastoCompraId,
        proveedorId: vendorId,
        proveedorNombre: vendorNombre,
        montoDeuda: deudaMonto,
        montoPagado: 0,
        saldoPendiente: deudaMonto,
        moneda: deudaMoneda,
        fechaEmision: now,
        estado: 'PENDIENTE',
        tenantId,
      },
    });

    // Vincular CompraProducto con CuentaPorPagar
    if (compraProductoId && tx.compraProducto?.update) {
      await tx.compraProducto.update({
        where: { compraProductoId },
        data: {
          cuentaPorPagarId:
            cuentaPorPagar.cuentaPorPagarId,
        },
      });
    }
  }
}
