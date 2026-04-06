import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Verify authentication
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const categoryId = id;

    if (!categoryId) {
      return NextResponse.json(
        { error: 'ID de categoría no proporcionado' },
        { status: 400 }
      );
    }

    // Check if category exists
    const category = await prisma.categoria.findUnique({
      where: { catId: categoryId },
      include: {
        _count: {
          select: {
            productos: true,
            subcategorias: true,
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { 
          canDelete: false,
          error: 'Categoría no encontrada',
        },
        { status: 404 }
      );
    }

    // Check for products in this category
    if (category._count.productos > 0) {
      return NextResponse.json({
        canDelete: false,
        reason: `No se puede eliminar la categoría porque tiene ${category._count.productos} producto(s) asignado(s).`,
        productCount: category._count.productos,
        hasProducts: true,
      });
    }

    // Check for subcategories
    if (category._count.subcategorias > 0) {
      // First get all subcategory IDs, then count products
      const subcategories = await prisma.categoria.findMany({
        where: { parentId: categoryId },
        select: { catId: true },
      });
      
      const subcategoryIds = subcategories.map((sub: { catId: string }) => sub.catId);
      const totalSubcategoryProducts = subcategoryIds.length > 0 
        ? await prisma.producto.count({
            where: { categoriaId: { in: subcategoryIds } }
          })
        : 0;

      if (totalSubcategoryProducts > 0) {
        return NextResponse.json({
          canDelete: false,
          reason: `No se puede eliminar la categoría porque tiene ${totalSubcategoryProducts} producto(s) en sus subcategorías.`,
          productCount: totalSubcategoryProducts,
          hasProductsInSubcategories: true,
        });
      }

      return NextResponse.json({
        canDelete: false,
        reason: `No se puede eliminar la categoría porque tiene ${category._count.subcategorias} subcategoría(s).`,
        subcategoryCount: category._count.subcategorias,
        hasSubcategories: true,
      });
    }

    // If we get here, the category can be deleted
    return NextResponse.json({
      canDelete: true,
    });

  } catch (error) {
    console.error('Error checking if category can be deleted:', error);
    return NextResponse.json(
      { 
        error: 'Error al verificar si la categoría puede ser eliminada',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      },
      { status: 500 }
    );
  }
}
