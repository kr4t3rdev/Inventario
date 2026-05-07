import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'

export async function getPagoSalariosHandler(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const pagoSalario = await prisma.pagosalario.findMany({
      include: {
        empleado: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(pagoSalario)
  } catch (error) {
    console.error('Error al obtener el pago de salario:', error)
    return NextResponse.json(
      { error: 'Error al obtener el pago de salario:' },
      { status: 500 }
    )
  }
}

export async function createPagoSalarioHandler(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const data = await request.json()

    const now = new Date()
    const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const empleado = await prisma.empleado.findUnique({ where: { empleadoId: data.empleadoId } })
    if (!empleado) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })

    const pagoSalario = await prisma.pagosalario.create({
      data: {
        empleado: { connect: { empleadoId: data.empleadoId } },
        tenant: { connect: { tenantId: empleado.tenantId } },
        salario: data.salario,
        periodo: periodo,
        ...(data.bonificaciones !== undefined && { bonificaciones: data.bonificaciones }),
        ...(data.deducciones !== undefined && { deducciones: data.deducciones }),
        ...(data.horasExtras !== undefined && { horasExtras: data.horasExtras }),
        ...(data.observaciones !== undefined && { observaciones: data.observaciones }),
      }
    })

    return NextResponse.json(pagoSalario, { status: 201 })
  } catch (error) {
    console.error('Error al crear pago de salario:', error)
    return NextResponse.json(
      { error: 'Error al crear pago de salario' },
      { status: 500 }
    )
  }
}

export async function getPagoSalarioByIdHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

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

export async function updatePagoSalarioHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const id = (await params).id
    const data = await request.json()

    const pagoSalario = await prisma.pagosalario.update({
      where: { pgId: id },
      data: {
        empleadoId: data.empleadoId,
        salario: data.salario,
        ...(data.bonificaciones !== undefined && { bonificaciones: data.bonificaciones }),
        ...(data.deducciones !== undefined && { deducciones: data.deducciones }),
        ...(data.aportes !== undefined && { aportes: data.aportes }),
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

export async function deletePagoSalarioHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

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
