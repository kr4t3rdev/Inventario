import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const periodo = searchParams.get("periodo")
    const tipoOperacion = searchParams.get("tipoOperacion") // 'restock', 'regular', or null for all
    const includeRestock = searchParams.get("includeRestock") // 'true', 'false', or null for all

    const whereClause: any = {}
    
    // Filter by period if provided
    if (periodo) {       
      whereClause.periodo = periodo
    }

    // Filter by operation type
    if (tipoOperacion === 'restock') {
      whereClause.descripcion = { contains: 'Restock' }
    } else if (tipoOperacion === 'regular') {
      whereClause.descripcion = { not: { contains: 'Restock' } }
    }

    // Alternative filtering approach using includeRestock parameter
    if (includeRestock === 'false') {
      whereClause.descripcion = { not: { contains: 'Restock' } }
    } else if (includeRestock === 'true') {
      whereClause.descripcion = { contains: 'Restock' }
    }

    const gastosCompra = await prisma.gastoCompra.findMany({
      where: whereClause,
      include: {
        producto: {
          include: {
            categoria: true,
            unidad: true,
          },
        },
        vendor: true,
      },
      orderBy: { createdAt: "desc" },
    })

    // Add metadata to help identify restock vs regular purchases
    const gastosCompraWithMetadata = gastosCompra.map((gasto: { descripcion?: string | null }) => ({
      ...gasto,
      isRestock: gasto.descripcion?.includes('Restock') || false,
      tipoOperacion: gasto.descripcion?.includes('Restock') ? 'restock' : 'regular'
    }))

    return NextResponse.json(gastosCompraWithMetadata)
  } catch (error) {
    console.error("Error al obtener gastos de compra:", error)
    return NextResponse.json({ error: "Error al obtener gastos de compra" }, { status: 500 })
  }
}

// export async function POST(request: NextRequest) {
//   try {
//     const data = await request.json()

//     const gastoCompra = await prisma.gastoCompra.create({
//       data: {
//         productoId: data.productoId,
//         vendorId: data.vendorId,
//         cantidad: data.cantidad,
//         precioUnitario: data.precioUnitario,
//         total: data.cantidad * data.precioUnitario,
//         fechaCompra: data.fechaCompra ? new Date(data.fechaCompra) : new Date(),
//         descripcion: data.descripcion,
//       },
//       include: {
//         producto: true,
//         vendor: true,
//       },
//     })

//     // Actualizar stock del producto
//     await prisma.producto.update({
//       where: { id: data.productoId },
//       data: {
//         stock: {
//           increment: data.cantidad,
//         },
//       },
//     })

//     return NextResponse.json(gastoCompra)
//   } catch (error) {
//     console.error("Error al crear gasto de compra:", error)
//     return NextResponse.json({ error: "Error al crear gasto de compra" }, { status: 500 })
//   }
// }

// export async function GET(request: NextRequest) {
//   try {
//     const gastosCompra = await prisma.gastoCompra.findMany({
//       include: {
//         producto: {
//           include: {
//             categoria: true,
//             unidad: true,
//           },
//         },
//         vendor: true,
//       },
//       orderBy: { fechaCompra: "desc" },
//     })

//     return NextResponse.json(gastosCompra)
//   } catch (error) {
//     console.error("Error al obtener gastos de compra:", error)
//     return NextResponse.json({ error: "Error al obtener gastos de compra" }, { status: 500 })
    
//   }
// }