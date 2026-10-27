'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ActionError, withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const factorSchema = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,8})?$/, 'Factor inválido')
  .refine((value) => Number(value) > 0, 'El factor debe ser mayor que cero');
const conversionInputSchema = z.object({
  productoId: z.string().min(1),
  unidadId: z.string().min(1),
  factorAStock: factorSchema,
});
const updateInputSchema = conversionInputSchema.extend({ id: z.string().min(1) });

/** Lock the product row before reading its current base unit and conversion data. */
async function lockProduct(tx: any, tenantId: string, productId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Producto" WHERE "id" = ${productId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  const product = await tx.producto.findFirst({
    where: { id: productId, tenantId },
    select: { id: true, tenantId: true, unidadId: true },
  });
  if (!product) throw new ActionError('Producto no encontrado', 'NOT_FOUND');
  if (!product.unidadId) throw new ActionError('El producto no tiene unidad base configurada', 'VALIDATION_ERROR');
  return product;
}

/** Check tenant ownership and dimension compatibility for a source/base pair. */
async function validateUnits(tx: any, tenantId: string, productId: string, sourceUnitId: string, baseUnitId: string) {
  if (sourceUnitId === baseUnitId) throw new ActionError('La unidad base no requiere conversión', 'VALIDATION_ERROR');
  const units = await tx.unidad.findMany({
    where: { tenantId, unidadId: { in: [sourceUnitId, baseUnitId] } },
    select: { unidadId: true, tenantId: true, dimension: true },
  });
  const source = units.find((unit: any) => unit.unidadId === sourceUnitId);
  const base = units.find((unit: any) => unit.unidadId === baseUnitId);
  if (!source || !base) throw new ActionError('Una o más unidades no pertenecen a la empresa activa', 'VALIDATION_ERROR');
  if (!source.dimension || source.dimension === 'UNKNOWN' || source.dimension !== base.dimension) {
    throw new ActionError('Las unidades deben tener la misma dimensión configurada', 'VALIDATION_ERROR');
  }
  return { source, base, productId };
}

/** @description Lista conversiones y unidades compatibles del producto autenticado. */
export const getProductUnitConversionsAction = withAction(async (productId: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  requireFeature(user, 'unidades', 'conversiones de unidades');
  const product = await prisma.producto.findFirst({
    where: { id: productId, tenantId },
    select: { id: true, tenantId: true, unidadId: true, unidad: { select: { unidadId: true, tenantId: true, nombre: true, simbolo: true, dimension: true } } },
  });
  if (!product) throw new ActionError('Producto no encontrado', 'NOT_FOUND');
  if (!product.unidadId || !product.unidad || product.unidad.tenantId !== tenantId) {
    throw new ActionError('El producto no tiene una unidad base válida para la empresa activa', 'VALIDATION_ERROR');
  }
  const [conversions, units] = await Promise.all([
    prisma.unidadConversion.findMany({
      where: { tenantId, productoId: product.id, baseUnidadId: product.unidadId },
      include: { unidad: { select: { unidadId: true, nombre: true, simbolo: true, dimension: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    product.unidad.dimension === 'UNKNOWN' ? Promise.resolve([]) : prisma.unidad.findMany({
      where: { tenantId, dimension: product.unidad.dimension, NOT: { unidadId: product.unidadId } },
      select: { unidadId: true, nombre: true, simbolo: true, dimension: true },
      orderBy: { nombre: 'asc' },
    }),
  ]);
  return { baseUnit: product.unidad, conversions, units };
});

/** @description Opciones autorizadas de unidad para una línea de compra directa. */
export const getDirectPurchaseUnitsAction = withAction(async (productId: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  requireFeature(user, 'unidades', 'conversiones de unidades');
  const product = await prisma.producto.findFirst({
    where: { id: productId, tenantId },
    select: { id: true, unidadId: true, unidad: { select: { unidadId: true, tenantId: true, nombre: true, simbolo: true } } },
  });
  if (!product?.unidadId || !product.unidad || product.unidad.tenantId !== tenantId) {
    throw new ActionError('Producto sin una unidad base válida para la empresa activa', 'VALIDATION_ERROR');
  }
  const conversions = await prisma.unidadConversion.findMany({
    where: { tenantId, productoId: productId, baseUnidadId: product.unidadId },
    include: { unidad: { select: { unidadId: true, nombre: true, simbolo: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return [product.unidad, ...conversions.map((conversion: any) => conversion.unidad)];
});

/** @description Crea una conversión validada y vinculada al producto/unidad base actuales. */
export const createProductUnitConversionAction = withAction(async (input: z.input<typeof conversionInputSchema>, user: AuthenticatedUser) => {
  const parsed = conversionInputSchema.parse(input);
  const tenantId = requireTenant(user);
  requireFeature(user, 'unidades', 'conversiones de unidades');
  requirePermission(user, 'inventario.productos.editar', 'configurar conversiones de unidades');
  const conversion = await prisma.$transaction(async (tx: any) => {
    const product = await lockProduct(tx, tenantId, parsed.productoId);
    await validateUnits(tx, tenantId, product.id, parsed.unidadId, product.unidadId);
    const existing = await tx.unidadConversion.findFirst({ where: { tenantId, productoId: product.id, unidadId: parsed.unidadId } });
    if (existing) throw new ActionError('Ya existe una conversión para esta unidad', 'DUPLICATE');
    return tx.unidadConversion.create({ data: {
      tenantId, productoId: product.id, baseUnidadId: product.unidadId,
      unidadId: parsed.unidadId, factorAStock: parsed.factorAStock,
    } });
  });
  revalidatePath('/busy/products');
  return conversion;
});

/** @description Actualiza el factor de una conversión existente sin permitir cambiar su tenant/producto. */
export const updateProductUnitConversionAction = withAction(async (input: z.input<typeof updateInputSchema>, user: AuthenticatedUser) => {
  const parsed = updateInputSchema.parse(input);
  const tenantId = requireTenant(user);
  requireFeature(user, 'unidades', 'conversiones de unidades');
  requirePermission(user, 'inventario.productos.editar', 'configurar conversiones de unidades');
  const conversion = await prisma.$transaction(async (tx: any) => {
    const product = await lockProduct(tx, tenantId, parsed.productoId);
    await validateUnits(tx, tenantId, product.id, parsed.unidadId, product.unidadId);
    const result = await tx.unidadConversion.updateMany({
      where: { id: parsed.id, tenantId, productoId: product.id, unidadId: parsed.unidadId, baseUnidadId: product.unidadId },
      data: { factorAStock: parsed.factorAStock },
    });
    if (!result.count) throw new ActionError('Conversión no encontrada para este producto', 'NOT_FOUND');
    return tx.unidadConversion.findFirst({ where: { id: parsed.id, tenantId, productoId: product.id } });
  });
  revalidatePath('/busy/products');
  return conversion;
});

/** @description Elimina una conversión únicamente dentro del producto y tenant autenticados. */
export const deleteProductUnitConversionAction = withAction(async (input: { id: string; productoId: string }, user: AuthenticatedUser) => {
  const parsed = z.object({ id: z.string().min(1), productoId: z.string().min(1) }).parse(input);
  const tenantId = requireTenant(user);
  requireFeature(user, 'unidades', 'conversiones de unidades');
  requirePermission(user, 'inventario.productos.editar', 'configurar conversiones de unidades');
  const deleted = await prisma.$transaction(async (tx: any) => {
    const product = await lockProduct(tx, tenantId, parsed.productoId);
    const result = await tx.unidadConversion.deleteMany({
      where: { id: parsed.id, tenantId, productoId: product.id, baseUnidadId: product.unidadId },
    });
    if (!result.count) throw new ActionError('Conversión no encontrada para este producto', 'NOT_FOUND');
    return { id: parsed.id };
  });
  revalidatePath('/busy/products');
  return deleted;
});
