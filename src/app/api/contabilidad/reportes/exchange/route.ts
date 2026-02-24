import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verify_token } from '@/lib/auth-utils'

interface EstadisticaConversion {
  totalTransacciones: number
  montoTotalOriginal: number
  montoTotalConvertido: number
  tasaPromedio: number
  tasaMinima: number
  tasaMaxima: number
}

interface Conversion {
  id: string
  tipo: string
  fecha: Date
  montoOriginal: number
  monedaOriginal: string
  montoConvertido: number
  monedaDestino: string
  tasaCambio: number
  referencia: string | null
  descripcion: string
}

interface TasaCambioHistorial {
  tasaId: string
  monedaOrigen: {
    codigo: string
    nombre: string
    simbolo: string
  }
  monedaDestino: string
  tasa: number
  fechaVigencia: Date
}

export async function GET(request: NextRequest) {
  try {
    const user = await verify_token(request)
    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fechaInicio = searchParams.get('fechaInicio')
    const fechaFin = searchParams.get('fechaFin')
    const monedaOrigen = searchParams.get('monedaOrigen')
    const monedaDestino = searchParams.get('monedaDestino')
    const export_format = searchParams.get('export') // 'csv' or 'pdf'

    // Construir filtros de fecha
    const dateFilter: Record<string, Date> = {}
    if (fechaInicio) {
      dateFilter.gte = new Date(fechaInicio)
    }
    if (fechaFin) {
      dateFilter.lte = new Date(fechaFin)
    }

    // Obtener historial de tasas de cambio
    const historialTasas = await prisma.tasaCambio.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 ? { fechaVigencia: dateFilter } : {}),
        ...(monedaOrigen ? { monedaOrigenId: monedaOrigen } : {}),
        ...(monedaDestino ? { monedaDestino } : {})
      },
      include: {
        monedaOrigen: {
          select: {
            codigo: true,
            nombre: true,
            simbolo: true
          }
        }
      },
      orderBy: { fechaVigencia: 'desc' }
    })

    // Obtener transacciones con conversión de moneda
    const transaccionesConversion = await prisma.transaccionMoneda.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        ...(monedaOrigen ? { monedaId: monedaOrigen } : {})
      },
      include: {
        moneda: {
          select: {
            codigo: true,
            nombre: true,
            simbolo: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Obtener reconciliaciones con conversión de moneda
    const reconciliacionesConConversion = await Promise.all([
      // Ventas con conversión
      prisma.reconciliacionVenta.findMany({
        where: {
          tasaCambio: { not: null },
          ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}),
          ...(monedaOrigen ? { moneda: monedaOrigen } : {})
        },
        select: {
          reconciliacionId: true,
          monto: true,
          moneda: true,
          montoConvertido: true,
          tasaCambio: true,
          fechaReconciliacion: true,
          venta: {
            select: {
              ventaId: true
            }
          }
        }
      }),
      // Servicios con conversión
      prisma.reconciliacionServicio.findMany({
        where: {
          tasaCambio: { not: null },
          ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}),
          ...(monedaOrigen ? { moneda: monedaOrigen } : {})
        },
        select: {
          reconciliacionId: true,
          monto: true,
          moneda: true,
          montoConvertido: true,
          tasaCambio: true,
          fechaReconciliacion: true,
          ventasServicio: {
            select: {
              ventaServicioId: true
            }
          }
        }
      }),
      // Gastos con conversión
      prisma.reconciliacionGasto.findMany({
        where: {
          tasaCambio: { not: null },
          ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}),
          ...(monedaOrigen ? { moneda: monedaOrigen } : {})
        },
        select: {
          reconciliacionId: true,
          monto: true,
          moneda: true,
          montoConvertido: true,
          tasaCambio: true,
          tipoGasto: true,
          descripcion: true,
          fechaReconciliacion: true
        }
      }),
      // Ajustes con conversión
      prisma.ajusteBancario.findMany({
        where: {
          tasaCambio: { not: null },
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
          ...(monedaOrigen ? { moneda: monedaOrigen } : {})
        },
        select: {
          ajusteId: true,
          tipo: true,
          monto: true,
          moneda: true,
          montoConvertido: true,
          tasaCambio: true,
          descripcion: true,
          createdAt: true
        }
      }),
      // Transferencias con conversión
      prisma.transferenciaBancaria.findMany({
        where: {
          tasaCambio: { not: null },
          ...(Object.keys(dateFilter).length > 0 ? { fechaTransferencia: dateFilter } : {}),
          ...(monedaOrigen ? { monedaOrigen } : {})
        },
        select: {
          transferenciaId: true,
          numeroComprobante: true,
          montoOrigen: true,
          monedaOrigen: true,
          montoDestino: true,
          monedaDestino: true,
          tasaCambio: true,
          motivo: true,
          fechaTransferencia: true,
          cuentaOrigen: {
            select: {
              nombreBanco: true,
              numeroCuenta: true
            }
          },
          cuentaDestino: {
            select: {
              nombreBanco: true,
              numeroCuenta: true
            }
          }
        }
      })
    ])

    // Normalizar conversiones a formato común
    const conversiones = [
      ...reconciliacionesConConversion[0].map((rec: any) => ({
        id: rec.reconciliacionId,
        tipo: 'venta',
        fecha: rec.fechaReconciliacion,
        montoOriginal: Number(rec.monto),
        monedaOriginal: rec.moneda || 'CUP',
        montoConvertido: Number(rec.montoConvertido || 0),
        monedaDestino: 'CUP',
        tasaCambio: Number(rec.tasaCambio || 0),
        referencia: rec.venta.ventaId,
        descripcion: `Venta ${rec.venta.ventaId}`
      })),
      ...reconciliacionesConConversion[1].map((rec: any) => ({
        id: rec.reconciliacionId,
        tipo: 'servicio',
        fecha: rec.fechaReconciliacion,
        montoOriginal: Number(rec.monto),
        monedaOriginal: rec.moneda || 'CUP',
        montoConvertido: Number(rec.montoConvertido || 0),
        monedaDestino: 'CUP',
        tasaCambio: Number(rec.tasaCambio || 0),
        referencia: rec.ventasServicio.ventaServicioId,
        descripcion: `Servicio ${rec.ventasServicio.ventaServicioId}`
      })),
      ...reconciliacionesConConversion[2].map((rec: any) => ({
        id: rec.reconciliacionId,
        tipo: 'gasto',
        fecha: rec.fechaReconciliacion,
        montoOriginal: Number(rec.monto),
        monedaOriginal: rec.moneda || 'CUP',
        montoConvertido: Number(rec.montoConvertido || 0),
        monedaDestino: 'CUP',
        tasaCambio: Number(rec.tasaCambio || 0),
        referencia: rec.reconciliacionId,
        descripcion: `${rec.tipoGasto}: ${rec.descripcion}`
      })),
      ...reconciliacionesConConversion[3].map((rec: any) => ({
        id: rec.ajusteId,
        tipo: 'ajuste',
        fecha: rec.createdAt,
        montoOriginal: Number(rec.monto),
        monedaOriginal: rec.moneda || 'CUP',
        montoConvertido: Number(rec.montoConvertido || 0),
        monedaDestino: 'CUP',
        tasaCambio: Number(rec.tasaCambio || 0),
        referencia: rec.ajusteId,
        descripcion: `Ajuste ${rec.tipo}: ${rec.descripcion}`
      })),
      ...reconciliacionesConConversion[4].map((rec: any) => ({
        id: rec.transferenciaId,
        tipo: 'transferencia',
        fecha: rec.fechaTransferencia,
        montoOriginal: Number(rec.montoOrigen),
        monedaOriginal: rec.monedaOrigen || 'CUP',
        montoConvertido: Number(rec.montoDestino),
        monedaDestino: rec.monedaDestino || 'CUP',
        tasaCambio: Number(rec.tasaCambio || 0),
        referencia: rec.numeroComprobante,
        descripcion: `Transferencia: ${rec.motivo}`
      }))
    ]

    // Ordenar por fecha descendente
    conversiones.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

    // Calcular estadísticas de conversión
    const estadisticasConversion = conversiones.reduce((acc, conv) => {
      const moneda = conv.monedaOriginal
      if (!acc[moneda]) {
        acc[moneda] = {
          totalTransacciones: 0,
          montoTotalOriginal: 0,
          montoTotalConvertido: 0,
          tasaPromedio: 0,
          tasaMinima: Number.MAX_VALUE,
          tasaMaxima: 0
        }
      }
      
      acc[moneda].totalTransacciones++
      acc[moneda].montoTotalOriginal += conv.montoOriginal
      acc[moneda].montoTotalConvertido += conv.montoConvertido
      acc[moneda].tasaMinima = Math.min(acc[moneda].tasaMinima, conv.tasaCambio)
      acc[moneda].tasaMaxima = Math.max(acc[moneda].tasaMaxima, conv.tasaCambio)
      
      return acc
    }, {} as Record<string, EstadisticaConversion>)

    // Calcular tasa promedio
    Object.keys(estadisticasConversion).forEach(moneda => {
      const stats = estadisticasConversion[moneda]
      stats.tasaPromedio = stats.montoTotalConvertido / stats.montoTotalOriginal
    })

    // Si se solicita exportación, generar el archivo
    if (export_format === 'csv') {
      const csvContent = generateExchangeCSV(historialTasas as any, conversiones, estadisticasConversion)
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="reporte-exchange.csv"'
        }
      })
    }

    return NextResponse.json({
      historialTasas: historialTasas.map((tasa: any) => ({
        tasaId: tasa.tasaId,
        monedaOrigen: tasa.monedaOrigen,
        monedaDestino: tasa.monedaDestino,
        tasa: Number(tasa.tasa),
        fechaVigencia: tasa.fechaVigencia,
      })),
      transaccionesConversion: transaccionesConversion.map((trans: any) => ({
        transaccionId: trans.transaccionId,
        tipoTransaccion: trans.tipoTransaccion,
        referenciaId: trans.referenciaId,
        moneda: trans.moneda,
        montoOriginal: Number(trans.montoOriginal),
        tasaCambio: Number(trans.tasaCambio),
        montoConvertido: Number(trans.montoConvertido),
        createdAt: trans.createdAt
      })),
      conversiones,
      estadisticasConversion,
      filtros: {
        fechaInicio,
        fechaFin,
        monedaOrigen,
        monedaDestino
      }
    })

  } catch (error) {
    console.error('Error al generar reporte de exchange:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

function generateExchangeCSV(historialTasas: TasaCambioHistorial[], conversiones: Conversion[], estadisticas: Record<string, EstadisticaConversion>): string {
  const sections: string[] = []

  // Sección de historial de tasas
  sections.push('HISTORIAL DE TASAS DE CAMBIO')
  sections.push('Fecha,Moneda Origen,Moneda Destino,Tasa')
  
  historialTasas.forEach((tasa: TasaCambioHistorial) => {
    sections.push([
      new Date(tasa.fechaVigencia).toLocaleDateString(),
      tasa.monedaOrigen.codigo,
      tasa.monedaDestino,
      tasa.tasa
    ].map((field: string | number | Date) => `"${field}"`).join(','))
  })

  sections.push('')
  sections.push('CONVERSIONES REALIZADAS')
  sections.push('Fecha,Tipo,Descripción,Monto Original,Moneda Original,Monto Convertido,Moneda Destino,Tasa Cambio,Referencia')
  
  conversiones.forEach((conv: Conversion) => {
    sections.push([
      new Date(conv.fecha).toLocaleDateString(),
      conv.tipo,
      conv.descripcion,
      conv.montoOriginal,
      conv.monedaOriginal,
      conv.montoConvertido,
      conv.monedaDestino,
      conv.tasaCambio,
      conv.referencia
    ].map(field => `"${field}"`).join(','))
  })

  sections.push('')
  sections.push('ESTADÍSTICAS POR MONEDA')
  sections.push('Moneda,Total Transacciones,Monto Total Original,Monto Total Convertido,Tasa Promedio,Tasa Mínima,Tasa Máxima')
  
  Object.entries(estadisticas).forEach(([moneda, stats]: [string, EstadisticaConversion]) => {
    sections.push([
      moneda,
      stats.totalTransacciones,
      stats.montoTotalOriginal.toFixed(2),
      stats.montoTotalConvertido.toFixed(2),
      stats.tasaPromedio.toFixed(4),
      stats.tasaMinima.toFixed(4),
      stats.tasaMaxima.toFixed(4)
    ].join(','))
  })

  return sections.join('\n')
}