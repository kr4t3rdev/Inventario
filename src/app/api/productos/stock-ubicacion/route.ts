import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * @description Devuelve el stock materializado por ubicación leyendo directamente
 * de la tabla StockUbicacion. Más eficiente que el cálculo on-demand anterior.
 * @param {Request} request - Request con query params: ubicacionId, tipoUbicacion, includeZero
 * @returns {Promise<NextResponse>} Lista de productos con stockUbicacion y stockTotal
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ubicacionId = searchParams.get("ubicacionId")
    const tipoUbicacion = searchParams.get("tipoUbicacion") // 'almacen' | 'punto_venta'
    const includeZero = searchParams.get("includeZero") === "true"

    if (!ubicacionId || !tipoUbicacion) {
      return NextResponse.json(
        { error: "ubicacionId y tipoUbicacion son requeridos" },
        { status: 400 },
      )
    }

    if (tipoUbicacion !== "almacen" && tipoUbicacion !== "punto_venta") {
      return NextResponse.json({ error: "tipoUbicacion inválido" }, { status: 400 })
    }

    const registros = await prisma.stockUbicacion.findMany({
      where: {
        ubicacionId,
        tipoUbicacion,
        ...(includeZero ? {} : { cantidad: { gt: 0 } }),
      },
      include: {
        producto: {
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            codigoInterno: true,
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
          },
        },
      },
    })

    const resultado = registros.map((r) => ({
      ...r.producto,
      stockUbicacion: r.cantidad,
      stockTotal: r.producto.stock,
    }))

    return NextResponse.json(resultado)
  } catch (error) {
    console.error("Error al obtener stock por ubicación:", error)
    return NextResponse.json(
      { error: "Error interno del servidor al calcular stock" },
      { status: 500 },
    )
  }
}
