import { NextRequest, NextResponse } from "next/server"
import { prisma } from "../../../../../lib/prisma"
import { authenticateUser } from "@/lib/auth-middleware"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[DEBUG] Simple restock history API called')
    console.log('[DEBUG] Request URL:', request.url)
    console.log('[DEBUG] Params object:', params)
    
    // Await params for Next.js 15 compatibility
    const { id: productoId } = await params
    console.log('[DEBUG] Extracted product ID:', productoId)
    
    console.log('[SIMPLE_RESTOCK_HISTORY] Starting request for product:', productoId)

    // JWT Authentication temporarily disabled for debugging
    console.log('[DEBUG] Skipping auth check for debugging purposes')
    // const user = await verify_token(request)
    // if (!user) {
    //   return NextResponse.json(
    //     { error: "Unauthorized" },
    //     { status: 401 }
    //   )
    // }
    
    console.log('[DEBUG] Product ID received:', productoId, 'Type:', typeof productoId)
    
    if (!productoId) {
      console.log('[DEBUG] No product ID - returning 400')
      return NextResponse.json(
        { error: "Product ID required", received: productoId },
        { status: 400 }
      )
    }

    console.log('[SIMPLE_RESTOCK_HISTORY] Checking if product exists:', productoId)

    // Check if product exists
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      select: { 
        id: true, 
        nombre: true, 
        precioCosto: true, 
        precioVenta: true
      }
    })

    if (!producto) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      )
    }

    console.log('[SIMPLE_RESTOCK_HISTORY] Product found:', producto.nombre)

    // Get all GastoCompra records for this product (for debugging)
    const allGastoCompra = await prisma.gastoCompra.findMany({
      where: {
        productoId: productoId
      },
      select: {
        gastoCompraId: true,
        descripcion: true,
        fechaCompra: true,
        cantidad: true,
        total: true,
        precioUnitario: true
      },
      orderBy: { fechaCompra: 'desc' },
      take: 10
    })

    console.log(`[SIMPLE_RESTOCK_HISTORY] Found ${allGastoCompra.length} GastoCompra records`)

    // Filter for restock entries
    const restockEntries = allGastoCompra.filter((entry: { descripcion?: string | null }) => 
      entry.descripcion && entry.descripcion.includes('Restock')
    )

    console.log(`[SIMPLE_RESTOCK_HISTORY] Found ${restockEntries.length} restock entries`)

    // Simple response
    const response = {
      success: true,
      productoId,
      productoNombre: producto.nombre,
      totalGastoCompra: allGastoCompra.length,
      totalRestockEntries: restockEntries.length,
      allEntries: allGastoCompra.map((entry: { gastoCompraId: string; descripcion?: string | null; fechaCompra: Date; cantidad: number; total: number }) => ({
        id: entry.gastoCompraId,
        descripcion: entry.descripcion,
        fecha: entry.fechaCompra.toISOString(),
        cantidad: entry.cantidad,
        total: entry.total,
        isRestock: entry.descripcion?.includes('Restock') || false
      })),
      restockEntries: restockEntries.map((entry: { gastoCompraId: string; descripcion?: string | null; fechaCompra: Date; cantidad: number; total: number }) => ({
        id: entry.gastoCompraId,
        descripcion: entry.descripcion,
        fecha: entry.fechaCompra.toISOString(),
        cantidad: entry.cantidad,
        total: entry.total
      }))
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error("[SIMPLE_RESTOCK_HISTORY] Error:", error)
    
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}