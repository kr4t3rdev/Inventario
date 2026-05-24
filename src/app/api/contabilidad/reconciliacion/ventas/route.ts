import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { Prisma } from '@/generated/prisma'
import { authenticateUser } from "@/lib/auth-middleware"
import { AuditLogService } from "@/lib/services/audit-log-service"
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'

// Schema para validar la reconciliación de ventas
const reconciliacionVentaSchema = z.object({
  ventaId: z.string().min(1, 'ID de venta es requerido'),
  cuentaId: z.string().min(1, 'ID de cuenta bancaria es requerido'),
  tipoPagoId: z.string().min(1, 'Tipo de pago es requerido'),
  monto: z.number().positive('El monto debe ser positivo'),
  moneda: z.string().default('CUP'),
  tasaCambio: z.number().positive().optional(),
  verificacionTransferenciaId: z.string().optional(),
  idTransferencia: z.string().optional(),
  observaciones: z.string().optional()
})

/**
 * @description Convierte un monto de pago a CUP para control de sobrepago y CxC.
 * @param {number} monto - Monto original del pago.
 * @param {string} moneda - Moneda del monto.
 * @param {number | undefined} tasaCambio - Tasa opcional para conversión.
 * @returns {number} Monto normalizado en CUP.
 */
function normalizeMontoToCup(monto: number, moneda: string, tasaCambio?: number): number {
  if (moneda === 'CUP') {
    return monto
  }

  if (typeof tasaCambio === 'number' && Number.isFinite(tasaCambio) && tasaCambio > 0) {
    return monto * tasaCambio
  }

  // Fallback para históricos sin tasa registrada
  return monto
}

/**
 * @description Convierte un monto hacia la moneda de una cuenta bancaria.
 * @param {number} monto - Monto original del pago.
 * @param {string} monedaPago - Moneda en la que viene el pago.
 * @param {string} monedaCuenta - Moneda de la cuenta destino/origen.
 * @param {number | undefined} tasaCambio - Tasa para conversión cuando aplica.
 * @returns {number} Monto expresado en moneda de la cuenta.
 */
function convertMontoToCuentaMoneda(
  monto: number,
  monedaPago: string,
  monedaCuenta: string,
  tasaCambio?: number
): number {
  if (monedaPago === monedaCuenta) {
    return monto
  }

  if (typeof tasaCambio === 'number' && Number.isFinite(tasaCambio) && tasaCambio > 0) {
    return monto * tasaCambio
  }

  return monto
}

/**
 * @description Crea un error de validación con status HTTP para el flujo de reconciliación.
 * @param {number} status - Código HTTP a devolver.
 * @param {string} code - Código de negocio.
 * @param {string} message - Mensaje legible de error.
 * @returns {Error & { status: number; code: string }} Error enriquecido.
 */
function createReconciliacionError(
  status: number,
  code: string,
  message: string
): Error & { status: number; code: string } {
  const error = new Error(message) as Error & { status: number; code: string }
  error.status = status
  error.code = code
  return error
}

/**
 * @description Obtiene candidatos de número de factura válidos para fallback en CxC.
 * @param {string | null | undefined} ordenId - Identificador de orden/venta.
 * @param {string | null | undefined} numeroFactura - Número de factura asociado.
 * @returns {string[]} Números de factura únicos no vacíos.
 */
function getNumeroFacturaCandidates(
  ordenId?: string | null,
  numeroFactura?: string | null
): string[] {
  return Array.from(
    new Set(
      [ordenId, numeroFactura]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value): value is string => value.length > 0)
    )
  )
}

// GET - Obtener ventas pendientes de reconciliar
export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const { searchParams } = new URL(request.url)
    const fechaDesde = searchParams.get('fechaDesde') || searchParams.get('fechaInicio')
    const fechaHasta = searchParams.get('fechaHasta') || searchParams.get('fechaFin')
    const puntoDeVentaId = searchParams.get('puntoDeVentaId')
    const pageParam = parseInt(searchParams.get('page') || '1', 10)
    const limitParam = parseInt(searchParams.get('limit') || '50', 10)
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
    const normalizedLimit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50
    const limit = Math.min(200, normalizedLimit)
    const skip = (page - 1) * limit

    const whereParts: Prisma.Sql[] = []

    if (fechaDesde) {
      whereParts.push(Prisma.sql`v."createdAt" >= ${new Date(fechaDesde)}`)
    }

    if (fechaHasta) {
      const fechaHastaDate = new Date(fechaHasta)
      fechaHastaDate.setUTCHours(23, 59, 59, 999)
      whereParts.push(Prisma.sql`v."createdAt" <= ${fechaHastaDate}`)
    }

    if (puntoDeVentaId) {
      whereParts.push(Prisma.sql`v."puntoDeVentaId" = ${puntoDeVentaId}`)
    }

    const whereSql = whereParts.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`
      : Prisma.sql``

    // Paginación en DB para evitar truncar resultados cuando hay muchos registros.
    const ventasPendientesRows = await prisma.$queryRaw<Array<{
      ventaId: string
      totalPagado: number
    }>>(Prisma.sql`
      SELECT
        v."ventaId",
        COALESCE(
          SUM(
            CASE
              WHEN rv."moneda" = 'CUP' THEN rv."monto"
              WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0
                THEN rv."monto" * rv."tasaCambio"
              ELSE rv."monto"
            END
          ),
          0
        )::double precision AS "totalPagado"
      FROM "Venta" v
      LEFT JOIN "ReconciliacionVenta" rv ON rv."ventaId" = v."ventaId"
      ${whereSql}
      GROUP BY v."ventaId", v."total", v."createdAt"
      HAVING (
        COALESCE(v."total", 0) - COALESCE(
          SUM(
            CASE
              WHEN rv."moneda" = 'CUP' THEN rv."monto"
              WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0
                THEN rv."monto" * rv."tasaCambio"
              ELSE rv."monto"
            END
          ),
          0
        )
      ) > 0.1
      ORDER BY v."createdAt" DESC
      OFFSET ${skip}
      LIMIT ${limit}
    `)

    const totalRows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM (
        SELECT v."ventaId"
        FROM "Venta" v
        LEFT JOIN "ReconciliacionVenta" rv ON rv."ventaId" = v."ventaId"
        ${whereSql}
        GROUP BY v."ventaId", v."total"
        HAVING (
          COALESCE(v."total", 0) - COALESCE(
            SUM(
              CASE
                WHEN rv."moneda" = 'CUP' THEN rv."monto"
                WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0
                  THEN rv."monto" * rv."tasaCambio"
                ELSE rv."monto"
              END
            ),
            0
          )
        ) > 0.1
      ) AS pendientes
    `)

    const total = Number(totalRows[0]?.total || 0)
    const ventaIds = ventasPendientesRows.map((row) => row.ventaId)

    if (ventaIds.length === 0) {
      return NextResponse.json({
        ventas: [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })
    }

    const ventasRaw = await prisma.venta.findMany({
      where: {
        ventaId: {
          in: ventaIds
        }
      },
      include: {
        producto: {
          select: {
            nombre: true,
            precioVenta: true
          }
        },
        puntoDeVenta: {
          select: {
            nombre: true
          }
        },
        empleado: {
          select: {
            nombre: true,
            apellido: true
          }
        },
        cliente: {
          select: {
            nombre: true
          }
        },
        reconciliaciones: {
          select: {
            monto: true
          }
        }
      }
    })

    const pagosMap = new Map(
      ventasPendientesRows.map((row) => [row.ventaId, Number(row.totalPagado || 0)])
    )
    const ventasMap = new Map(ventasRaw.map((venta) => [venta.ventaId, venta]))
    const ventasPaginadas = ventaIds
      .map((ventaId) => {
        const venta = ventasMap.get(ventaId)
        if (!venta) {
          return null
        }

        const totalVenta = Number(venta.total || 0)
        const totalPagado = pagosMap.get(ventaId) || 0
        const saldoPendiente = Math.max(0, totalVenta - totalPagado)

        return {
          ...venta,
          saldoPendiente,
          totalPagado
        }
      })
      .filter(Boolean)

    return NextResponse.json({
      ventas: ventasPaginadas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching pending sales:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// POST - Reconciliar venta con cuenta bancaria
export async function POST(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const body = await request.json()
    const validatedData = reconciliacionVentaSchema.parse(body)

    // Validar período contable antes de escribir
    const fechaOperacion = extraerFechaDeBody(body) ?? new Date()
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId: user.tenantId ?? '',
      tipoOperacion: 'reconciliacion_ventas',
      actor: user.userId,
    })
    if (!validacionPeriodo.permitido) {
      return NextResponse.json(
        { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
        { status: 400 }
      )
    }

    const referenciaTransferenciaRaw =
      validatedData.verificacionTransferenciaId || validatedData.idTransferencia
    const referenciaTransferencia = referenciaTransferenciaRaw?.trim() || undefined

    // Verificar que la venta existe
    const venta = await prisma.venta.findUnique({
      where: { ventaId: validatedData.ventaId },
      include: {
        factura: true,
        cliente: true
      }
    })

    if (!venta) {
      return NextResponse.json(
        { error: 'Venta no encontrada', code: 'VENTA_NO_ENCONTRADA' },
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

    const monedasDifierenEnCuenta = validatedData.moneda !== cuentaBancaria.moneda
    const requiereTasaCambioCuenta = monedasDifierenEnCuenta
    const requiereTasaCambioVenta = validatedData.moneda !== 'CUP'
    if ((requiereTasaCambioCuenta || requiereTasaCambioVenta) && !validatedData.tasaCambio) {
      return NextResponse.json(
        {
          error: 'Se requiere tasa de cambio para convertir el pago.',
          code: 'TASA_CAMBIO_REQUERIDA'
        },
        { status: 400 }
      )
    }

    const tasaCambio = validatedData.tasaCambio ? Number(validatedData.tasaCambio) : undefined
    const montoBase = Number(validatedData.monto)

    // Monto aplicado a la venta en CUP para control de sobrepago/CxC
    const montoAplicadoVentaCUP = normalizeMontoToCup(montoBase, validatedData.moneda, tasaCambio)

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
    }

    // Realizar la reconciliación en una transacción
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Idempotencia por referencia de transferencia si fue enviada
      if (referenciaTransferencia) {
        const existingByReference = await tx.reconciliacionVenta.findFirst({
          where: {
            ventaId: validatedData.ventaId,
            idTransferencia: referenciaTransferencia
          },
          include: {
            venta: {
              include: {
                producto: true,
                puntoDeVenta: true,
                empleado: true,
                factura: true,
                cliente: true
              }
            },
            cuentaBancaria: true,
            tipoPago: true
          }
        })

        if (existingByReference) {
          return existingByReference
        }
      }

      // Lock de filas críticas para evitar condiciones de carrera en sobrepago/saldos.
      await tx.$queryRaw`
        SELECT 1 FROM "Venta"
        WHERE "ventaId" = ${validatedData.ventaId}
        FOR UPDATE
      `
      await tx.$queryRaw`
        SELECT 1 FROM "CuentaBancaria"
        WHERE "cuentaId" = ${validatedData.cuentaId}
        FOR UPDATE
      `
      if (cuentaOrigen) {
        await tx.$queryRaw`
          SELECT 1 FROM "CuentaBancaria"
          WHERE "cuentaId" = ${cuentaOrigen.cuentaId}
          FOR UPDATE
        `
      }

      const cuentaDestinoLocked = await tx.cuentaBancaria.findUnique({
        where: { cuentaId: validatedData.cuentaId }
      })

      if (!cuentaDestinoLocked || !cuentaDestinoLocked.isActive) {
        throw createReconciliacionError(
          404,
          'CUENTA_NO_ENCONTRADA',
          'Cuenta bancaria no encontrada o inactiva'
        )
      }

      const montoDestino = convertMontoToCuentaMoneda(
        montoBase,
        validatedData.moneda,
        cuentaDestinoLocked.moneda,
        tasaCambio
      )

      let cuentaOrigenLocked: { cuentaId: string; saldo: number; moneda: string } | null = null
      if (cuentaOrigen) {
        cuentaOrigenLocked = await tx.cuentaBancaria.findUnique({
          where: { cuentaId: cuentaOrigen.cuentaId },
          select: {
            cuentaId: true,
            saldo: true,
            moneda: true
          }
        })

        if (!cuentaOrigenLocked) {
          throw createReconciliacionError(
            404,
            'CUENTA_ORIGEN_INACTIVA',
            'Cuenta bancaria de origen no encontrada o inactiva'
          )
        }

        const montoOrigen = convertMontoToCuentaMoneda(
          montoBase,
          validatedData.moneda,
          cuentaOrigenLocked.moneda,
          tasaCambio
        )

        if (cuentaOrigenLocked.saldo < montoOrigen) {
          throw createReconciliacionError(
            400,
            'SALDO_INSUFICIENTE',
            'Saldo insuficiente en la cuenta de origen'
          )
        }
      }

      const reconciliacionesPrevias = await tx.reconciliacionVenta.findMany({
        where: { ventaId: validatedData.ventaId },
        select: {
          monto: true,
          moneda: true,
          tasaCambio: true
        }
      })

      const totalPagadoPrevio = reconciliacionesPrevias.reduce((sum, rec) => {
        return sum + normalizeMontoToCup(
          Number(rec.monto || 0),
          rec.moneda || 'CUP',
          rec.tasaCambio ? Number(rec.tasaCambio) : undefined
        )
      }, 0)

      const totalVenta = Number(venta.total || 0)
      const nuevoTotalPagado = totalPagadoPrevio + montoAplicadoVentaCUP
      if (nuevoTotalPagado > totalVenta + 0.1) {
        throw createReconciliacionError(
          400,
          'MONTO_EXCEDIDO',
          `El monto excede el saldo pendiente. Total venta (CUP): ${totalVenta}, ` +
            `Pagado (CUP): ${totalPagadoPrevio.toFixed(2)}, ` +
            `Intento (CUP): ${montoAplicadoVentaCUP.toFixed(2)}`
        )
      }

      // Crear la reconciliación
      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          tenantId: venta.tenantId,
          ventaId: validatedData.ventaId,
          cuentaId: validatedData.cuentaId,
          tipoPagoId: validatedData.tipoPagoId,
          monto: validatedData.monto,
          moneda: validatedData.moneda,
          ...(validatedData.tasaCambio != null && { tasaCambio: validatedData.tasaCambio }),
          montoConvertido: montoDestino,
          verificacionTransferenciaId: referenciaTransferencia,
          ...(validatedData.observaciones != null && { observaciones: validatedData.observaciones }),
          idTransferencia: referenciaTransferencia,
          reconciliadoPor: user.userId
        },
        include: {
          venta: {
            include: {
              producto: true,
              puntoDeVenta: true,
              empleado: true,
              factura: true,
              cliente: true
            }
          },
          cuentaBancaria: true,
          tipoPago: true
        }
      })

      // Actualizar el saldo de las cuentas bancarias
      const saldoIncrementoDestino = parseFloat(montoDestino.toString())

      if (cuentaOrigen && tipoPago.cuentaDefecto !== validatedData.cuentaId) {
        const montoOrigen = convertMontoToCuentaMoneda(
          montoBase,
          validatedData.moneda,
          cuentaOrigenLocked?.moneda || validatedData.moneda,
          tasaCambio
        )
        const saldoDecrementoOrigen = parseFloat(montoOrigen.toString())

        // Transferir: decrementar de cuenta origen e incrementar en cuenta destino
        await tx.cuentaBancaria.update({
          where: { cuentaId: tipoPago.cuentaDefecto! },
          data: {
            saldo: {
              decrement: saldoDecrementoOrigen
            }
          }
        })

        await tx.cuentaBancaria.update({
          where: { cuentaId: validatedData.cuentaId },
          data: {
            saldo: {
              increment: saldoIncrementoDestino
            }
          }
        })
      } else {
        // Solo incrementar en la cuenta destino
        await tx.cuentaBancaria.update({
          where: { cuentaId: validatedData.cuentaId },
          data: {
            saldo: {
              increment: saldoIncrementoDestino
            }
          }
        })
      }

      // Registrar la transacción de moneda si hubo tasa de cambio
      if (validatedData.tasaCambio) {
        await tx.transaccionMoneda.create({
          data: {
            tipoTransaccion: 'venta',
            referenciaId: validatedData.ventaId,
            monedaId: validatedData.moneda,
            montoOriginal: validatedData.monto,
            tasaCambio: validatedData.tasaCambio,
            montoConvertido: montoDestino
          }
        })
      }

      // --- Lógica de Cuentas por Cobrar ---
      const totalPagado = nuevoTotalPagado
      const saldoRestante = Math.max(0, totalVenta - totalPagado)
      
      // Determinar estado
      let nuevoEstado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA' = 'PENDIENTE'
      if (saldoRestante <= 0.01) {
        nuevoEstado = 'PAGADA'
      } else if (totalPagado > 0) {
        nuevoEstado = 'PARCIAL'
      }

      // Buscar si existe CuentaPorCobrar
      const ventaRec = venta
      if (!ventaRec) {
        throw createReconciliacionError(500, 'VENTA_NOT_FOUND', 'Venta no encontrada tras reconciliación')
      }
      const facturaId = ventaRec.factura?.idFactura
      
      // Solo procedemos si hay cliente (requisito de CxC)
      if (ventaRec.clienteId) {
        let existingCxC = null

        // 1) Prioridad a facturaId (clave única en CxC)
        if (facturaId) {
          existingCxC = await tx.cuentaPorCobrar.findUnique({
            where: { facturaId }
          })
        }

        // 2) Fallback por número de factura solo si no existe por facturaId
        if (!existingCxC) {
          const numeroFacturaCandidates = getNumeroFacturaCandidates(
            ventaRec.ordenId,
            ventaRec.factura?.numeroFactura
          )
          if (numeroFacturaCandidates.length > 0) {
            existingCxC = await tx.cuentaPorCobrar.findFirst({
              where: {
                numeroFactura: {
                  in: numeroFacturaCandidates
                }
              },
              orderBy: {
                updatedAt: 'desc'
              }
            })
          }
        }

        if (existingCxC) {
          // Actualizar existente
          await tx.cuentaPorCobrar.update({
            where: { id: existingCxC.id },
            data: {
              montoPagado: totalPagado,
              estado: nuevoEstado,
              // Actualizamos idTransferencia con el último pago para referencia rápida
              idTransferencia: referenciaTransferencia || existingCxC.idTransferencia
            }
          })
        } else if (saldoRestante > 0.01) {
          // Crear nueva CxC solo si hay deuda pendiente y no existe registro
          await tx.cuentaPorCobrar.create({
            data: {
              tenantId: venta.tenantId,
              clienteId: ventaRec.clienteId,
              facturaId: facturaId,
              numeroFactura: ventaRec.ordenId || ventaRec.factura?.numeroFactura, // Usar ordenId o factura
              montoDeuda: totalVenta,
              montoPagado: totalPagado,
              estado: nuevoEstado,
              idTransferencia: referenciaTransferencia
            }
          })
        }
      }

      return reconciliacion
    })

    // Auditoría no bloqueante para no devolver error si el log falla.
    try {
      await AuditLogService.log({
        accion: "CREATE",
        entidad: "RECONCILIACION",
        entidadId: result.reconciliacionId,
        usuarioId: user.userId,
        detalles: {
          tipo: "VENTA",
          ventaId: result.ventaId,
          cuenta: cuentaBancaria.nombreBanco,
          monto: result.monto,
          moneda: result.moneda,
          montoConvertido: result.montoConvertido,
          tipoPago: tipoPago.nombre
        }
      });
    } catch (auditError) {
      console.error('Error registrando auditoría de reconciliación de venta:', auditError)
    }

    return NextResponse.json({
      message: 'Venta reconciliada exitosamente',
      reconciliacion: result
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: error.errors },
        { status: 400 }
      )
    }

    const maybeValidationError = error as Error & {
      status?: number
      code?: string
    }
    if (maybeValidationError.status && maybeValidationError.code) {
      return NextResponse.json(
        { error: maybeValidationError.message, code: maybeValidationError.code },
        { status: maybeValidationError.status }
      )
    }

    console.error('Error reconciling sale:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
