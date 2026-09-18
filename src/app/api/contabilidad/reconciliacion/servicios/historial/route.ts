import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'
import { requireTenant } from '@/lib/services/tenant-scope'

// GET - Obtener historial de reconciliaciones de servicios
export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const tenantId = requireTenant(authResultUser.user)
    const { searchParams } = new URL(request.url)
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const cuentaId = searchParams.get('cuentaId')
    const tipoPagoId = searchParams.get('tipoPagoId')
    const reconciliadoPor = searchParams.get('reconciliadoPor')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // Construir filtros
    const whereClause: {
      fechaReconciliacion?: {
        gte?: Date
        lte?: Date
      }
      cuentaId?: string
      tipoPagoId?: string
      reconciliadoPor?: string
      tenantId: string
    } = { tenantId }

    if (fechaDesde || fechaHasta) {
      whereClause.fechaReconciliacion = {}
      if (fechaDesde) {
        whereClause.fechaReconciliacion.gte = new Date(fechaDesde)
      }
      if (fechaHasta) {
        whereClause.fechaReconciliacion.lte = new Date(fechaHasta)
      }
    }

    if (cuentaId) {
      whereClause.cuentaId = cuentaId
    }

    if (tipoPagoId) {
      whereClause.tipoPagoId = tipoPagoId
    }

    if (reconciliadoPor) {
      whereClause.reconciliadoPor = reconciliadoPor
    }

    // Obtener historial de reconciliaciones
    const [reconciliaciones, total] = await Promise.all([
      prisma.reconciliacionServicio.findMany({
        where: whereClause,
        include: {
          ventasServicio: {
            include: {
              servicio: {
                select: {
                  servicioId: true,
                  nombre: true,
                  precio: true,
                  descripcion: true
                }
              }
            }
          },
          cuentaBancaria: {
            select: {
              nombreBanco: true,
              numeroCuenta: true,
              moneda: true
            }
          },
          tipoPago: {
            select: {
              nombre: true,
              descripcion: true
            }
          }
        },
        orderBy: {
          fechaReconciliacion: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.reconciliacionServicio.count({
        where: whereClause
      })
    ])

    // Calcular estadísticas del período
    const estadisticas = await prisma.reconciliacionServicio.aggregate({
      where: whereClause,
      _sum: {
        monto: true,
        montoConvertido: true
      },
      _count: {
        reconciliacionId: true
      }
    })

    // Agrupar por moneda
    const porMoneda = await prisma.reconciliacionServicio.groupBy({
      by: ['moneda'],
      where: whereClause,
      _sum: {
        monto: true,
        montoConvertido: true
      },
      _count: {
        reconciliacionId: true
      }
    })

    // Agrupar por tipo de pago
    const porTipoPago = await prisma.reconciliacionServicio.groupBy({
      by: ['tipoPagoId'],
      where: whereClause,
      _sum: {
        monto: true,
        montoConvertido: true
      },
      _count: {
        reconciliacionId: true
      }
    })

    // Obtener nombres de tipos de pago para el resumen
    const tiposPagoInfo = await prisma.tipoPago.findMany({
      where: {
        tenantId,
        tipoId: {
          in: porTipoPago.map((tp: { tipoPagoId: string }) => tp.tipoPagoId)
        }
      },
      select: {
        tipoId: true,
        nombre: true
      }
    })

    const resumenTiposPago = porTipoPago.map((tp: { tipoPagoId: string; _sum: { monto: unknown; montoConvertido: unknown }; _count: { reconciliacionId: number } }) => ({
      ...tp,
      nombre: tiposPagoInfo.find((info: { tipoId: string }) => info.tipoId === tp.tipoPagoId)?.nombre || 'Desconocido'
    }))

    // Agrupar por cuenta bancaria
    const porCuenta = await prisma.reconciliacionServicio.groupBy({
      by: ['cuentaId'],
      where: whereClause,
      _sum: {
        monto: true,
        montoConvertido: true
      },
      _count: {
        reconciliacionId: true
      }
    })

    // Obtener información de cuentas bancarias para el resumen
    const cuentasInfo = await prisma.cuentaBancaria.findMany({
      where: {
        cuentaId: {
          in: porCuenta.map((c: { cuentaId: string }) => c.cuentaId)
        }
      },
      select: {
        cuentaId: true,
        nombreBanco: true,
        numeroCuenta: true,
        moneda: true
      }
    })

    const resumenCuentas = porCuenta.map((c: { cuentaId: string; _sum: { monto: unknown; montoConvertido: unknown }; _count: { reconciliacionId: number } }) => ({
      ...c,
      cuenta: cuentasInfo.find((info: { cuentaId: string }) => info.cuentaId === c.cuentaId) || null
    }))

    return NextResponse.json({
      reconciliaciones,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      estadisticas: {
        totalReconciliaciones: estadisticas._count.reconciliacionId || 0,
        montoTotal: estadisticas._sum.monto || 0,
        montoConvertidoTotal: estadisticas._sum.montoConvertido || 0,
        porMoneda,
        porTipoPago: resumenTiposPago,
        porCuenta: resumenCuentas
      }
    })

  } catch (error) {
    console.error('Error fetching services reconciliation history:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}