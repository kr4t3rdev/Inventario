import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'
import { z } from 'zod'
import {
  applyPagoGastoWorkflow,
  isGastoWorkflowError
} from '@/lib/services/pago-gastos-workflow'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'

const pagarSchema = z.object({
  numeroFactura: z.string().min(1),
  tipo: z.enum(['compra', 'servicio']),
  monto: z.number().positive(),
  numeroTransaccion: z.string().min(1),
  cuentaProveedor: z.string().min(1),
  fechaPago: z.string().optional(),
  observaciones: z.string().optional()
})

/**
 * @description Registra un pago de cuenta por pagar por número de factura.
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Resultado del pago
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    // Validar que el período permite operaciones
    await assertOperationAllowed(new Date(), 'PAGO_CUENTA_POR_PAGAR')

    const body = pagarSchema.parse(await request.json())

    await assertOperationAllowed(new Date(), 'PAGO_CUENTA_POR_PAGAR')

    const result = await prisma.$transaction(async (tx) => {
      let cuenta = await tx.cuentaPorPagar.findFirst({
        where: {
          numeroFactura: body.numeroFactura,
          tipo: body.tipo
        }
      })
      let referenciaId: string | null = null
      let gastoCompraId: string | undefined
      let gastosDEId: string | undefined
      let periodo: string | undefined

      if (!cuenta) {
        if (body.tipo === 'compra') {
          const compra = await tx.gastoCompra.findFirst({
            where: { numeroFactura: body.numeroFactura },
            include: { vendor: true }
          })

          if (!compra) {
            throw new Error('COMPRA_NOT_FOUND')
          }

          cuenta = await tx.cuentaPorPagar.create({
            data: {
              numeroFactura: body.numeroFactura,
              tipo: 'compra',
              gastoCompraId: compra.gastoCompraId,
              proveedorId: compra.vendorId,
              proveedorNombre: compra.vendor?.nombre || null,
              montoDeuda: Number(compra.total),
              montoPagado: 0,
              saldoPendiente: Number(compra.total),
              moneda: 'CUP',
              fechaEmision: compra.fechaCompra ?? compra.createdAt
            }
          })
          referenciaId = compra.gastoCompraId
          gastoCompraId = compra.gastoCompraId
        }

        if (body.tipo === 'servicio') {
          const gasto = await tx.gastosDE.findFirst({
            where: { numeroFactura: body.numeroFactura },
            select: {
              gastosDEId: true,
              proveedor: true,
              monto: true,
              createdAt: true,
              periodo: true
            }
          })

          if (!gasto) {
            throw new Error('SERVICIO_NOT_FOUND')
          }

          cuenta = await tx.cuentaPorPagar.create({
            data: {
              numeroFactura: body.numeroFactura,
              tipo: 'servicio',
              gastosDEId: gasto.gastosDEId,
              proveedorNombre: gasto.proveedor || null,
              montoDeuda: Number(gasto.monto),
              montoPagado: 0,
              saldoPendiente: Number(gasto.monto),
              moneda: 'CUP',
              fechaEmision: gasto.createdAt
            }
          })
          referenciaId = gasto.gastosDEId
          gastosDEId = gasto.gastosDEId
          periodo = gasto.periodo || undefined
        }
      }

      if (!cuenta) {
        throw new Error('CUENTA_NOT_FOUND')
      }

      if (!referenciaId && body.tipo === 'compra' && cuenta.gastoCompraId) {
        referenciaId = cuenta.gastoCompraId
        gastoCompraId = cuenta.gastoCompraId
      }

      if (!referenciaId && body.tipo === 'servicio' && cuenta.gastosDEId) {
        referenciaId = cuenta.gastosDEId
        gastosDEId = cuenta.gastosDEId
      }

      if (!referenciaId && body.tipo === 'compra') {
        const compra = await tx.gastoCompra.findFirst({
          where: { numeroFactura: body.numeroFactura },
          select: { gastoCompraId: true }
        })
        if (!compra) {
          throw new Error('COMPRA_NOT_FOUND')
        }
        referenciaId = compra.gastoCompraId
        gastoCompraId = compra.gastoCompraId
      }

      if (!referenciaId && body.tipo === 'servicio') {
        const gasto = await tx.gastosDE.findFirst({
          where: { numeroFactura: body.numeroFactura },
          select: { gastosDEId: true, periodo: true }
        })
        if (!gasto) {
          throw new Error('SERVICIO_NOT_FOUND')
        }
        referenciaId = gasto.gastosDEId
        gastosDEId = gasto.gastosDEId
        periodo = gasto.periodo || undefined
      }

      if (!referenciaId) {
        throw new Error('REFERENCIA_NO_ENCONTRADA')
      }

      const workflowResult = await applyPagoGastoWorkflow(tx, {
        tipoGasto: body.tipo === 'compra' ? 'compra' : 'gastoDE',
        referenciaId,
        reconciliadoPor: user.userId,
        descripcion:
          body.observaciones?.trim() ||
          `Pago de cuenta por pagar - factura ${body.numeroFactura}`,
        monto: Number(body.monto),
        moneda: cuenta.moneda || 'CUP',
        observaciones: body.observaciones,
        estado: 'PAGADA',
        cuentaPorPagarId: cuenta.cuentaPorPagarId,
        numeroTransaccion: body.numeroTransaccion,
        cuentaProveedor: body.cuentaProveedor,
        fechaPago: body.fechaPago,
        gastoCompraId: body.tipo === 'compra' ? (gastoCompraId || cuenta.gastoCompraId || undefined) : undefined,
        gastosDEId: body.tipo === 'servicio' ? (gastosDEId || cuenta.gastosDEId || undefined) : undefined,
        periodo
      })

      if (!workflowResult.pagoCuentaPorPagar) {
        throw new Error('PAGO_NO_REGISTRADO')
      }

      const [cuentaActualizada, pagoRegistrado] = await Promise.all([
        tx.cuentaPorPagar.findUnique({
          where: { cuentaPorPagarId: cuenta.cuentaPorPagarId }
        }),
        tx.pagoCuentaPorPagar.findUnique({
          where: { pagoCuentaPorPagarId: workflowResult.pagoCuentaPorPagar.pagoCuentaPorPagarId }
        })
      ])

      if (!cuentaActualizada || !pagoRegistrado) {
        throw new Error('PAGO_NO_REGISTRADO')
      }

      return { cuenta: cuentaActualizada, pago: pagoRegistrado, reconciliaciones: workflowResult.reconciliaciones }
    })

    // Registrar evento contable
    await registrarEventoContable({
      origenTipo: 'PAGO_CUENTA_POR_PAGAR',
      origenId: result.cuenta.cuentaPorPagarId,
      monto: body.monto,
      fechaOperacion: new Date(),
      descripcion: `Pago de cuenta por pagar - factura ${body.numeroFactura}`,
      usuarioId: user.userId
    })

    await AuditLogService.log({
      accion: 'UPDATE',
      entidad: 'CUENTA_POR_PAGAR',
      entidadId: result.cuenta.cuentaPorPagarId,
      usuarioId: user.userId,
      detalles: {
        monto: body.monto,
        numeroTransaccion: body.numeroTransaccion,
        cuentaProveedor: body.cuentaProveedor
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    if (isPeriodoOperacionError(error)) {
      return NextResponse.json(serializePeriodoOperacionError(error), { status: error.status })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }

    if (isGastoWorkflowError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }

    if (error instanceof Error) {
      if (error.message === 'COMPRA_NOT_FOUND') {
        return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
      }
      if (error.message === 'SERVICIO_NOT_FOUND') {
        return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
      }
      if (error.message === 'MONTO_EXCEDE_SALDO') {
        return NextResponse.json({ error: 'El monto excede el saldo pendiente' }, { status: 400 })
      }
      if (error.message === 'CUENTA_NOT_FOUND') {
        return NextResponse.json({ error: 'Cuenta por pagar no encontrada' }, { status: 404 })
      }
      if (error.message === 'REFERENCIA_NO_ENCONTRADA') {
        return NextResponse.json({ error: 'No se encontró la referencia del gasto de la factura' }, { status: 404 })
      }
    }

    console.error('Error al registrar pago de cuenta por pagar:', error)
    return NextResponse.json({ error: 'Error al registrar el pago' }, { status: 500 })
  }
}
