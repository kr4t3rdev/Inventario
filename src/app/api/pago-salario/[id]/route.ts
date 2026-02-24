import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verify_token } from '@/lib/auth-utils'

// GET - Obtener una venta de servicio específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verify_token(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = (await params).id

    const pagoSalario = await prisma.pagosalario.findUnique({
      where: { pgId: id },
      include: {
        empleado: true,
      }
    })

    if (!pagoSalario) {
      return NextResponse.json(
        { error: 'Pago de salario no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(pagoSalario)
  } catch (error) {
    console.error('Error al obtener el pago de salario:', error)
    return NextResponse.json(
      { error: 'Error al obtener el pago de salario' },
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
    const user = await verify_token(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = (await params).id

    const data = await request.json()
    
    // // Validación básica
    // if (!data.cantidad || !data.total) {
    //   return NextResponse.json(
    //     { error: 'Faltan campos requeridos' },
    //     { status: 400 }
    //   )
    // }

    const pagoSalario = await prisma.pagosalario.update({
      where: { pgId: id },
      data: {
        empleadoId: data.empleadoId,
        salario: data.salario,
        ...(data.bonificaciones !== undefined && { bonificaciones: data.bonificaciones }),
        ...(data.deducciones !== undefined && { deducciones: data.deducciones }),
        ...(data.horasExtras !== undefined && { horasExtras: data.horasExtras }),
        ...(data.observaciones !== undefined && { observaciones: data.observaciones }),
      }
    })

    return NextResponse.json(pagoSalario)
  } catch (error) {
    console.error('Error al actualizar el pago de salario:', error)
    return NextResponse.json(
      { error: 'Error al actualizar el pago de salario' },
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
    const user = await verify_token(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = (await params).id

    await prisma.pagosalario.delete({
      where: { pgId: id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al eliminar el pago de salario', error)
    return NextResponse.json(
      { error: 'Error al eliminar el pago de salario:' },
      { status: 500 }
    )
  }
}
