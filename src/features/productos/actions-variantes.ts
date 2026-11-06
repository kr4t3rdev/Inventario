'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ActionError, withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { requireFeature, requirePermission, requireTenant, validateTenantLimit } from '@/lib/services/tenant-scope';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { getStockTotalProductosBatch } from '@/lib/services/stock-ubicacion-queries';
import { buildVariantCombinations } from './services/variantes';

const attributeSchema = z.object({
  nombre: z.string().trim().min(1).max(40),
  valores: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
});

const createTemplateSchema = z.object({
  nombrePlantilla: z.string().trim().min(1).max(200),
  nombreProducto: z.string().trim().min(1).max(200),
  descripcion: z.string().trim().max(500).optional().nullable(),
  skuPrefijo: z.string().trim().min(1).max(60),
  atributos: z.array(attributeSchema).min(1).max(5),
  precioCosto: z.coerce.number().int().min(0),
  precioVenta: z.coerce.number().int().min(0),
  stockInicial: z.coerce.number().int().min(0).default(0),
  stockMinimo: z.coerce.number().int().min(0).default(0),
  categoriaId: z.string().min(1),
  subcategoriaId: z.string().optional().nullable(),
  unidadId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  almacenId: z.string().min(1),
  puntoDeVentaId: z.string().optional().nullable(),
  precios: z.array(z.object({
    listaPrecioId: z.string().min(1),
    precio: z.number().int().min(0),
  })).max(100).default([]),
});

const updateVariantSchema = z.object({
  productoId: z.string().min(1),
  sku: z.string().trim().min(1).max(100),
  precioCosto: z.coerce.number().int().min(0),
  precioVenta: z.coerce.number().int().min(0),
});

/**
 * @description Lista plantillas y sus variantes con precios y stock calculado del tenant.
 * @param {void} _input - La consulta no requiere parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<Array<object>>} Plantillas con productos asociados.
 */
export const getPlantillasVariantesAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);
    requireFeature(user, 'variantes', 'gestión de variantes de producto');

    const plantillas = await prisma.productoPlantilla.findMany({
      where: { tenantId },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      include: {
        productos: {
          where: { tenantId, esVariante: true },
          orderBy: [{ sku: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            nombre: true,
            sku: true,
            atributoJson: true,
            precioCosto: true,
            precioVenta: true,
            stock: true,
            stockMinimo: true,
            almacenId: true,
            precios: { select: { listaPrecioId: true, precio: true } },
          },
        },
      },
    });

    const productoIds = plantillas.flatMap((plantilla) =>
      plantilla.productos.map((producto) => producto.id),
    );
    const stockPorProducto = await getStockTotalProductosBatch(prisma, { productoIds });

    return plantillas.map((plantilla) => ({
      ...plantilla,
      productos: plantilla.productos.map((producto) => ({
        ...producto,
        stockTotal: stockPorProducto.get(producto.id) ?? 0,
      })),
    }));
  },
);

/**
 * @description Crea una plantilla no vendible y genera sus productos variantes en una transacción.
 * @param {z.infer<typeof createTemplateSchema>} input - Datos comunes y matriz de atributos.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Plantilla creada y variantes generadas.
 */
export const createPlantillaVariantesAction = withAction(
  async (input: z.infer<typeof createTemplateSchema>, user: AuthenticatedUser) => {
    const parsed = createTemplateSchema.parse(input);
    const tenantId = requireTenant(user);
    requirePermission(user, 'inventario.productos.crear', 'crear variantes de productos');
    requireFeature(user, 'variantes', 'gestión de variantes de producto');
    requireFeature(user, 'productos', 'gestión de productos');

    const variants = buildVariantCombinations(parsed.atributos, parsed.skuPrefijo);
    const [categoria, almacen, subcategoria, unidad, vendor, puntoDeVenta] = await Promise.all([
      prisma.categoria.findFirst({
        where: { tenantId, catId: parsed.categoriaId },
        select: { catId: true },
      }),
      prisma.almacen.findFirst({
        where: { tenantId, almacenId: parsed.almacenId },
        select: { almacenId: true },
      }),
      parsed.subcategoriaId
        ? prisma.categoria.findFirst({
            where: { tenantId, catId: parsed.subcategoriaId },
            select: { catId: true, parentId: true },
          })
        : null,
      parsed.unidadId
        ? prisma.unidad.findFirst({
            where: { tenantId, unidadId: parsed.unidadId },
            select: { unidadId: true },
          })
        : null,
      parsed.vendorId
        ? prisma.vendor.findFirst({
            where: { tenantId, vendorId: parsed.vendorId },
            select: { vendorId: true },
          })
        : null,
      parsed.puntoDeVentaId
        ? prisma.puntoDeVenta.findFirst({
            where: { tenantId, pvId: parsed.puntoDeVentaId },
            select: { pvId: true },
          })
        : null,
    ]);

    if (!categoria || !almacen) {
      throw new ActionError('La categoría o el almacén no pertenecen a la empresa activa', 'NOT_FOUND');
    }
    if (parsed.subcategoriaId && subcategoria?.parentId !== parsed.categoriaId) {
      throw new ActionError('La subcategoría no pertenece a la categoría seleccionada', 'VALIDATION_ERROR');
    }
    if (parsed.unidadId && !unidad) {
      throw new ActionError('La unidad no pertenece a la empresa activa', 'NOT_FOUND');
    }
    if (parsed.vendorId && !vendor) {
      throw new ActionError('El proveedor no pertenece a la empresa activa', 'NOT_FOUND');
    }
    if (parsed.puntoDeVentaId && !puntoDeVenta) {
      throw new ActionError('El punto de venta no pertenece a la empresa activa', 'NOT_FOUND');
    }

    const listIds = [...new Set(parsed.precios.map((price) => price.listaPrecioId))];
    if (listIds.length !== parsed.precios.length) {
      throw new ActionError('No repitas listas de precios', 'VALIDATION_ERROR');
    }
    if (listIds.length) {
      requireFeature(user, 'listas-precios', 'precios por lista para variantes');
      const validListCount = await prisma.listaPrecio.count({
        where: { tenantId, id: { in: listIds } },
      });
      if (validListCount !== listIds.length) {
        throw new ActionError('Una o más listas de precios no pertenecen a la empresa activa', 'INVALID_PRICE_LIST');
      }
    }

    const existingSkuCount = await prisma.producto.count({
      where: { tenantId, sku: { in: variants.map((variant) => variant.sku) } },
    });
    if (existingSkuCount > 0) {
      throw new ActionError('Uno o más SKU ya están registrados en la empresa', 'DUPLICATE_SKU');
    }

    const existingProductCount = await prisma.producto.count({ where: { tenantId } });
    try {
      await validateTenantLimit(
        tenantId,
        'maxProductos',
        existingProductCount + variants.length - 1,
      );
    } catch (error) {
      throw new ActionError(
        error instanceof Error ? error.message : 'No hay cupo para crear las variantes',
        'PLAN_LIMIT_EXCEEDED',
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const plantilla = await tx.productoPlantilla.create({
        data: {
          tenantId,
          nombre: parsed.nombrePlantilla,
          atributos: parsed.atributos,
        },
      });

      const productos = [];
      for (const variant of variants) {
        const label = Object.values(variant.atributos).join(' / ');
        const producto = await tx.producto.create({
          data: {
            nombre: `${parsed.nombreProducto} (${label})`,
            descripcion: parsed.descripcion ?? null,
            precioCosto: parsed.precioCosto,
            precioVenta: parsed.precioVenta,
            stock: parsed.stockInicial,
            stockMinimo: parsed.stockMinimo,
            categoriaId: parsed.categoriaId,
            subcategoriaId: parsed.subcategoriaId ?? null,
            unidadId: parsed.unidadId ?? null,
            vendorId: parsed.vendorId ?? null,
            almacenId: parsed.almacenId,
            puntoDeVentaId: parsed.puntoDeVentaId ?? null,
            tenantId,
            plantillaId: plantilla.id,
            atributoJson: variant.atributos,
            sku: variant.sku,
            esVariante: true,
            ...(parsed.precios.length > 0
              ? {
                  precios: {
                    create: parsed.precios.map((price) => ({
                      listaPrecioId: price.listaPrecioId,
                      precio: price.precio,
                    })),
                  },
                }
              : {}),
          },
          select: {
            id: true,
            nombre: true,
            sku: true,
            atributoJson: true,
            precioCosto: true,
            precioVenta: true,
            stock: true,
            almacenId: true,
          },
        });

        if (parsed.stockInicial > 0) {
          await upsertStockUbicacion(tx, {
            tenantId,
            productoId: producto.id,
            tipoUbicacion: 'almacen',
            ubicacionId: parsed.almacenId,
            modo: 'set',
            valor: parsed.stockInicial,
          });
        }
        productos.push(producto);
      }

      return { ...plantilla, productos };
    });

    revalidatePath('/busy/inventario/variantes');
    revalidatePath('/busy/products');
    return result;
  },
);

/**
 * @description Actualiza SKU y precios base de una variante del tenant.
 * @param {z.infer<typeof updateVariantSchema>} input - Valores propios de la variante.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Variante actualizada.
 */
export const updateVarianteCatalogoAction = withAction(
  async (input: z.infer<typeof updateVariantSchema>, user: AuthenticatedUser) => {
    const parsed = updateVariantSchema.parse(input);
    const tenantId = requireTenant(user);
    requirePermission(user, 'inventario.productos.editar', 'editar variantes de productos');
    requireFeature(user, 'variantes', 'gestión de variantes de producto');

    const variant = await prisma.producto.findFirst({
      where: { id: parsed.productoId, tenantId, esVariante: true },
      select: { id: true },
    });
    if (!variant) throw new ActionError('Variante no encontrada', 'NOT_FOUND');

    const skuInUse = await prisma.producto.findFirst({
      where: { tenantId, sku: parsed.sku, id: { not: variant.id } },
      select: { id: true },
    });
    if (skuInUse) throw new ActionError('El SKU ya está registrado en la empresa', 'DUPLICATE_SKU');

    const updated = await prisma.producto.update({
      where: { id: variant.id },
      data: {
        sku: parsed.sku,
        precioCosto: parsed.precioCosto,
        precioVenta: parsed.precioVenta,
      },
      select: {
        id: true,
        nombre: true,
        sku: true,
        precioCosto: true,
        precioVenta: true,
        stock: true,
      },
    });
    revalidatePath('/busy/inventario/variantes');
    revalidatePath('/busy/products');
    return updated;
  },
);
