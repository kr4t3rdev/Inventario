import { NextRequest, NextResponse } from "next/server"
import { prisma } from "../../../../../lib/prisma"
// import { verify_token } from "../../../../../lib/auth-utils"
import { authenticateUser } from "@/lib/auth-middleware"
import { z } from "zod"
// import { z } from "zod" // Removed for simplified query handling

interface QueryParamsResult {
  error?: string
  page?: number
  limit?: number
  sortBy?: 'fecha' | 'cantidad' | 'total'
  sortOrder?: 'asc' | 'desc'
}

const getQueryParams = (searchParams: URLSearchParams) => {
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '10', 10)
  const sortBy = searchParams.get('sortBy') || 'fecha'
  const sortOrder = searchParams.get('sortOrder') || 'desc'

  if (
    Number.isNaN(page) ||
    Number.isNaN(limit) ||
    page < 1 ||
    limit < 1 ||
    limit > 100 ||
    !['fecha', 'cantidad', 'total'].includes(sortBy) ||
    !['asc', 'desc'].includes(sortOrder)
  ) {
    return { error: 'Invalid query parameters' }
  }

  return {
    page,
    limit,
    sortBy: sortBy as QueryParamsResult['sortBy'],
    sortOrder: sortOrder as QueryParamsResult['sortOrder']
  }
}

// Interface for restock history response
interface RestockHistoryItem {
  id: string
  fecha: string
  cantidad: number
  precioCostoAnterior: number
  precioCostoNuevo: number
  precioVentaAnterior: number
  precioVentaNuevo: number
  totalCompra: number
  descripcion: string | null
  tipoOperacion: 'restock_same_prices' | 'restock_new_instance' | 'restock_price_change'
  productInstance?: {
    id: string
    nombre: string
    precioCosto: number
    precioVenta: number
  }
  vendor: {
    nombre: string
    contacto: string | null
  }
}

interface RestockHistoryResponse {
  history: RestockHistoryItem[]
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  summary: {
    totalRestocks: number
    totalQuantityAdded: number
    totalCostSpent: number
    averageCostPerRestock: number
    priceChanges: number
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params for Next.js 15 compatibility
    const { id: productoId } = await params
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) {
      return authResultUser as Response
    }

    // Validate product ID
    if (!productoId || typeof productoId !== 'string') {
      return NextResponse.json(
        { error: "Invalid product ID", received: productoId, type: typeof productoId },
        { status: 400 }
      )
    }

    // Parse and validate query parameters - simplified approach
    const { searchParams } = new URL(request.url)
    const queryParams = getQueryParams(searchParams)

    if (queryParams.error) {
      return NextResponse.json(
        { error: queryParams.error },
        { status: 400 }
      )
    }

    const page = queryParams.page ?? 1
    const limit = queryParams.limit ?? 10
    const sortBy = queryParams.sortBy
    const sortOrder = queryParams.sortOrder

    // Verify product exists
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      select: {
        id: true,
        nombre: true,
        precioCosto: true,
        precioVenta: true,
        stock: true
      }
    })

    if (!producto) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      )
    }

    // Calculate pagination offset
    const offset = (page - 1) * limit

    // Query for restock operations (GastoCompra entries with restock descriptions)
    // Simplified query to avoid potential Prisma issues
    const [restockEntries, totalCount] = await Promise.all([
      prisma.gastoCompra.findMany({
        where: {
          productoId: productoId,
          descripcion: {
            contains: 'Restock'
          }
        },
        include: {
          producto: {
            select: {
              id: true,
              nombre: true,
              precioCosto: true,
              precioVenta: true
            }
          },
          vendor: {
            select: {
              nombre: true,
              contacto: true
            }
          }
        },
        orderBy: {
          [sortBy === 'fecha' ? 'fechaCompra' : sortBy === 'cantidad' ? 'cantidad' : 'total']: sortOrder
        },
        skip: offset,
        take: limit
      }),
      prisma.gastoCompra.count({
        where: {
          productoId: productoId,
          descripcion: {
            contains: 'Restock'
          }
        }
      })
    ])
    // Build restock history with simplified price change tracking
    const history: RestockHistoryItem[] = []

    for (let i = 0; i < restockEntries.length; i++) {
      const entry = restockEntries[i]

      // Find the previous restock entry for price comparison
      const previousEntries = await prisma.gastoCompra.findMany({
        where: {
          productoId: productoId,
          fechaCompra: { lt: entry.fechaCompra },
          descripcion: { contains: 'Restock' }
        },
        orderBy: { fechaCompra: 'desc' },
        take: 1
      })

      // For price comparison, we need to look at the product state at the time of the previous restock
      // Since we don't store historical prices, we'll use the current product prices as baseline
      // and assume price changes happened during this restock if the unit price differs significantly
      let precioCostoAnterior = producto.precioCosto
      let precioVentaAnterior = producto.precioVenta

      // If there was a previous restock, try to estimate the previous prices
      if (previousEntries.length > 0) {
        const previousEntry = previousEntries[0]
        // Use the previous entry's unit price as an indicator of the cost price at that time
        precioCostoAnterior = previousEntry.precioUnitario
        // For selling price, we'll use the current product price as we don't have historical data
        precioVentaAnterior = producto.precioVenta
      }

      const isNewInstance = entry.producto.id !== productoId
      let tipoOperacion: RestockHistoryItem['tipoOperacion'] = 'restock_same_prices'

      if (isNewInstance) {
        tipoOperacion = 'restock_new_instance'
      } else if (previousEntries.length > 0 && Math.abs(entry.precioUnitario - previousEntries[0].precioUnitario) > 0.01) {
        tipoOperacion = 'restock_price_change'
      } else if (previousEntries.length === 0 && Math.abs(entry.precioUnitario - producto.precioCosto) > 0.01) {
        // First restock with different price than current product price
        tipoOperacion = 'restock_price_change'
      }

      const historyItem: RestockHistoryItem = {
        id: entry.gastoCompraId,
        fecha: entry.fechaCompra.toISOString(),
        cantidad: entry.cantidad,
        precioCostoAnterior,
        precioCostoNuevo: entry.producto.precioCosto, // Current product price (after weighted average)
        precioVentaAnterior,
        precioVentaNuevo: entry.producto.precioVenta, // Current product price (after weighted average)
        totalCompra: entry.total,
        descripcion: entry.descripcion,
        tipoOperacion,
        productInstance: isNewInstance ? entry.producto : undefined,
        vendor: entry.vendor
      }

      history.push(historyItem)
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    // Calculate summary statistics
    const totalQuantityAdded = history.reduce((sum, item) => sum + item.cantidad, 0)
    const totalCostSpent = history.reduce((sum, item) => sum + item.totalCompra, 0)
    const averageCostPerRestock = history.length > 0 ? totalCostSpent / history.length : 0
    const priceChanges = history.filter(item =>
      item.tipoOperacion === 'restock_price_change'
    ).length

    const response: RestockHistoryResponse = {
      history,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage,
        hasPreviousPage
      },
      summary: {
        totalRestocks: totalCount,
        totalQuantityAdded,
        totalCostSpent,
        averageCostPerRestock: Math.round(averageCostPerRestock * 100) / 100,
        priceChanges
      }
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    const productoId = (await params).id
    console.error("[RESTOCK_HISTORY_GET] Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      productoId: productoId,
      error
    })

    // Handle specific error types
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: error.errors
        },
        { status: 400 }
      )
    }

    // Handle Prisma-specific errors
    if (error instanceof Error) {
      if (error.message.includes("Invalid `prisma.")) {
        return NextResponse.json(
          {
            error: "Database query error",
            message: "Invalid database operation",
            details: error.message
          },
          { status: 500 }
        )
      }

      if (error.message.includes("Connection")) {
        return NextResponse.json(
          {
            error: "Database connection error",
            message: "Unable to connect to database",
            details: error.message
          },
          { status: 503 }
        )
      }

      if (error.message.includes("Unknown arg")) {
        return NextResponse.json(
          {
            error: "Database schema error",
            message: "Database field or argument not found",
            details: error.message
          },
          { status: 500 }
        )
      }
    }

    // Generic server error for unhandled cases
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred while fetching restock history",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}