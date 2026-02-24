import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verify_token } from '@/lib/auth-utils'

// GET - Obtener historial de reconciliaciones de ventas
export async function GET(request: NextRequest) {
  try {
    const user = await verify_token(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fechaDesde = searchParams.get('fechaDesde') || searchParams.get('fechaInicio')
    const fechaHasta = searchParams.get('fechaHasta') || searchParams.get('fechaFin')
    const cuentaId = searchParams.get('cuentaId')
    const tipoPagoId = searchParams.get('tipoPagoId')
    const puntoDeVentaId = searchParams.get('puntoDeVentaId')
    const reconciliadoPor = searchParams.get('reconciliadoPor')
    const pageParam = parseInt(searchParams.get('page') || '1', 10)
    const limitParam = parseInt(searchParams.get('limit') || '50', 10)
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
    const normalizedLimit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50
    const limit = Math.min(200, normalizedLimit)
    const skip = (page - 1) * limit

    // Construir filtros
    const whereClause: any = {}

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

    if (puntoDeVentaId) {
      whereClause.venta = {
        puntoDeVentaId: puntoDeVentaId
      }
    }

    // Obtener historial de reconciliaciones
    const [reconciliaciones, total] = await Promise.all([
      prisma.reconciliacionVenta.findMany({
        where: whereClause,
        include: {
          venta: {
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
      prisma.reconciliacionVenta.count({
        where: whereClause
      })
    ])

    // Calcular estadísticas del período
    const estadisticas = await prisma.reconciliacionVenta.aggregate({
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
    const porMoneda = await prisma.reconciliacionVenta.groupBy({
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
    const porTipoPago = await prisma.reconciliacionVenta.groupBy({
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
        porTipoPago: resumenTiposPago
      }
    })

  } catch (error) {
    console.error('Error fetching sales reconciliation history:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
