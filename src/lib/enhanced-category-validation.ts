import { Categoria, Producto } from "../generated/prisma";
import prisma from "./prisma";

/**
 * Enhanced validation utilities for category operations
 * Provides comprehensive business rule validation
 */

export interface CategoryWithRelations extends Categoria {
  subcategorias: Categoria[];
  productos: Producto[];
  _count?: {
    subcategorias: number;
    productos: number;
  };
}

/**
 * Check if a category name is unique within its parent scope
 * @param name Category name to check
 * @param parentId Parent category ID (null for root categories)
 * @param excludeCategoryId Category ID to exclude (for updates)
 * @returns Promise<boolean> True if the name is unique
 */
export async function isCategoryNameUnique(
  name: string,
  parentId: string | null = null,
  excludeCategoryId?: string
): Promise<boolean> {
  const existingCategory = await prisma.categoria.findFirst({
    where: {
      nombre: name,
      parentId: parentId,
      NOT: excludeCategoryId ? { catId: excludeCategoryId } : undefined,
    },
  });

  return !existingCategory;
}

/**
 * Get the depth of a category in the hierarchy
 * @param categoryId ID of the category
 * @param currentDepth Current depth (used for recursion)
 * @returns Promise<number> The depth of the category (0 for root categories)
 */
export async function getCategoryDepth(
  categoryId: string,
  currentDepth: number = 0
): Promise<number> {
  const category = await prisma.categoria.findUnique({
    where: { catId: categoryId },
    select: { parentId: true },
  });

  if (!category || !category.parentId) {
    return currentDepth;
  }

  return getCategoryDepth(category.parentId, currentDepth + 1);
}

/**
 * Check if a category can be assigned as a parent
 * @param categoryId ID of the category being modified
 * @param newParentId ID of the potential new parent category
 * @returns Promise<{ isValid: boolean; reason?: string }> Validation result
 */
export async function validateParentAssignment(
  categoryId: string,
  newParentId: string | null
): Promise<{ isValid: boolean; reason?: string }> {
  // If no parent is being assigned, it's always valid
  if (!newParentId) {
    return { isValid: true };
  }

  // A category can't be its own parent
  if (categoryId === newParentId) {
    return {
      isValid: false,
      reason: "Una categoría no puede ser su propia categoría padre.",
    };
  }

  // Check for circular references
  const isCircular = await hasCircularReference(categoryId, newParentId);
  if (isCircular) {
    return {
      isValid: false,
      reason:
        "No se puede asignar una categoría como padre de una de sus propias subcategorías.",
    };
  }

  // Check maximum depth (3 levels total)
  const parentDepth = await getCategoryDepth(newParentId);
  if (parentDepth >= 2) {
    // 2 because we're adding one more level
    return {
      isValid: false,
      reason: "No se pueden crear más de 3 niveles de categorías.",
    };
  }

  return { isValid: true };
}

/**
 * Check if assigning a parent would create a circular reference
 * @param categoryId ID of the category being modified
 * @param potentialParentId ID of the potential parent category
 * @param checkedIds Set of already checked category IDs (for recursion)
 * @returns Promise<boolean> True if a circular reference would be created
 */
async function hasCircularReference(
  categoryId: string,
  potentialParentId: string,
  checkedIds: Set<string> = new Set()
): Promise<boolean> {
  // Prevent infinite recursion
  if (checkedIds.has(potentialParentId)) {
    return false;
  }
  checkedIds.add(potentialParentId);

  // If the potential parent is the category itself, it's a circular reference
  if (potentialParentId === categoryId) {
    return true;
  }

  // Get the potential parent's parent
  const parent = await prisma.categoria.findUnique({
    where: { catId: potentialParentId },
    select: { parentId: true },
  });

  // If the potential parent has no parent, no circular reference
  if (!parent || !parent.parentId) {
    return false;
  }

  // Check recursively
  return hasCircularReference(categoryId, parent.parentId, checkedIds);
}

/**
 * Validate if a category can be deleted
 * @param categoryId ID of the category to delete
 * @returns Promise<{ canDelete: boolean; reason?: string; productCount: number; subcategoryCount: number }>
 */
export async function validateCategoryDeletion(
  categoryId: string
): Promise<{
  canDelete: boolean;
  reason?: string;
  productCount: number;
  subcategoryCount: number;
}> {
  const [productCount, subcategoryCount] = await Promise.all([
    prisma.producto.count({ where: { categoriaId: categoryId } }),
    prisma.categoria.count({ where: { parentId: categoryId } }),
  ]);

  if (productCount > 0) {
    return {
      canDelete: false,
      reason: `No se puede eliminar una categoría que contiene ${productCount} producto(s).`,
      productCount,
      subcategoryCount,
    };
  }

  if (subcategoryCount > 0) {
    return {
      canDelete: false,
      reason: `No se puede eliminar una categoría que tiene ${subcategoryCount} subcategoría(s).`,
      productCount,
      subcategoryCount,
    };
  }

  return { canDelete: true, productCount, subcategoryCount };
}

/**
 * Get all descendant category IDs (recursively)
 * @param categoryId ID of the parent category
 * @returns Promise<string[]> Array of descendant category IDs
 */
export async function getAllDescendantIds(categoryId: string): Promise<string[]> {
  const subcategories = await prisma.categoria.findMany({
    where: { parentId: categoryId },
    select: { catId: true },
  });

  const descendantIds: string[] = [];
  
  for (const subcategory of subcategories) {
    descendantIds.push(subcategory.catId);
    const subDescendants = await getAllDescendantIds(subcategory.catId);
    descendantIds.push(...subDescendants);
  }

  return descendantIds;
}

/**
 * Get the full category path as an array of category names
 * @param categoryId ID of the category
 * @returns Promise<string[]> Array of category names from root to the category
 */
export async function getCategoryPath(
  categoryId: string
): Promise<{ id: string; nombre: string }[]> {
  const path: { id: string; nombre: string }[] = [];
  let currentId: string | null = categoryId;

  while (currentId) {
    const category:any = await prisma.categoria.findUnique({
      where: { catId: currentId },
      select: { catId: true, nombre: true, parentId: true },
    });

    if (!category) break;

    path.unshift({ id: category.catId, nombre: category.nombre });
    currentId = category.parentId;
  }

  return path;
}
