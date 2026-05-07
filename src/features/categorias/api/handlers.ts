import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/services/tenant-scope";
import { CategoriaValidator } from "@/lib/categoria-validation";
import { CategoriaApiErrorHandler, CategoriaDeletionValidator } from "@/lib/categoria-errors";
import { isCategoryNameUnique, validateParentAssignment } from "@/lib/enhanced-category-validation";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

interface CategoriaHierarchy {
  catId: string; nombre: string; descripcion?: string;
  level: number; path: string[]; subcategorias: CategoriaHierarchy[]; productCount: number;
}

function buildCategoryHierarchy(category: any, allCategories: any[], level: number, path: string[]): CategoriaHierarchy {
  const currentPath = [...path, category.catId];
  const subcategorias = allCategories
    .filter((cat: any) => cat.parentId === category.catId)
    .map((subcat: any) => buildCategoryHierarchy(subcat, allCategories, level + 1, currentPath));
  const directProductCount = category.productos?.length || 0;
  const subcategoryProductCount = subcategorias.reduce((sum: number, sub: CategoriaHierarchy) => sum + sub.productCount, 0);
  return { catId: category.catId, nombre: category.nombre, descripcion: category.descripcion, level, path: currentPath, subcategorias, productCount: directProductCount + subcategoryProductCount };
}

export async function getCategoriasHandler(_request: NextRequest, _context: unknown, user: AuthenticatedUser) {
  const tenantId = requireTenant(user);
  const categorias = await prisma.categoria.findMany({
    where: { tenantId },
    select: { catId: true, nombre: true, descripcion: true, parentId: true, clasSectionId: true, clasSpecificId: true, createdAt: true, updatedAt: true, parent: { select: { catId: true, nombre: true } }, subcategorias: { select: { catId: true, nombre: true, descripcion: true } } },
  });
  return NextResponse.json(categorias);
}

export async function createCategoriaHandler(req: NextRequest, _context: unknown, user: AuthenticatedUser) {
  const tenantId = requireTenant(user);
  const body = await req.json();
  const validation = await CategoriaValidator.validateCategoryCreation(body);
  if (!validation.success) return CategoriaApiErrorHandler.handleValidationErrors(validation.errors!);
  const validatedData = validation.data!;
  const categoria = await prisma.categoria.create({
    data: { nombre: validatedData.nombre, descripcion: validatedData.descripcion, parentId: validatedData.parentId, clasSectionId: validatedData.clasSectionId, clasSpecificId: validatedData.clasSpecificId, tenantId },
    select: { catId: true, nombre: true, descripcion: true, parentId: true, clasSectionId: true, clasSpecificId: true, createdAt: true, updatedAt: true, parent: { select: { catId: true, nombre: true } }, subcategorias: { select: { catId: true, nombre: true } } },
  });
  return CategoriaApiErrorHandler.createSuccessResponse(categoria, 'Categoría creada exitosamente');
}

export async function getCategoriaByIdHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const categoria = await prisma.categoria.findUnique({
      where: { catId: id },
      select: { catId: true, nombre: true, descripcion: true, parentId: true, clasSectionId: true, clasSpecificId: true, createdAt: true, updatedAt: true, parent: { select: { catId: true, nombre: true } }, subcategorias: { select: { catId: true, nombre: true, descripcion: true } } },
    });
    if (!categoria) return NextResponse.json({ error: "Categoria no encontrada" }, { status: 404 });
    return NextResponse.json(categoria);
  } catch (error) {
    console.error("Error al obtener categoria:", error);
    return NextResponse.json({ error: "Error al obtener categoria" }, { status: 500 });
  }
}

export async function updateCategoriaHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const validation = await CategoriaValidator.validateCategoryUpdate(id, body);
    if (!validation.success) return CategoriaApiErrorHandler.handleValidationErrors(validation.errors!);
    const validatedData = validation.data!;
    const categoria = await prisma.categoria.update({
      where: { catId: id },
      data: { nombre: validatedData.nombre, descripcion: validatedData.descripcion, parentId: validatedData.parentId, clasSectionId: validatedData.clasSectionId, clasSpecificId: validatedData.clasSpecificId },
      select: { catId: true, nombre: true, descripcion: true, parentId: true, clasSectionId: true, clasSpecificId: true, createdAt: true, updatedAt: true, parent: { select: { catId: true, nombre: true } }, subcategorias: { select: { catId: true, nombre: true, descripcion: true } } },
    });
    return CategoriaApiErrorHandler.createSuccessResponse(categoria, 'Categoría actualizada exitosamente');
  } catch (error) {
    console.error('Error updating category:', error);
    return CategoriaApiErrorHandler.handleUnknownError(error, { operation: 'update', categoryId: id });
  }
}

export async function deleteCategoriaHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const deletionValidation = await CategoriaDeletionValidator.validateDeletion(id);
    if (!deletionValidation.canDelete) return CategoriaApiErrorHandler.handleValidationErrors(deletionValidation.errors!);
    const categoria = await prisma.categoria.findUnique({ where: { catId: id }, select: { catId: true, parentId: true, productosSubcategoria: { select: { id: true } } } });
    if (!categoria) return CategoriaApiErrorHandler.handleSingleError({ code: 'CATEGORY_NOT_FOUND', message: 'Categoría no encontrada' });
    let reassignedProducts = 0;
    if (categoria.productosSubcategoria.length > 0 && categoria.parentId) {
      await prisma.producto.updateMany({ where: { subcategoriaId: id }, data: { subcategoriaId: null, categoriaId: categoria.parentId } });
      reassignedProducts = categoria.productosSubcategoria.length;
    }
    await prisma.categoria.delete({ where: { catId: id } });
    return CategoriaApiErrorHandler.createDeletionSuccessResponse(id, reassignedProducts);
  } catch (error) {
    console.error("Error deleting category:", error);
    return CategoriaApiErrorHandler.handleUnknownError(error, { operation: 'delete', categoryId: id });
  }
}

export async function getCategoriasHierarchyHandler() {
  try {
    const categorias = await prisma.categoria.findMany({
      select: { catId: true, nombre: true, descripcion: true, parentId: true, subcategorias: { select: { catId: true, nombre: true, descripcion: true, parentId: true, subcategorias: { select: { catId: true, nombre: true, descripcion: true, parentId: true } } } }, parent: { select: { catId: true, nombre: true } } },
    });
    const rootCategories = categorias.filter((cat: any) => !cat.parentId);
    const hierarchy: CategoriaHierarchy[] = rootCategories.map((category: any) => buildCategoryHierarchy(category, categorias, 0, []));
    return NextResponse.json(hierarchy);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[GET /api/categorias/hierarchy]", message, error);
    return NextResponse.json({ error: "Error al obtener jerarquía de categorías", detail: message }, { status: 500 });
  }
}

export async function validateCategoriaHandler(request: Request) {
  try {
    const { categoryId, name, parentId, clasSectionId, clasSpecificId } = await request.json();
    if (!name) return NextResponse.json({ error: 'El nombre de la categoría es requerido' }, { status: 400 });
    const isNameUnique = await isCategoryNameUnique(name, parentId || null, categoryId);
    if (!isNameUnique) return NextResponse.json({ isValid: false, error: 'Ya existe una categoría con este nombre en el mismo nivel jerárquico', field: 'name' }, { status: 200 });
    if (parentId) {
      const parentValidation = await validateParentAssignment(categoryId || 'new', parentId);
      if (!parentValidation.isValid) return NextResponse.json({ isValid: false, error: parentValidation.reason, field: 'parentId' }, { status: 200 });
    }
    return NextResponse.json({ isValid: true }, { status: 200 });
  } catch (error) {
    console.error('Error validating category:', error);
    return NextResponse.json({ error: 'Ocurrió un error al validar la categoría', details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined }, { status: 500 });
  }
}
