import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import type { Prisma } from '@/generated/prisma'
import { authenticateUser } from "@/lib/auth-middleware"
import { requireFeature } from '@/lib/services/tenant-scope'
import { AuditLogService } from "@/lib/services/audit-log-service"
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'

// Schema para validar la reconciliación de servicios
const reconciliacionServicioSchema = z.object({
  ventaServicioId: z.string().min(1, 'ID de venta de servicio es requerido'),
  cuentaId: z.string().min(1, 'ID de cuenta bancaria es requerido'),
  tipoPagoId: z.string().min(1, 'Tipo de pago es requerido'),
  monto: z.number().positive('El monto debe ser positivo'),
  moneda: z.string().default('CUP'),
  tasaCambio: z.number().positive().optional(),
  observaciones: z.string().optional()
})

// GET - Obtener servicios pendientes de reconciliar
export async function GET(request: NextRequest) {
  try {
    const a = await authenticateUser(request); if ('status' in a) return a as Response; const u = a.user; requireFeature(u, 'servicios', 'ver reconciliación de servicios');
    const { searchParams } = new URL(request.url)
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // Construir filtros - obtener todos los servicios, filtraremos en el cliente por estado de reconciliación
    const whereClause: {
      createdAt?: {
        gte?: Date
        lte?: Date
      }
    } = {}

    if (fechaDesde || fechaHasta) {
      whereClause.createdAt = {}
      if (fechaDesde) {
        whereClause.createdAt.gte = new Date(fechaDesde)
      }
      if (fechaHasta) {
        whereClause.createdAt.lte = new Date(fechaHasta)
      }
    }

    // Obtener servicios pendientes
    const [ventaServicios, total] = await Promise.all([
      prisma.ventaServicios.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        include: {
          cliente: true,
          servicio: true,
          reconciliaciones: {
            select: {
              montoConvertido: true
            }
          }
        }
      }),
      prisma.ventaServicios.count({
        where: whereClause
      })
    ])

    return NextResponse.json({
      ventaServicios,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching pending services:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// POST - Reconciliar servicio con cuenta bancaria
export async function POST(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    requireFeature(user, 'servicios', 'reconciliar servicios');

    const body = await request.json()
    const validatedData = reconciliacionServicioSchema.parse(body)

    // Validar período contable antes de escribir
    const fechaOperacion = extraerFechaDeBody(body) ?? new Date()
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId: user.tenantId ?? '',
      tipoOperacion: 'reconciliacion_servicios',
      actor: user.userId,
    })
    if (!validacionPeriodo.permitido) {
      return NextResponse.json(
        { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
        { status: 400 }
      )
    }

    // Verificar que el servicio existe
    const ventaServicio = await prisma.ventaServicios.findUnique({
      where: { ventaServicioId: validatedData.ventaServicioId }
    })

    if (!ventaServicio) {
      return NextResponse.json(
        { error: 'Servicio no encontrado', code: 'SERVICIO_NO_ENCONTRADO' },
        { status: 404 }
      )
    }

    // Verificar que la cuenta bancaria existe y está activa
    const cuentaBancaria = await prisma.cuentaBancaria.findUnique({
      where: { cuentaId: validatedData.cuentaId }
    })

    if (!cuentaBancaria || !cuentaBancaria.isActive) {
      return NextResponse.json(
        { error: 'Cuenta bancaria no encontrada o inactiva', code: 'CUENTA_NO_ENCONTRADA' },
        { status: 404 }
      )
    }

    // Verificar que el tipo de pago existe y está activo
    const tipoPago = await prisma.tipoPago.findUnique({
      where: { tipoId: validatedData.tipoPagoId }
    })

    if (!tipoPago || !tipoPago.isActive) {
      return NextResponse.json(
        { error: 'Tipo de pago no encontrado o inactivo', code: 'TIPO_PAGO_INACTIVO' },
        { status: 404 }
      )
    }

    // Calcular monto convertido si es necesario
    let montoConvertido = validatedData.monto
    if (cuentaBancaria.moneda !== 'CUP' && validatedData.tasaCambio) {
      montoConvertido = validatedData.monto * validatedData.tasaCambio
    }

    // Si el tipo de pago requiere cuenta, verificar cuenta defecto
    let cuentaOrigen = null
    if (tipoPago.requiereCuenta && tipoPago.cuentaDefecto) {
      cuentaOrigen = await prisma.cuentaBancaria.findUnique({
        where: { cuentaId: tipoPago.cuentaDefecto }
      })

      if (!cuentaOrigen || !cuentaOrigen.isActive) {
        return NextResponse.json(
          { error: 'Cuenta bancaria de origen no encontrada o inactiva', code: 'CUENTA_ORIGEN_INACTIVA' },
          { status: 404 }
        )
      }

      // Verificar que la cuenta origen tenga saldo suficiente
      if (cuentaOrigen.saldo < montoConvertido) {
        return NextResponse.json(
          { error: 'Saldo insuficiente en la cuenta de origen', code: 'SALDO_INSUFICIENTE' },
          { status: 400 }
        )
      }
    }

    // Realizar la reconciliación en una transacción
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Crear la reconciliación
      const reconciliacion = await tx.reconciliacionServicio.create({
        data: {
          tenantId: ventaServicio.tenantId,
          ventaServicioId: validatedData.ventaServicioId,
          cuentaId: validatedData.cuentaId,
          tipoPagoId: validatedData.tipoPagoId,
          monto: validatedData.monto,
          moneda: validatedData.moneda,
          tasaCambio: validatedData.tasaCambio,
          montoConvertido: montoConvertido,
          observaciones: validatedData.observaciones,
          reconciliadoPor: user.userId
        },
        include: {
          ventasServicio: true,
          cuentaBancaria: true,
          tipoPago: true,
          
        }
      })

      // Actualizar el saldo de las cuentas bancarias
      const saldoIncremento = parseFloat(montoConvertido.toString())

      if (cuentaOrigen && tipoPago.cuentaDefecto !== validatedData.cuentaId) {
        // Transferir: decrementar de cuenta origen e incrementar en cuenta destino
        await tx.cuentaBancaria.update({
          where: { cuentaId: tipoPago.cuentaDefecto! },
          data: {
            saldo: {
              decrement: saldoIncremento
            }
          }
        })

        await tx.cuentaBancaria.update({
          where: { cuentaId: validatedData.cuentaId },
          data: {
            saldo: {
              increment: saldoIncremento
            }
          }
        })
      } else {
        // Solo incrementar en la cuenta destino
        await tx.cuentaBancaria.update({
          where: { cuentaId: validatedData.cuentaId },
          data: {
            saldo: {
              increment: saldoIncremento
            }
          }
        })
      }

      // Registrar la transacción de moneda si es diferente a CUP
      if (validatedData.moneda !== 'CUP' && validatedData.tasaCambio) {
        await tx.transaccionMoneda.create({
          data: {
            tipoTransaccion: 'servicio',
            referenciaId: validatedData.ventaServicioId,
            monedaId: validatedData.moneda,
            montoOriginal: validatedData.monto,
            tasaCambio: validatedData.tasaCambio,
            montoConvertido: montoConvertido
          }
        })
      }

      return reconciliacion
    })

    // Registrar en auditoría
    await AuditLogService.log({
      accion: "CREATE",
      entidad: "RECONCILIACION",
      entidadId: result.reconciliacionId,
      usuarioId: user.userId,
      detalles: {
        tipo: "SERVICIO",
        ventaServicioId: result.ventaServicioId,
        cuenta: cuentaBancaria.nombreBanco,
        monto: result.monto,
        moneda: result.moneda,
        montoConvertido: result.montoConvertido,
        tipoPago: tipoPago.nombre
      }
    });

    return NextResponse.json({
      message: 'Servicio reconciliado exitosamente',
      reconciliacion: result
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error reconciling service:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
