import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ubicacionId = searchParams.get("ubicacionId")
    const tipoUbicacion = searchParams.get("tipoUbicacion") // 'almacen' o 'punto_venta'
    const includeZero = searchParams.get("includeZero") === "true"

    if (!ubicacionId || !tipoUbicacion) {
      return NextResponse.json({ error: "ubicacionId y tipoUbicacion son requeridos" }, { status: 400 })
    }

    if (tipoUbicacion !== "almacen" && tipoUbicacion !== "punto_venta") {
      return NextResponse.json({ error: "tipoUbicacion inválido" }, { status: 400 })
    }

    // 1. Obtener todos los productos con select limitado a campos necesarios
    const productos = await prisma.producto.findMany({
      select: {
        id: true,
        nombre: true,
        codigoInterno: true,
        precioCosto: true,
        precioVenta: true,
        stock: true,
        stockMinimo: true,
        categoriaId: true,
        subcategoriaId: true,
        almacenId: true,
        categoria: { select: { catId: true, nombre: true } },
        subcategoria: { select: { catId: true, nombre: true } },
      },
    })

    // Mapas para acumular movimientos por producto
    const entradasMap = new Map<string, number>()
    const salidasMap = new Map<string, number>()
    const ventasMap = new Map<string, number>()

    // 2. Obtener movimientos relevantes en bulk según el tipo de ubicación
    if (tipoUbicacion === "punto_venta") {
      // Transferencias entrantes al PV
      const transferenciasEntrada = await prisma.transferencia.findMany({
        where: {
          puntoDeVentaDestinoId: ubicacionId,
        },
        select: { productoId: true, cantidad: true },
      })

      // Transferencias salientes del PV (devoluciones a almacén o transferencias a otro PV)
      const transferenciasSalida = await prisma.transferencia.findMany({
        where: {
          puntoDeVentaOrigenId: ubicacionId,
        },
        select: { productoId: true, cantidad: true },
      })

      // Ventas en este PV (modelo VentaItem)
      const ventasItems = await prisma.ventaItem.findMany({
        where: {
          venta: {
            puntoDeVentaId: ubicacionId,
          },
        },
        select: { productoId: true, cantidad: true },
      })

      // Ventas legacy en este PV (modelo Venta sin items)
      const ventasLegacy = await prisma.venta.findMany({
        where: {
          puntoDeVentaId: ubicacionId,
          items: { none: {} },
        },
        select: { productoId: true, cantidad: true },
      })

      // Procesar en memoria
      transferenciasEntrada.forEach((t) => {
        entradasMap.set(t.productoId, (entradasMap.get(t.productoId) || 0) + t.cantidad)
      })
      transferenciasSalida.forEach((t) => {
        salidasMap.set(t.productoId, (salidasMap.get(t.productoId) || 0) + t.cantidad)
      })
      ventasItems.forEach((v) => {
        // En VentaItem el productoId puede ser null si se borró, aunque el schema debería impedirlo.
        if (v.productoId) {
          ventasMap.set(v.productoId, (ventasMap.get(v.productoId) || 0) + v.cantidad)
        }
      })
      ventasLegacy.forEach((v) => {
        if (v.productoId) {
          ventasMap.set(v.productoId, (ventasMap.get(v.productoId) || 0) + v.cantidad)
        }
      })
    }

    // 3. Calcular stock final para cada producto
    const productosConStock = productos.map((producto) => {
      let stockUbicacion = 0

      if (tipoUbicacion === "almacen" && producto.almacenId === ubicacionId) {
        // El stock del almacén ya está materializado en producto.stock.
        stockUbicacion = producto.stock
      } else if (tipoUbicacion === "punto_venta") {
        const entradas = entradasMap.get(producto.id) || 0
        const salidas = salidasMap.get(producto.id) || 0
        const ventas = ventasMap.get(producto.id) || 0
        stockUbicacion = entradas - salidas - ventas
      } else {
        stockUbicacion = 0
      }

      // Evitar negativos
      stockUbicacion = Math.max(0, stockUbicacion)

      return {
        ...producto,
        stockUbicacion,
        // stockTotal se calculaba complejo antes, para simplificar y rendimiento
        // devolveremos producto.stock como stockTotal por ahora, o replicamos si es crítico.
        // El frontend usa stockUbicacion principalmente.
        stockTotal: producto.stock, // Simplificación aceptable si el foco es stock por ubicación
      }
    })

    // Filtrar
    const productosFiltrados = includeZero
      ? productosConStock
      : productosConStock.filter((p) => p.stockUbicacion > 0)

    return NextResponse.json(productosFiltrados)
  } catch (error) {
    console.error("Error al obtener stock por ubicación:", error)
    return NextResponse.json({ error: "Error interno del servidor al calcular stock" }, { status: 500 })
  }
}
