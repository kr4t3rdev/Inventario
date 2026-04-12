import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

interface CategoriaHierarchy {
  catId: string;
  nombre: string;
  descripcion?: string;
  level: number;
  path: string[];
  subcategorias: CategoriaHierarchy[];
  productCount: number;
}

export async function GET() {
  try {
    // Get all categories with their relationships
    const categorias = await prisma.categoria.findMany({
      select: {
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
              select: {
                catId: true,
                nombre: true,
                descripcion: true,
                parentId: true
              }
            }
          }
        },
        parent: {
          select: {
            catId: true,
            nombre: true
          }
        }
      }
    });

    // Filter only root categories (no parent)
    const rootCategories = categorias.filter((cat: any) => !cat.parentId);

    // Build hierarchy structure
    const hierarchy: CategoriaHierarchy[] = rootCategories.map((category: any) =>
      buildCategoryHierarchy(category, categorias, 0, [])
    );

    return NextResponse.json(hierarchy);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[GET /api/categorias/hierarchy]", message, error)
    return NextResponse.json(
      { error: "Error al obtener jerarquía de categorías", detail: message },
      { status: 500 }
    )
  }
}

function buildCategoryHierarchy(
  category: any,
  allCategories: Array<any>,
  level: number,
  path: string[]
): CategoriaHierarchy {
  const currentPath = [...path, category.catId];

  // Get direct subcategories
  const subcategorias = allCategories
    .filter((cat: any) => cat.parentId === category.catId)
    .map((subcat: any) => buildCategoryHierarchy(subcat, allCategories, level + 1, currentPath));

  // Calculate total product count (including subcategories)
  const directProductCount = category.productos?.length || 0;
  const subcategoryProductCount = subcategorias.reduce((sum: number, sub: CategoriaHierarchy) => sum + sub.productCount, 0);
  const totalProductCount = directProductCount + subcategoryProductCount;

  return {
    catId: category.catId,
    nombre: category.nombre,
    descripcion: category.descripcion,
    level,
    path: currentPath,
    subcategorias,
    productCount: totalProductCount
  };
}