/**
 * @description Server Actions para el feature de Categorías.
 *
 * Reemplazan las llamadas a API routes + RTK Query por Server Actions
 * que usan Prisma directo en el servidor.
 *
 * Cada acción está envuelta con withAction() que provee:
 * - Autenticación automática (via getCurrentUser)
 * - Manejo estandarizado de errores (Zod, Prisma, ActionError)
 * - Formato consistente { success, data?/error? }
 *
 * @module features/categorias/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { CategoriaValidator } from '@/lib/categoria-validation';
import { CategoriaDeletionValidator } from '@/lib/categoria-errors';
import { categoriaCreateSchema, categoriaUpdateSchema } from './schemas';
import type { CategoriaCreateInput, CategoriaUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Select reutilizable (mismo que API handler) ──────────

const CATEGORIA_SELECT = {
  catId: true,
  nombre: true,
  descripcion: true,
  parentId: true,
  clasSectionId: true,
  clasSpecificId: true,
  createdAt: true,
  updatedAt: true,
  parent: { select: { catId: true, nombre: true } },
  subcategorias: { select: { catId: true, nombre: true, descripcion: true } },
} as const;

const HIERARCHY_SELECT = {
  catId: true,
  nombre: true,
  descripcion: true,
  parentId: true,
  subcategorias: {
    select: {
      catId: true,
      nombre: true,
      descripcion: true,
      parentId: true,
      subcategorias: {
        select: { catId: true, nombre: true, descripcion: true, parentId: true },
      },
    },
  },
  parent: { select: { catId: true, nombre: true } },
} as const;

// ─── Helpers ───────────────────────────────────────────────

interface CategoriaHierarchy {
  catId: string;
  nombre: string;
  descripcion?: string;
  level: number;
  path: string[];
  subcategorias: CategoriaHierarchy[];
  productCount: number;
}

function buildHierarchy(
  category: Record<string, any>,
  allCategories: Record<string, any>[],
  level: number,
  path: string[],
): CategoriaHierarchy {
  const currentPath = [...path, category.catId];
  const subcategorias = allCategories
    .filter((cat) => cat.parentId === category.catId)
    .map((subcat) => buildHierarchy(subcat, allCategories, level + 1, currentPath));
  const directProductCount = category.productos?.length || 0;
  const subProductCount = subcategorias.reduce((sum, sub) => sum + sub.productCount, 0);
  return {
    catId: category.catId,
    nombre: category.nombre,
    descripcion: category.descripcion,
    level,
    path: currentPath,
    subcategorias,
    productCount: directProductCount + subProductCount,
  };
}

// ─── Server Actions ────────────────────────────────────────

/**
 * @description Lista todas las categorías del tenant autenticado.
 */
export const getCategoriasAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  return prisma.categoria.findMany({
    where: { tenantId },
    select: CATEGORIA_SELECT,
  });
});

/**
 * @description Obtiene la jerarquía completa de categorías con conteo de productos.
 */
export const getCategoriaHierarchyAction = withAction(async (_input: void, _user: AuthenticatedUser) => {
  const categorias = await prisma.categoria.findMany({
    select: HIERARCHY_SELECT,
  });
  const rootCategories = categorias.filter((cat) => !cat.parentId);
  return rootCategories.map((category) => buildHierarchy(category as any, categorias as any[], 0, []));
});

/**
 * @description Crea una nueva categoría con validación completa.
 *
 * @throws ActionError si la validación de negocio falla
 */
export const createCategoriaAction = withAction(async (input: CategoriaCreateInput, user: AuthenticatedUser) => {
  // Validación Zod — si falla, withAction atrapa el ZodError
  const parsed = categoriaCreateSchema.parse(input);

  const tenantId = requireTenant(user);

  // Validación de negocio (unicidad, parent, jerarquía, CLAS)
  const validation = await CategoriaValidator.validateCategoryCreation(parsed);
  if (!validation.success) {
    throw new ActionError(validation.errors![0].message, validation.errors![0].code);
  }

  const data = validation.data!;
  const categoria = await prisma.categoria.create({
    data: {
      nombre: data.nombre,
      descripcion: data.descripcion,
      parentId: data.parentId,
      clasSectionId: data.clasSectionId,
      clasSpecificId: data.clasSpecificId,
      tenantId,
    },
    select: CATEGORIA_SELECT,
  });

  revalidatePath('/busy/categoria');
  return categoria;
});

/**
 * @description Actualiza una categoría existente con validación completa.
 *
 * @throws ActionError si la categoría no existe o la validación falla
 */
export const updateCategoriaAction = withAction(async (input: CategoriaUpdateInput, user: AuthenticatedUser) => {
  // Validación Zod
  const parsed = categoriaUpdateSchema.parse(input);
  const { catId, ...updateData } = parsed;

  // Verificar existencia
  const existing = await prisma.categoria.findUnique({
    where: { catId },
    select: { catId: true, tenantId: true },
  });

  if (!existing) {
    throw new ActionError('Categoría no encontrada', 'NOT_FOUND');
  }

  const tenantId = requireTenant(user);

  // Validación de negocio
  const validation = await CategoriaValidator.validateCategoryUpdate(catId, updateData);
  if (!validation.success) {
    throw new ActionError(validation.errors![0].message, validation.errors![0].code);
  }

  const data = validation.data!;
  const categoria = await prisma.categoria.update({
    where: { catId },
    data: {
      nombre: data.nombre,
      descripcion: data.descripcion,
      parentId: data.parentId,
      clasSectionId: data.clasSectionId,
      clasSpecificId: data.clasSpecificId,
    },
    select: CATEGORIA_SELECT,
  });

  revalidatePath('/busy/categoria');
  return categoria;
});

/**
 * @description Elimina una categoría, verificando dependencias.
 *
 * Si la categoría tiene productos como subcategoría, los reasigna a la categoría padre.
 *
 * @throws ActionError si la categoría no existe o tiene dependencias que impiden la eliminación
 */
export const deleteCategoriaAction = withAction(async (catId: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);

  // Verificar existencia
  const categoria = await prisma.categoria.findUnique({
    where: { catId },
    select: { catId: true, parentId: true },
  });

  if (!categoria) {
    throw new ActionError('Categoría no encontrada', 'NOT_FOUND');
  }

  // Validar dependencias (subcategorías, productos)
  const deletionValidation = await CategoriaDeletionValidator.validateDeletion(catId);
  if (!deletionValidation.canDelete) {
    throw new ActionError(
      deletionValidation.errors![0].message,
      deletionValidation.errors![0].code,
    );
  }

  // Reasignar productos de subcategoría a la categoría padre si aplica
  const fullCategoria = await prisma.categoria.findUnique({
    where: { catId },
    select: { productosSubcategoria: { select: { id: true } } },
  });

  if (fullCategoria && fullCategoria.productosSubcategoria.length > 0 && categoria.parentId) {
    await prisma.producto.updateMany({
      where: { subcategoriaId: catId },
      data: { subcategoriaId: null, categoriaId: categoria.parentId },
    });
  }

  await prisma.categoria.delete({ where: { catId } });
  revalidatePath('/busy/categoria');
  return { id: catId, eliminada: true };
});
