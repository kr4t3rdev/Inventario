import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/lib/auth-middleware"

type ProductoRouteContext = { params: Promise<{ id: string }> }

export const GET = withAuth(async (request: NextRequest, context: ProductoRouteContext, _user: any) => {
  try {

    const { id } = await context.params
    const producto = await prisma.producto.findUnique({
      where: { id: id },
      include: {
        categoria: true,
        subcategoria: true,
        unidad: true,
        vendor: true,
        almacen: true
      },
    })

    if (!producto) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    return NextResponse.json(producto)
  } catch (error) {
    console.error("Error al obtener producto:", error)
    return NextResponse.json({ error: "Error al obtener producto" }, { status: 500 })
  }
})

export const PATCH = withAuth(async (request: NextRequest, context: ProductoRouteContext, _user: any) => {
  try {
    const { id } = await context.params;
    const body = await request.json()
    const { nombre, descripcion, precioCosto, precioVenta, stock, stockMinimo, fotos, categoriaId, subcategoriaId, unidadId, vendorId, almacenId } = body

    // Validate stockMinimo if provided
    if (stockMinimo !== undefined && (typeof stockMinimo !== 'number' || stockMinimo < 0 || !Number.isInteger(stockMinimo))) {
      return NextResponse.json({
        error: 'El stock mínimo debe ser un número entero mayor o igual a 0'
      }, {
        status: 400
      })
    }

    // Validate subcategory belongs to category if both are provided
    if (subcategoriaId && categoriaId) {
      const subcategoria = await prisma.categoria.findUnique({
        where: { catId: subcategoriaId },
        select: { parentId: true }
      })
      
      if (!subcategoria || subcategoria.parentId !== categoriaId) {
        return NextResponse.json({
          error: 'La subcategoría debe pertenecer a la categoría seleccionada'
        }, {
          status: 400
        })
      }
    }

    const producto = await prisma.producto.update({
      where: { id: id },
      data: {
        nombre,
        descripcion,
        precioCosto,
        precioVenta,
        stock,
        ...(stockMinimo !== undefined && { stockMinimo }),
        ...(fotos !== undefined && { fotos }),
        categoriaId,
        subcategoriaId: subcategoriaId || null,
        unidadId,
        vendorId,
        almacenId,
      },
      include: {
        categoria: true,
        subcategoria: true,
        unidad: true,
        vendor: true,
        almacen: true,
      },
    })

    return NextResponse.json(producto)
  } catch (error) {
    console.error("Error al actualizar producto:", error)
    return NextResponse.json({ error: "Error al actualizar producto" }, { status: 500 })
  }
})

export const DELETE = withAuth(async (request: NextRequest, context: ProductoRouteContext, _user: any) => {
  try {
    const { id } = await context.params;
    await prisma.producto.delete({
      where: { id: id },
    })

    return NextResponse.json({ success: true, id: id })
  } catch (error) {
    console.error("Error al eliminar producto:", error)
    return NextResponse.json({ error: "Error al eliminar producto" }, { status: 500 })
  }
})
