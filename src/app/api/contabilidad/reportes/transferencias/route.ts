import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verify_token } from '@/lib/auth-utils'

interface CuentaBancariaBasica {
  cuentaId: string
  nombreBanco: string
  numeroCuenta: string
  moneda: string | null
}

interface TransferenciaConCuentas {
  transferenciaId: string
  numeroComprobante: string
  fechaTransferencia: Date
  cuentaOrigenId: string
  cuentaDestinoId: string
  montoOrigen: number
  monedaOrigen: string
  montoDestino: number
  monedaDestino: string
  tasaCambio: number | null
  motivo: string
  descripcion: string | null
  comprobanteGenerado: boolean
  rutaComprobante: string | null
  cuentaOrigen: CuentaBancariaBasica
  cuentaDestino: CuentaBancariaBasica
}

interface CuentaActividad {
  totalTransferencias: number
  montoTotal: number
}

interface TransferenciaFormateada {
  transferenciaId: string
  numeroComprobante: string
  fechaTransferencia: Date
  cuentaOrigen: {
    id: string
    banco: string
    numeroCuenta: string
    moneda: string
  }
  cuentaDestino: {
    id: string
    banco: string
    numeroCuenta: string
    moneda: string
  }
  montoOrigen: number
  monedaOrigen: string
  montoDestino: number
  monedaDestino: string
  tasaCambio: number | null
  tieneConversion: boolean
  motivo: string
  descripcion: string | null
  comprobanteGenerado: boolean
  rutaComprobante: string | null
}

interface EstadisticasTransferencias {
  totalTransferencias: number
  montoTotalPorMoneda: Record<string, number>
  transferenciasConConversion: number
  cuentasMasActivas: Array<{ cuenta: string; totalTransferencias: number; montoTotal: number }>
  promedioMontosPorMoneda: Record<string, number>
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
    const cuentaOrigenId = searchParams.get('cuentaOrigenId')
    const cuentaDestinoId = searchParams.get('cuentaDestinoId')
    const moneda = searchParams.get('moneda')
    const realizadoPor = searchParams.get('realizadoPor')
    const export_format = searchParams.get('export') // 'csv' or 'pdf'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Construir filtros de fecha
    const dateFilter: Record<string, Date> = {}
    if (fechaInicio) {
      dateFilter.gte = new Date(fechaInicio)
    }
    if (fechaFin) {
      dateFilter.lte = new Date(fechaFin)
    }

    // Construir filtros adicionales
    const whereClause: any = {
      ...(Object.keys(dateFilter).length > 0 ? { fechaTransferencia: dateFilter } : {}),
      ...(cuentaOrigenId ? { cuentaOrigenId } : {}),
      ...(cuentaDestinoId ? { cuentaDestinoId } : {}),
      ...(moneda ? {
        OR: [
          { monedaOrigen: moneda },
          { monedaDestino: moneda }
        ]
      } : {})
    }

    // Obtener transferencias bancarias
    const transferencias = await prisma.transferenciaBancaria.findMany({
      where: whereClause,
      include: {
        cuentaOrigen: {
          select: {
            cuentaId: true,
            nombreBanco: true,
            numeroCuenta: true,
            moneda: true
          }
        },
        cuentaDestino: {
          select: {
            cuentaId: true,
            nombreBanco: true,
            numeroCuenta: true,
            moneda: true
          }
        }
      },
      orderBy: { fechaTransferencia: 'desc' }
    })

    // Aplicar paginación si no es exportación
    const offset = (page - 1) * limit
    const transferenciasPaginadas = export_format ? transferencias : transferencias.slice(offset, offset + limit)

    // Calcular estadísticas
    const estadisticas: EstadisticasTransferencias = {
      totalTransferencias: transferencias.length,
      montoTotalPorMoneda: transferencias.reduce((acc: any, trans: any) => {
        // Monto origen
        const monedaOrigen = trans.monedaOrigen || 'CUP'
        if (!acc[monedaOrigen]) acc[monedaOrigen] = 0
        acc[monedaOrigen] += Number(trans.montoOrigen)

        // Si hay conversión, también contar el monto destino
        if (trans.monedaOrigen !== trans.monedaDestino) {
          const monedaDestino = trans.monedaDestino || 'CUP'
          if (!acc[monedaDestino]) acc[monedaDestino] = 0
          // No sumar el monto destino para evitar doble conteo
        }

        return acc
      }, {} as Record<string, number>),
      transferenciasConConversion: transferencias.filter((t: any) => t.tasaCambio !== null).length,
      cuentasMasActivas: getCuentasMasActivas(transferencias as any),
      promedioMontosPorMoneda: getPromedioMontosPorMoneda(transferencias as any)
    }

    // Formatear transferencias para respuesta
    const transferenciasFormateadas: TransferenciaFormateada[] = transferenciasPaginadas.map((trans: any) => ({
      transferenciaId: trans.transferenciaId,
      numeroComprobante: trans.numeroComprobante,
      fechaTransferencia: trans.fechaTransferencia,
      cuentaOrigen: {
        id: trans.cuentaOrigen.cuentaId,
        banco: trans.cuentaOrigen.nombreBanco,
        numeroCuenta: trans.cuentaOrigen.numeroCuenta,
        moneda: trans.cuentaOrigen.moneda || 'CUP'
      },
      cuentaDestino: {
        id: trans.cuentaDestino.cuentaId,
        banco: trans.cuentaDestino.nombreBanco,
        numeroCuenta: trans.cuentaDestino.numeroCuenta,
        moneda: trans.cuentaDestino.moneda || 'CUP'
      },
      montoOrigen: Number(trans.montoOrigen),
      monedaOrigen: trans.monedaOrigen || 'CUP',
      montoDestino: Number(trans.montoDestino),
      monedaDestino: trans.monedaDestino || 'CUP',
      tasaCambio: trans.tasaCambio ? Number(trans.tasaCambio) : null,
      tieneConversion: trans.monedaOrigen !== trans.monedaDestino,
      motivo: trans.motivo,
      descripcion: trans.descripcion,
      comprobanteGenerado: trans.comprobanteGenerado,
      rutaComprobante: trans.rutaComprobante
    }))

    // Si se solicita exportación, generar el archivo
    if (export_format === 'csv') {
      const csvContent = generateTransferenciasCSV(transferenciasFormateadas, estadisticas)
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="reporte-transferencias.csv"'
        }
      })
    }

    return NextResponse.json({
      transferencias: transferenciasFormateadas,
      estadisticas,
      paginacion: {
        page,
        limit,
        total: transferencias.length,
        totalPages: Math.ceil(transferencias.length / limit)
      },
      filtros: {
        fechaInicio,
        fechaFin,
        cuentaOrigenId,
        cuentaDestinoId,
        moneda
      }
    })

  } catch (error) {
    console.error('Error al generar reporte de transferencias:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

function getCuentasMasActivas(transferencias: TransferenciaConCuentas[]): Array<{ cuenta: string; totalTransferencias: number; montoTotal: number }> {
  const cuentasActividad = transferencias.reduce((acc: Record<string, CuentaActividad>, trans: TransferenciaConCuentas) => {
    // Cuenta origen
    const cuentaOrigenKey = `${trans.cuentaOrigen.nombreBanco} - ${trans.cuentaOrigen.numeroCuenta}`
    if (!acc[cuentaOrigenKey]) {
      acc[cuentaOrigenKey] = { totalTransferencias: 0, montoTotal: 0 }
    }
    acc[cuentaOrigenKey].totalTransferencias++
    acc[cuentaOrigenKey].montoTotal += Number(trans.montoOrigen)

    // Cuenta destino
    const cuentaDestinoKey = `${trans.cuentaDestino.nombreBanco} - ${trans.cuentaDestino.numeroCuenta}`
    if (!acc[cuentaDestinoKey]) {
      acc[cuentaDestinoKey] = { totalTransferencias: 0, montoTotal: 0 }
    }
    acc[cuentaDestinoKey].totalTransferencias++
    acc[cuentaDestinoKey].montoTotal += Number(trans.montoDestino)

    return acc
  }, {} as Record<string, CuentaActividad>)

  return Object.entries(cuentasActividad)
    .map(([cuenta, stats]: [string, CuentaActividad]) => ({
      cuenta,
      totalTransferencias: stats.totalTransferencias,
      montoTotal: stats.montoTotal
    }))
    .sort((a, b) => b.totalTransferencias - a.totalTransferencias)
    .slice(0, 10) // Top 10 cuentas más activas
}

interface MontoPorMoneda {
  total: number
  count: number
}

function getPromedioMontosPorMoneda(transferencias: TransferenciaConCuentas[]): Record<string, number> {
  const montosPorMoneda = transferencias.reduce((acc: Record<string, MontoPorMoneda>, trans: TransferenciaConCuentas) => {
    const moneda = trans.monedaOrigen || 'CUP'
    if (!acc[moneda]) {
      acc[moneda] = { total: 0, count: 0 }
    }
    acc[moneda].total += Number(trans.montoOrigen)
    acc[moneda].count++
    return acc
  }, {} as Record<string, MontoPorMoneda>)

  return Object.entries(montosPorMoneda).reduce((acc: Record<string, number>, [moneda, stats]: [string, MontoPorMoneda]) => {
    acc[moneda] = stats.total / stats.count
    return acc
  }, {} as Record<string, number>)
}

function generateTransferenciasCSV(transferencias: TransferenciaFormateada[], estadisticas: EstadisticasTransferencias): string {
  const sections: string[] = []

  // Sección de transferencias
  sections.push('TRANSFERENCIAS BANCARIAS')
  sections.push('Fecha,Número Comprobante,Cuenta Origen,Cuenta Destino,Monto Origen,Moneda Origen,Monto Destino,Moneda Destino,Tasa Cambio,Motivo,Descripción,Comprobante Generado')

  transferencias.forEach((trans: TransferenciaFormateada) => {
    sections.push([
      new Date(trans.fechaTransferencia).toLocaleDateString(),
      trans.numeroComprobante,
      `${trans.cuentaOrigen.banco} - ${trans.cuentaOrigen.numeroCuenta}`,
      `${trans.cuentaDestino.banco} - ${trans.cuentaDestino.numeroCuenta}`,
      trans.montoOrigen.toString(),
      trans.monedaOrigen,
      trans.montoDestino.toString(),
      trans.monedaDestino,
      trans.tasaCambio?.toString() || '',
      trans.motivo,
      trans.descripcion || '',
      trans.comprobanteGenerado ? 'Sí' : 'No'
    ].map((field: string | number | boolean) => `"${field}"`).join(','))
  })

  sections.push('')
  sections.push('ESTADÍSTICAS')
  sections.push(`Total Transferencias,${estadisticas.totalTransferencias}`)
  sections.push(`Transferencias con Conversión,${estadisticas.transferenciasConConversion}`)

  sections.push('')
  sections.push('MONTO TOTAL POR MONEDA')
  sections.push('Moneda,Monto Total')
  Object.entries(estadisticas.montoTotalPorMoneda).forEach(([moneda, monto]: [string, number]) => {
    sections.push(`${moneda},${monto}`)
  })

  sections.push('')
  sections.push('PROMEDIO MONTOS POR MONEDA')
  sections.push('Moneda,Promedio')
  Object.entries(estadisticas.promedioMontosPorMoneda).forEach(([moneda, promedio]: [string, number]) => {
    sections.push(`${moneda},${promedio.toFixed(2)}`)
  })

  sections.push('')
  sections.push('CUENTAS MÁS ACTIVAS')
  sections.push('Cuenta,Total Transferencias,Monto Total')
  estadisticas.cuentasMasActivas.forEach((cuenta: { cuenta: string; totalTransferencias: number; montoTotal: number }) => {
    sections.push([
      cuenta.cuenta,
      cuenta.totalTransferencias,
      cuenta.montoTotal.toFixed(2)
    ].map((field: string | number) => `"${field}"`).join(','))
  })

  return sections.join('\n')
}