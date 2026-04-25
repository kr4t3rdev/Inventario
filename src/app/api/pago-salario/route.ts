import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'

// GET - Obtener todas las ventas de servicios
export async function GET(request: NextRequest) {
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

// POST - Crear una nueva venta de servicio
export async function POST(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    await assertOperationAllowed(new Date(), 'PAGO_SALARIO')

    const data = await request.json()

    // // Validación básica
    // if (!data.servicioId || !data.cantidad || !data.total) {
    //   return NextResponse.json(
    //     { error: 'Faltan campos requeridos' },
    //     { status: 400 }
    //   )
    // }

    // let puntoDeVentaId = data.puntoDeVentaId

    // // Si se envía "default", buscar el primer punto de venta disponible
    // if (puntoDeVentaId === "default") {
    //   const defaultPuntoVenta = await prisma.puntoDeVenta.findFirst({
    //     orderBy: { createdAt: 'asc' }
    //   })
    //   if (!defaultPuntoVenta) {
    //     return NextResponse.json(
    //       { error: 'No hay puntos de venta disponibles' },
    //       { status: 400 }
    //     )
    //   }
    //   puntoDeVentaId = defaultPuntoVenta.pvId
    // }

    // Calcular el periodo basado en createdAt (año-mes)
    const now = new Date()
    const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const pagoSalario = await prisma.pagosalario.create({
      data: {
        empleadoId: data.empleadoId,
        salario: data.salario,
        periodo: periodo,
        ...(data.bonificaciones !== undefined && { bonificaciones: data.bonificaciones }),
        ...(data.deducciones !== undefined && { deducciones: data.deducciones }),
        ...(data.horasExtras !== undefined && { horasExtras: data.horasExtras }),
        ...(data.observaciones !== undefined && { observaciones: data.observaciones }),

      }
    })

    await registrarEventoContable({
      origenTipo: 'PAGO_SALARIO',
      origenId: pagoSalario.pgId,
      monto: Number(pagoSalario.salario ?? 0),
      fechaOperacion: new Date(),
      descripcion: `Pago salario ${pagoSalario.pgId}`,
      usuarioId: authResultUser.user.userId,
    })

    return NextResponse.json(pagoSalario, { status: 201 })
} catch (error) {
    if (isPeriodoOperacionError(error)) {
      return NextResponse.json(serializePeriodoOperacionError(error), { status: error.status })
    }
    console.error('Error al crear pago de salario:', error)
    return NextResponse.json(
      { error: 'Error al crear pago de salario:' },
      { status: 500 }
    )
  }
}
