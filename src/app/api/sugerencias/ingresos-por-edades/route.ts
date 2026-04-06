
import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateUser } from "@/lib/auth-middleware"

export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const cuentas = await prisma.cuentaPorCobrar.findMany({
      where: {
        estado: {
          not: 'PAGADA'
        }
      },
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

    const clientesMap = new Map<string, {
      clienteId: string,
      nombre: string,
      corriente: number,
      dias30: number,
      dias60: number,
      dias90: number,
      dias120: number,
      total: number
    }>()

    const facturas: Array<{
      id: string
      numero: string | null
      cliente: string
      fecha: string
      dias: number
      saldo: number
      categoria: 'Corriente' | '30-60 Días' | '60-90 Días' | '90-120 Días' | '+120 Días'
    }> = []

    const now = new Date()

    for (const cuenta of cuentas) {
      if (!cuenta.clienteId) continue

      // Helper para convertir Decimal/null a number
      const toNum = (val: any) => {
        if (!val) return 0
        if (typeof val === 'object' && 'toNumber' in val) return val.toNumber()
        return Number(val)
      }

      // Calcular saldo pendiente real
      const facturaTotal = cuenta.factura?.total
      const ventaTotal = cuenta.factura?.venta?.total
      const deudaTotal = cuenta.montoDeuda

      const totalFactura = toNum(facturaTotal ?? ventaTotal ?? deudaTotal)
      
      const reconciliaciones = cuenta.factura?.venta?.reconciliaciones ?? []
      const totalPagadoFactura = (reconciliaciones as any[]).reduce(
        (sum, rec) => sum + toNum(rec?.monto),
        0
      )
      
      // Usar el mayor entre lo registrado en reconciliaciones y lo que dice el campo montoPagado
      const totalPagado = Math.max(totalPagadoFactura, toNum(cuenta.montoPagado))
      
      const saldoPendiente = Math.max(0, totalFactura - totalPagado)

      if (saldoPendiente <= 0.01) continue // Ignorar saldos despreciables

      // Calcular antigüedad
      const fechaReferencia = new Date(cuenta.createdAt)
      const diffTime = Math.abs(now.getTime() - fechaReferencia.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      let bucket: 'Corriente' | '30-60 Días' | '60-90 Días' | '90-120 Días' | '+120 Días' = 'Corriente'

      // Inicializar entrada del cliente si no existe
      if (!clientesMap.has(cuenta.clienteId)) {
        clientesMap.set(cuenta.clienteId, {
          clienteId: cuenta.clienteId,
          nombre: cuenta.cliente.nombre,
          corriente: 0,
          dias30: 0,
          dias60: 0,
          dias90: 0,
          dias120: 0,
          total: 0
        })
      }

      const clienteData = clientesMap.get(cuenta.clienteId)!

      // Clasificar por edad
      if (diffDays <= 30) {
        clienteData.corriente += saldoPendiente
        bucket = 'Corriente'
      } else if (diffDays <= 60) {
        clienteData.dias30 += saldoPendiente
        bucket = '30-60 Días'
      } else if (diffDays <= 90) {
        clienteData.dias60 += saldoPendiente
        bucket = '60-90 Días'
      } else if (diffDays <= 120) {
        clienteData.dias90 += saldoPendiente
        bucket = '90-120 Días'
      } else {
        clienteData.dias120 += saldoPendiente
        bucket = '+120 Días'
      }

      clienteData.total += saldoPendiente

      facturas.push({
        id: cuenta.facturaId || cuenta.id,
        numero: cuenta.factura?.numeroFactura || cuenta.numeroFactura || 'S/N',
        cliente: cuenta.cliente.nombre,
        fecha: cuenta.createdAt.toISOString(),
        dias: diffDays,
        saldo: saldoPendiente,
        categoria: bucket
      })
    }

    const reporte = Array.from(clientesMap.values()).sort((a, b) => b.total - a.total)
    // Ordenar facturas por antigüedad descendente
    facturas.sort((a, b) => b.dias - a.dias)

    console.log(`[IngresosEdades] Generated ${reporte.length} clients and ${facturas.length} invoices`)

    return NextResponse.json({ reporte, facturas })
  } catch (error) {
    console.error('Error fetching aging report:', error)
    return NextResponse.json({ error: 'Error fetching aging report' }, { status: 500 })
  }
}
