import { NextRequest, NextResponse } from 'next/server'

import prisma from '@/lib/prisma'
import { withAuthGet } from '@/lib/auth-middleware'

function prestamosCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH !== 'false'
}

function toNumber(value: unknown): number {
  return Number(value ?? 0)
}

export const GET = withAuthGet(async (_request: NextRequest, context: unknown) => {
  try {
    if (!prestamosCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
    }

    const { params } = context as { params: Promise<{ id: string }> }
    const { id } = await params

    const prestamo = await prisma.prestamoCash.findFirst({
      where: { id, deletedAt: null },
      include: {
        cliente: { select: { clienteId: true, nombre: true } },
        cuentaPorCobrar: true,
      },
    })

    if (!prestamo) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })
    }

    const historial = await prisma.reconciliacionVenta.findMany({
      where: {
        prestamoCashId: id,
        tipoReconciliacion: 'PRESTAMO_CASH',
      },
      include: {
        cuentaBancaria: {
          select: {
            nombreBanco: true,
            numeroCuenta: true,
          },
        },
        tipoPago: {
          select: {
            nombre: true,
          },
        },
      },
      orderBy: { fechaReconciliacion: 'desc' },
    })

    const montoCapital = toNumber(prestamo.montoCapital)
    const totalDeuda = toNumber(prestamo.cuentaPorCobrar.montoDeuda)
    const montoPagado = toNumber(prestamo.cuentaPorCobrar.montoPagado)
    const saldoPendiente = totalDeuda - montoPagado

    return NextResponse.json({
      prestamo: {
        ...prestamo,
        montoCapital,
        tasaInteres: prestamo.tasaInteres != null ? toNumber(prestamo.tasaInteres) : null,
        cuentaPorCobrar: {
          ...prestamo.cuentaPorCobrar,
          montoDeuda: totalDeuda,
          montoPagado,
        },
      },
      resumen: {
        montoCapital,
        totalDeuda,
        montoPagado,
        saldoPendiente,
        cantidadPagos: historial.length,
      },
      historial: historial.map((pago) => ({
        id: pago.reconciliacionId,
        fecha: pago.fechaReconciliacion,
        monto: toNumber(pago.monto),
        moneda: pago.moneda,
        tasaCambio: pago.tasaCambio != null ? toNumber(pago.tasaCambio) : null,
        montoConvertido: pago.montoConvertido != null ? toNumber(pago.montoConvertido) : null,
        observaciones: pago.observaciones,
        tipoPago: pago.tipoPago.nombre,
        cuentaBancaria: `${pago.cuentaBancaria.nombreBanco} - ${pago.cuentaBancaria.numeroCuenta}`,
      })),
    })
  } catch (error) {
    console.error('Error obteniendo historial de préstamo cash:', error)
    return NextResponse.json({ error: 'Error obteniendo historial de préstamo cash' }, { status: 500 })
  }
})
