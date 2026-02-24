
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verify_token } from "@/lib/auth-utils"

/**
 * @description Convierte un monto de pago a CUP para cálculos de saldo en CxC.
 * @param {number} monto - Monto original del pago.
 * @param {string | null | undefined} moneda - Moneda del pago.
 * @param {number | undefined} tasaCambio - Tasa opcional de cambio a CUP.
 * @returns {number} Monto normalizado en CUP.
 */
function normalizeMontoToCup(
  monto: number,
  moneda?: string | null,
  tasaCambio?: number
): number {
  if (moneda === 'CUP' || !moneda) {
    return monto
  }

  if (typeof tasaCambio === 'number' && Number.isFinite(tasaCambio) && tasaCambio > 0) {
    return monto * tasaCambio
  }

  return monto
}

export async function GET(request: NextRequest) {
  try {
    const user = await verify_token(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    
    const whereClause: any = {}
    if (estado) {
      whereClause.estado = estado
    }

    const cuentas = await prisma.cuentaPorCobrar.findMany({
      where: whereClause,
      include: {
        cliente: true,
        factura: {
          include: {
            venta: {
              include: {
                reconciliaciones: {
                  include: {
                    tipoPago: true,
                    cuentaBancaria: true
                  },
                  orderBy: {
                    fechaReconciliacion: 'desc'
                  }
                },
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const cuentasPorFactura: Record<string, any> = {}

    for (const cuenta of cuentas) {
      const key = cuenta.facturaId || cuenta.factura?.idFactura || cuenta.numeroFactura || cuenta.id
      const existing = cuentasPorFactura[key]

      if (!existing) {
        cuentasPorFactura[key] = cuenta
        continue
      }

      const existingUpdated = new Date(existing.updatedAt).getTime()
      const currentUpdated = new Date(cuenta.updatedAt).getTime()
      const prefer = currentUpdated >= existingUpdated ? cuenta : existing
      const other = prefer === cuenta ? existing : cuenta

      const estado = (() => {
        const estados = new Set([prefer.estado, other.estado])
        if (estados.has('PAGADA')) return 'PAGADA'
        if (estados.has('PARCIAL')) return 'PARCIAL'
        return 'PENDIENTE'
      })()

      cuentasPorFactura[key] = {
        ...prefer,
        cliente: prefer.cliente ?? other.cliente,
        factura: prefer.factura ?? other.factura,
        facturaId: prefer.facturaId ?? other.facturaId,
        numeroFactura: prefer.numeroFactura ?? other.numeroFactura,
        idTransferencia: prefer.idTransferencia ?? other.idTransferencia,
        montoDeuda:
          Number(prefer.montoDeuda) >= Number(other.montoDeuda) ? prefer.montoDeuda : other.montoDeuda,
        montoPagado:
          Number(prefer.montoPagado) >= Number(other.montoPagado) ? prefer.montoPagado : other.montoPagado,
        estado,
      }
    }

    const cuentasUnicas = Object.values(cuentasPorFactura)
      .map((cuenta: any) => {
        const totalFactura = Number(cuenta.factura?.total ?? cuenta.factura?.venta?.total ?? cuenta.montoDeuda ?? 0)
        const totalVenta = Number(cuenta.factura?.venta?.total ?? 0)
        const reconciliaciones = cuenta.factura?.venta?.reconciliaciones ?? []
        const totalPagadoFactura = (reconciliaciones as any[]).reduce(
          (sum, rec) => {
            const monto = Number(rec?.monto ?? 0)
            const moneda = rec?.moneda
            const tasaCambio = rec?.tasaCambio ? Number(rec.tasaCambio) : undefined
            return sum + normalizeMontoToCup(monto, moneda, tasaCambio)
          },
          0
        )
        const totalPagado = totalPagadoFactura > 0.01 ? totalPagadoFactura : Number(cuenta.montoPagado ?? 0)
        const saldoFactura = Math.max(0, totalFactura - totalPagado)

        return {
          ...cuenta,
          totalFactura,
          totalVenta,
          totalPagadoFactura: totalPagado,
          saldoFactura,
        }
      })
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ cuentas: cuentasUnicas })
  } catch (error) {
    console.error('Error fetching accounts receivable:', error)
    return NextResponse.json({ error: 'Error fetching accounts receivable' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verify_token(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    // Validation would go here

    const cuenta = await prisma.cuentaPorCobrar.create({
      data: {
        clienteId: body.clienteId,
        facturaId: body.facturaId,
        numeroFactura: body.numeroFactura,
        montoDeuda: body.montoDeuda,
        montoPagado: body.montoPagado || 0,
        idTransferencia: body.idTransferencia,
        estado: body.estado || 'PENDIENTE',
        fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : null
      }
    })

    return NextResponse.json({ cuenta }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating account receivable:', error)
    
    // Check for Prisma Foreign Key constraint violation (P2003)
    if (error.code === 'P2003') {
      const fieldName = error.meta?.field_name as string
      if (fieldName?.includes('facturaId')) {
        return NextResponse.json({ error: 'La factura especificada no existe o es inválida.' }, { status: 400 })
      }
      return NextResponse.json({ error: 'El cliente especificado no existe o es inválido.' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Error creating account receivable' }, { status: 500 })
  }
}
