import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'

// Function to invalidate dashboard cache after creating sales
async function invalidateDashboardCache() {
  try {
    // Call the invalidation endpoint
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    await fetch(`${baseUrl}/api/dashboard/stats`, { 
      method: 'DELETE' 
    })
  } catch (error) {
    console.error('Error invalidating dashboard cache:', error)
    // Don't throw error to avoid breaking the sale creation
  }
}

// GET - Obtener todas las ventas de servicios
export const GET = withAuthGet(async (request: NextRequest, context: any, user: any) => {
  try {
    const ventasServicios = await prisma.ventaServicios.findMany({
      include: {
        servicio: true,
        cliente: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(ventasServicios)
  } catch (error) {
    console.error('Error al obtener ventas de servicios:', error)
    return NextResponse.json(
      { error: 'Error al obtener ventas de servicios' },
      { status: 500 }
    )
  }
})

// POST - Crear una nueva venta de servicio
export const POST = withAuthPost(async (request: NextRequest, context: any, user: any) => {
  try {
    const data = await request.json()

    // Validación básica
    if (!data.servicioId || !data.cantidad || !data.total) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    const ventaServicio = await prisma.ventaServicios.create({
      data: {
        servicioId: data.servicioId,
        cantidad: data.cantidad,
        total: data.total,
        observaciones: data.observaciones,
        clienteId: data.clienteId
      }
    })

    // Invalidar cache del dashboard para actualizar las ventas diarias
    await invalidateDashboardCache()

    return NextResponse.json(ventaServicio, { status: 201 })
  } catch (error) {
    console.error('Error al crear venta de servicio:', error)
    return NextResponse.json(
      { error: 'Error al crear venta de servicio' },
      { status: 500 }
    )
  }
})