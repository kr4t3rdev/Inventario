import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'

// GET - Obtener una venta de servicio específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const id = (await params).id

    const ventaServicio = await prisma.ventaServicios.findUnique({
      where: { ventaServicioId: id },
      include: {
        servicio: true,
        cliente: true
      }
    })

    if (!ventaServicio) {
      return NextResponse.json(
        { error: 'Venta de servicio no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(ventaServicio)
  } catch (error) {
    console.error('Error al obtener venta de servicio:', error)
    return NextResponse.json(
      { error: 'Error al obtener venta de servicio' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar una venta de servicio
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const id = (await params).id

    const data = await request.json()

    // Validación básica
    if (!data.cantidad || !data.total) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    const ventaServicio = await prisma.ventaServicios.update({
      where: { ventaServicioId: id },
      data: {
        cantidad: data.cantidad,
        total: data.total,
        observaciones: data.observaciones,
        clienteId: data.clienteId
      }
    })

    return NextResponse.json(ventaServicio)
  } catch (error) {
    console.error('Error al actualizar venta de servicio:', error)
    return NextResponse.json(
      { error: 'Error al actualizar venta de servicio' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar una venta de servicio
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const id = (await params).id

    await prisma.ventaServicios.delete({
      where: { ventaServicioId: id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al eliminar venta de servicio:', error)
    return NextResponse.json(
      { error: 'Error al eliminar venta de servicio' },
      { status: 500 }
    )
  }
}
