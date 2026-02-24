import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verify_token } from '@/lib/auth-utils'

// GET - Obtener historial de reconciliaciones de gastos
export async function GET(request: NextRequest) {
  try {
    const user = await verify_token(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tipoGasto = searchParams.get('tipoGasto') // 'salario', 'gastoDE', 'compra'
    const cuentaId = searchParams.get('cuentaId')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const periodo = searchParams.get('periodo')
    const reconciliadoPor = searchParams.get('reconciliadoPor')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // Construir filtros
    const whereClause: {
      tipoGasto?: string
      cuentaId?: string
      periodo?: string
      reconciliadoPor?: string
      fechaReconciliacion?: {
        gte?: Date
        lte?: Date
      }
    } = {}

    if (tipoGasto) {
      whereClause.tipoGasto = tipoGasto
    }

    if (cuentaId) {
      whereClause.cuentaId = cuentaId
    }

    if (periodo) {
      whereClause.periodo = periodo
    }

    if (reconciliadoPor) {
      whereClause.reconciliadoPor = reconciliadoPor
    }

    if (fechaDesde || fechaHasta) {
      whereClause.fechaReconciliacion = {}
      if (fechaDesde) {
        whereClause.fechaReconciliacion.gte = new Date(fechaDesde)
      }
      if (fechaHasta) {
        whereClause.fechaReconciliacion.lte = new Date(fechaHasta)
      }
    }

    // Obtener reconciliaciones con información relacionada
    const [reconciliaciones, total] = await Promise.all([
      prisma.reconciliacionGasto.findMany({
        where: whereClause,
        include: {
          cuentaBancaria: {
            select: {
              cuentaId: true,
              nombreBanco: true,
              numeroCuenta: true,
              tipoCuenta: true,
              moneda: true
            }
          },
          tipoPago: {
            select: {
              tipoId: true,
              nombre: true,
              descripcion: true
            }
          },
          pagoSalario: {
            include: {
              empleado: {
                select: {
                  empleadoId: true,
                  nombre: true,
                  apellido: true,
                  cargo: true
                }
              }
            }
          },
          gastoDE: {
            select: {
              gastosDEId: true,
              tipo: true,
              proveedor: true,
              monto: true,
              periodo: true
            }
          },
          gastoCompra: {
            select: {
              gastoCompraId: true,
              cantidad: true,
              precioUnitario: true,
              total: true,
              fechaCompra: true,
              producto: {
                select: {
                  nombre: true
                }
              },
              vendor: {
                select: {
                  nombre: true
                }
              }
            }
          }
        },
        orderBy: {
          fechaReconciliacion: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.reconciliacionGasto.count({
        where: whereClause
      })
    ])

    // Enriquecer con información de la referencia según el tipo de gasto
    const reconciliacionesEnriquecidas = await Promise.all(
      reconciliaciones.map(async (reconciliacion: any) => {
        let detallesReferencia = null

        try {
          switch (reconciliacion.tipoGasto) {
            case 'salario':
              if (reconciliacion.pagoSalario?.empleado) {
                const empleado = await prisma.empleado.findUnique({
                  where: { empleadoId: reconciliacion.pagoSalario.empleado.empleadoId },
                  select: {
                    empleadoId: true,
                    nombre: true,
                    apellido: true,
                    cargo: true,
                    salarioBases: true
                  }
                })
                detallesReferencia = {
                  ...empleado,
                  pago: reconciliacion.pagoSalario
                }
              }
              break

            case 'gastoDE':
              if (reconciliacion.gastosDEId) {
                const gastoDE = await prisma.gastosDE.findUnique({
                  where: { gastosDEId: reconciliacion.gastosDEId },
                  select: {
                    gastosDEId: true,
                    tipo: true,
                    proveedor: true,
                    monto: true,
                    periodo: true,
                    descripcion: true,
                    isPagado: true
                  }
                })
                detallesReferencia = gastoDE
              }
              break

            case 'compra':
              if (reconciliacion.gastoCompraId) {
                const compra = await prisma.gastoCompra.findUnique({
                  where: { gastoCompraId: reconciliacion.gastoCompraId },
                  include: {
                    producto: {
                      select: {
                        nombre: true
                      }
                    },
                    vendor: {
                      select: {
                        nombre: true
                      }
                    }
                  }
                })
                detallesReferencia = compra
              }
              break
          }
        } catch (error) {
          console.warn(`Error fetching reference details for ${reconciliacion.tipoGasto} ${reconciliacion.referenciaId}:`, error)
        }

        return {
          ...reconciliacion,
          detallesReferencia
        }
      })
    )

    // Calcular estadísticas del período
    const estadisticas = await prisma.reconciliacionGasto.groupBy({
      by: ['tipoGasto', 'moneda'],
      where: whereClause,
      _sum: {
        monto: true,
        montoConvertido: true
      },
      _count: {
        reconciliacionId: true
      }
    })

    // Calcular totales por cuenta bancaria
    const totalesPorCuenta = await prisma.reconciliacionGasto.groupBy({
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

    // Obtener información de las cuentas para los totales
    const cuentasInfo = await prisma.cuentaBancaria.findMany({
      where: {
        cuentaId: {
          in: totalesPorCuenta.map((t: { cuentaId: string }) => t.cuentaId)
        }
      },
      select: {
        cuentaId: true,
        nombreBanco: true,
        numeroCuenta: true,
        moneda: true
      }
    })

    const totalesPorCuentaEnriquecidos = totalesPorCuenta.map((total: { cuentaId: string; _sum: { monto: unknown; montoConvertido: unknown }; _count: { reconciliacionId: number } }) => ({
      ...total,
      cuenta: cuentasInfo.find((c: { cuentaId: string }) => c.cuentaId === total.cuentaId)
    }))

    return NextResponse.json({
      reconciliaciones: reconciliacionesEnriquecidas,
      estadisticas: {
        porTipoGasto: estadisticas,
        porCuenta: totalesPorCuentaEnriquecidos,
        totalGeneral: {
          cantidad: total,
          montoTotal: estadisticas.reduce((sum: number, stat: { _sum: { monto: unknown } }) => sum + Number(stat._sum.monto || 0), 0),
          montoConvertidoTotal: estadisticas.reduce((sum: number, stat: { _sum: { montoConvertido: unknown } }) => sum + Number(stat._sum.montoConvertido || 0), 0)
        }
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching expense reconciliation history:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
