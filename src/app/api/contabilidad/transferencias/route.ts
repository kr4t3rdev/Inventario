import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser } from '@/lib/auth-middleware'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'

// Schema for creating a bank transfer
const createTransferenciaSchema = z.object({
  cuentaOrigenId: z.string().min(1, 'Cuenta origen es requerida'),
  cuentaDestinoId: z.string().min(1, 'Cuenta destino es requerida'),
  montoOrigen: z.number().positive('El monto debe ser positivo'),
  motivo: z.string().min(1, 'El motivo es requerido'),
  descripcion: z.string().optional(),
  tasaCambio: z.number().positive().optional()
})

// GET /api/contabilidad/transferencias - List bank transfers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const cuentaId = searchParams.get('cuentaId')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (cuentaId) {
      where.OR = [
        { cuentaOrigenId: cuentaId },
        { cuentaDestinoId: cuentaId }
      ]
    }

    if (fechaDesde || fechaHasta) {
      where.fechaTransferencia = {}
      if (fechaDesde) {
        where.fechaTransferencia.gte = new Date(fechaDesde)
      }
      if (fechaHasta) {
        where.fechaTransferencia.lte = new Date(fechaHasta)
      }
    }

    const [transferencias, total] = await Promise.all([
      prisma.transferenciaBancaria.findMany({
        where,
        select: {
          transferenciaId: true,
          numeroComprobante: true,
          cuentaOrigenId: true,
          cuentaDestinoId: true,
          montoOrigen: true,
          monedaOrigen: true,
          montoDestino: true,
          monedaDestino: true,
          tasaCambio: true,
          motivo: true,
          descripcion: true,
          fechaTransferencia: true,
          comprobanteGenerado: true,
          rutaComprobante: true,
          createdAt: true,
          updatedAt: true,
          cuentaOrigen: {
            select: {
              cuentaId: true,
              nombreBanco: true,
              numeroCuenta: true,
              moneda: true
            }
          },
          cuentaDestino: {
            select: {
              cuentaId: true,
              nombreBanco: true,
              numeroCuenta: true,
              moneda: true
            }
          }
        },
        orderBy: {
          fechaTransferencia: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.transferenciaBancaria.count({ where })
    ])

    // Convert Decimal amounts to numbers for proper JSON serialization
    const transferenciasFormateadas = transferencias.map((trans: any) => ({
      ...trans,
      montoOrigen: Number(trans.montoOrigen),
      montoDestino: Number(trans.montoDestino),
      tasaCambio: trans.tasaCambio ? Number(trans.tasaCambio) : null
    }))

    return NextResponse.json({
      transferencias: transferenciasFormateadas,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching transferencias:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST /api/contabilidad/transferencias - Execute bank transfer
export async function POST(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const body = await request.json()
    const validatedData = createTransferenciaSchema.parse(body)

    // Validar período contable antes de ejecutar la transferencia
    const fechaOperacion = extraerFechaDeBody(body) ?? new Date()
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId: user.tenantId ?? '',
      tipoOperacion: 'transferencia',
      actor: user.userId,
    })
    if (!validacionPeriodo.permitido) {
      return NextResponse.json(
        { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
        { status: 400 }
      )
    }

    const {
      cuentaOrigenId,
      cuentaDestinoId,
      montoOrigen,
      motivo,
      descripcion,
      tasaCambio
    } = validatedData

    // Validate that origin and destination accounts are different
    if (cuentaOrigenId === cuentaDestinoId) {
      return NextResponse.json(
        { error: 'La cuenta origen y destino deben ser diferentes' },
        { status: 400 }
      )
    }

    // Get both accounts
    const [cuentaOrigen, cuentaDestino] = await Promise.all([
      prisma.cuentaBancaria.findUnique({
        where: { cuentaId: cuentaOrigenId }
      }),
      prisma.cuentaBancaria.findUnique({
        where: { cuentaId: cuentaDestinoId }
      })
    ])

    if (!cuentaOrigen) {
      return NextResponse.json(
        { error: 'Cuenta origen no encontrada' },
        { status: 404 }
      )
    }

    if (!cuentaDestino) {
      return NextResponse.json(
        { error: 'Cuenta destino no encontrada' },
        { status: 404 }
      )
    }

    // Check if both accounts are active
    if (!cuentaOrigen.isActive) {
      return NextResponse.json(
        { error: 'La cuenta origen no está activa' },
        { status: 400 }
      )
    }

    if (!cuentaDestino.isActive) {
      return NextResponse.json(
        { error: 'La cuenta destino no está activa' },
        { status: 400 }
      )
    }

    // Check sufficient balance
    if (cuentaOrigen.saldo < montoOrigen) {
      return NextResponse.json(
        { error: 'Saldo insuficiente en la cuenta origen' },
        { status: 400 }
      )
    }

    // Calculate destination amount - simplified logic
    let montoDestino = montoOrigen
    let tasaCambioFinal = tasaCambio
   // const decrementarDestino = false

    if (cuentaOrigen.moneda !== cuentaDestino.moneda || cuentaDestino.moneda !== 'CUP') {
      if (!tasaCambio) {
        return NextResponse.json(
          { error: 'Tasa de cambio requerida para transferencias entre diferentes monedas o cuando la cuenta destino no es la principal' },
          { status: 400 }
        )
      }
      
      // Always subtract amount * exchange rate from destination account
      montoDestino = montoOrigen * tasaCambio
      //decrementarDestino = true
      tasaCambioFinal = tasaCambio
    }

    // Generate consecutive voucher number
    const lastTransferencia = await prisma.transferenciaBancaria.findFirst({
      orderBy: { numeroComprobante: 'desc' },
      select: { numeroComprobante: true }
    })

    let nextNumber = 1
    if (lastTransferencia?.numeroComprobante) {
      const lastNumber = parseInt(lastTransferencia.numeroComprobante.replace(/\D/g, ''))
      nextNumber = lastNumber + 1
    }

    const numeroComprobante = `TRF-${nextNumber.toString().padStart(6, '0')}`

    // Execute transfer in transaction
    const transferencia = await prisma.$transaction(async (tx: any) => {
      // Update origin account balance
      await tx.cuentaBancaria.update({
        where: { cuentaId: cuentaOrigenId },
        data: {
          saldo: {
            decrement: montoOrigen
          }
        }
      })

      // Update destination account balance
      await tx.cuentaBancaria.update({
        where: { cuentaId: cuentaDestinoId },
        data: {
          saldo: { increment: montoDestino }
        }
      })

      // Create transfer record
      const nuevaTransferencia = await tx.transferenciaBancaria.create({
        data: {
          numeroComprobante,
          cuentaOrigenId,
          cuentaDestinoId,
          montoOrigen,
          monedaOrigen: cuentaOrigen.moneda,
          montoDestino,
          monedaDestino: cuentaDestino.moneda,
          tasaCambio: tasaCambioFinal,
          motivo,
          descripcion,
          comprobanteGenerado: true,
          // Temporary actor until auth wiring is added
        } as any,
        include: {
          cuentaOrigen: {
            select: {
              nombreBanco: true,
              numeroCuenta: true,
              moneda: true
            }
          },
          cuentaDestino: {
            select: {
              nombreBanco: true,
              numeroCuenta: true,
              moneda: true
            }
          }
        }
      })

      return nuevaTransferencia
    })

    await AuditLogService.log({
      accion: "CREATE",
      entidad: "TRANSFERENCIA",
      entidadId: transferencia.transferenciaId,
      usuarioId: user.userId,
      detalles: {
        numeroComprobante: transferencia.numeroComprobante,
        cuentaOrigen: transferencia.cuentaOrigen.nombreBanco,
        cuentaDestino: transferencia.cuentaDestino.nombreBanco,
        montoOrigen: transferencia.montoOrigen,
        monedaOrigen: transferencia.monedaOrigen,
        montoDestino: transferencia.montoDestino,
        monedaDestino: transferencia.monedaDestino,
        motivo: transferencia.motivo
      }
    });

    return NextResponse.json({
      message: 'Transferencia ejecutada exitosamente',
      transferencia
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating transferencia:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}