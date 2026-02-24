import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

interface FiltrosFecha {
  gte?: Date
  lte?: Date
}

interface CuentaBancariaInfo {
  nombreBanco?: string | null
  numeroCuenta?: string | null
  moneda?: string
}

interface Conversion {
  id: string
  fecha: Date
  tipo: string
  monedaOriginal: string
  montoOriginal: number
  tasaCambio: number
  montoConvertido: number
  cuentaId: string
  cuenta: CuentaBancariaInfo | null
  descripcion: string | null
  detalles: Record<string, unknown>
}

interface MonedaImpacto {
  codigo: string
  nombre: string
  simbolo: string
  impactoTotal: number
  volumenConvertido: number
  transacciones: Array<{
    fecha: string
    impacto: number
    monto: number
    tasa: number
    tipo: string
    descripcion: string | null
  }>
  tasas: number[]
}

interface CuentaImpacto {
  cuentaId: string
  nombreBanco: string
  numeroCuenta: string
  moneda: string
  totalConversiones: number
  volumenTotal: number
  impactoTotal: number
  nivelRiesgo: string
  tiposOperacion: string[]
  riesgoPromedio: number
}

interface Recomendacion {
  titulo: string
  descripcion: string
  prioridad: string
  impactoEstimado?: number
}

interface DataAnalisis {
  gananciaPerdidaTotal: number
  volatilidadPromedio: number
  porMoneda: MonedaImpacto[]
  porCuenta: CuentaImpacto[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fechaInicio = searchParams.get("fechaInicio")
    const fechaFin = searchParams.get("fechaFin")
    const monedaBase = searchParams.get("monedaBase") || "CUP"
    const tipoAnalisis = searchParams.get("tipoAnalisis") || "general"

    // Construir filtros de fecha
    const fechaFiltros: FiltrosFecha = {}
    if (fechaInicio) {
      fechaFiltros.gte = new Date(fechaInicio)
    }
    if (fechaFin) {
      fechaFiltros.lte = new Date(fechaFin)
    }

    // Obtener todas las conversiones de moneda en el período desde diferentes fuentes
    const [reconciliacionesVenta, reconciliacionesServicio, reconciliacionesGasto, ajustesBancarios, transferencias] = await Promise.all([
      // Reconciliaciones de ventas con conversión
      prisma.reconciliacionVenta.findMany({
        where: {
          ...(Object.keys(fechaFiltros).length > 0 && {
            fechaReconciliacion: fechaFiltros
          }),
          tasaCambio: { not: null },
          moneda: { not: monedaBase }
        },
        include: {
          cuentaBancaria: true,
          venta: true,
          tipoPago: true
        },
        orderBy: { fechaReconciliacion: 'desc' }
      }),

      // Reconciliaciones de servicios con conversión
      prisma.reconciliacionServicio.findMany({
        where: {
          ...(Object.keys(fechaFiltros).length > 0 && {
            fechaReconciliacion: fechaFiltros
          }),
          tasaCambio: { not: null },
          moneda: { not: monedaBase }
        },
        include: {
          cuentaBancaria: true,
          tipoPago: true
        },
        orderBy: { fechaReconciliacion: 'desc' }
      }),

      // Reconciliaciones de gastos con conversión
      prisma.reconciliacionGasto.findMany({
        where: {
          ...(Object.keys(fechaFiltros).length > 0 && {
            fechaReconciliacion: fechaFiltros
          }),
          tasaCambio: { not: null },
          moneda: { not: monedaBase }
        },
        include: {
          cuentaBancaria: true,
          pagoSalario: true,
          gastoDE: true,
          gastoCompra: true,
          tipoPago: true
        },
        orderBy: { fechaReconciliacion: 'desc' }
      }),

      // Ajustes bancarios con conversión
      prisma.ajusteBancario.findMany({
        where: {
          ...(Object.keys(fechaFiltros).length > 0 && {
            createdAt: fechaFiltros
          }),
          tasaCambio: { not: null },
          moneda: { not: monedaBase }
        },
        include: {
          cuentaBancaria: true
        },
        orderBy: { createdAt: 'desc' }
      }),

      // Transferencias bancarias con conversión
      prisma.transferenciaBancaria.findMany({
        where: {
          ...(Object.keys(fechaFiltros).length > 0 && {
            fechaTransferencia: fechaFiltros
          }),
          tasaCambio: { not: null },
          OR: [
            { monedaOrigen: { not: monedaBase } },
            { monedaDestino: { not: monedaBase } }
          ]
        },
        include: {
          cuentaOrigen: true,
          cuentaDestino: true
        },
        orderBy: { fechaTransferencia: 'desc' }
      })
    ])

    // Combinar todas las conversiones en un formato unificado
    const conversiones: Conversion[] = []

    // Procesar reconciliaciones de ventas
    reconciliacionesVenta.forEach((rec: any) => {
      conversiones.push({
        id: rec.reconciliacionId,
        fecha: rec.fechaReconciliacion,
        tipo: 'venta',
        monedaOriginal: rec.moneda,
        montoOriginal: Number(rec.monto),
        tasaCambio: Number(rec.tasaCambio),
        montoConvertido: Number(rec.montoConvertido || rec.monto),
        cuentaId: rec.cuentaId,
        cuenta: rec.cuentaBancaria,
        descripcion: `Venta reconciliada - ${rec.venta?.ventaId || 'N/A'}`,
        detalles: { venta: rec.venta, tipoPago: rec.tipoPago }
      })
    })

    // Procesar reconciliaciones de servicios
    reconciliacionesServicio.forEach((rec: any) => {
      conversiones.push({
        id: rec.reconciliacionId,
        fecha: rec.fechaReconciliacion,
        tipo: 'servicio',
        monedaOriginal: rec.moneda,
        montoOriginal: Number(rec.monto),
        tasaCambio: Number(rec.tasaCambio),
        montoConvertido: Number(rec.montoConvertido || rec.monto),
        cuentaId: rec.cuentaId,
        cuenta: rec.cuentaBancaria,
        descripcion: `Servicio reconciliado - ${rec.reconciliadoPor}`,
        detalles: {
          servicio: rec.reconciliadoPor,
          tipoPago: rec.tipoPago
        }
      })
    })

    // Procesar reconciliaciones de gastos
reconciliacionesGasto.forEach((rec: any) => {
      conversiones.push({
        id: rec.reconciliacionId,
        fecha: rec.fechaReconciliacion,
        tipo: rec.tipoGasto,
        monedaOriginal: rec.moneda,
        montoOriginal: Number(rec.monto),
        tasaCambio: Number(rec.tasaCambio),
        montoConvertido: Number(rec.montoConvertido || rec.monto),
        cuentaId: rec.cuentaId,
        cuenta: rec.cuentaBancaria,
        descripcion: rec.descripcion,
        detalles: { empleado: rec.pagoSalario, gastoDE: rec.gastoDE, gastoCompra: rec.gastoCompra, tipoPago: rec.tipoPago }
      })
    })

    // Procesar ajustes bancarios
    ajustesBancarios.forEach((ajuste: any) => {
      conversiones.push({
        id: ajuste.ajusteId,
        fecha: ajuste.createdAt,
        tipo: `ajuste_${ajuste.tipo}`,
        monedaOriginal: ajuste.moneda,
        montoOriginal: Number(ajuste.monto),
        tasaCambio: Number(ajuste.tasaCambio),
        montoConvertido: Number(ajuste.montoConvertido || ajuste.monto),
        cuentaId: ajuste.cuentaId,
        cuenta: ajuste.cuentaBancaria,
        descripcion: ajuste.descripcion,
        detalles: { motivo: ajuste.motivo, realizadoPor: ajuste.realizadoPor }
      })
    })

    // Procesar transferencias bancarias
    transferencias.forEach((transfer: any) => {
      // Si la moneda origen es diferente a la base
      if (transfer.monedaOrigen !== monedaBase && transfer.tasaCambio) {
        conversiones.push({
          id: `${transfer.transferenciaId}_origen`,
          fecha: transfer.fechaTransferencia,
          tipo: 'transferencia_origen',
          monedaOriginal: transfer.monedaOrigen,
          montoOriginal: Number(transfer.montoOrigen),
          tasaCambio: Number(transfer.tasaCambio),
          montoConvertido: Number(transfer.montoDestino),
          cuentaId: transfer.cuentaOrigenId,
          cuenta: transfer.cuentaOrigen,
          descripcion: `Transferencia a ${transfer.cuentaDestino?.nombreBanco}`,
          detalles: { numeroComprobante: transfer.numeroComprobante, motivo: transfer.motivo }
        })
      }

      // Si la moneda destino es diferente a la base
      if (transfer.monedaDestino !== monedaBase && transfer.tasaCambio) {
        conversiones.push({
          id: `${transfer.transferenciaId}_destino`,
          fecha: transfer.fechaTransferencia,
          tipo: 'transferencia_destino',
          monedaOriginal: transfer.monedaDestino,
          montoOriginal: Number(transfer.montoDestino),
          tasaCambio: Number(transfer.tasaCambio),
          montoConvertido: Number(transfer.montoOrigen),
          cuentaId: transfer.cuentaDestinoId,
          cuenta: transfer.cuentaDestino,
          descripcion: `Transferencia desde ${transfer.cuentaOrigen?.nombreBanco}`,
          detalles: { numeroComprobante: transfer.numeroComprobante, motivo: transfer.motivo }
        })
      }
    })

    // Obtener información de monedas para nombres completos
    const monedasInfo = await prisma.moneda.findMany({
      where: {
        codigo: {
          in: [...new Set(conversiones.map(c => c.monedaOriginal))]
        }
      }
    })

    const monedasMap = new Map<string, { codigo: string; nombre: string | null; simbolo: string | null }>(
      monedasInfo.map((m: { codigo: string; nombre: string | null; simbolo: string | null }) => [m.codigo, m])
    )

    // Calcular impacto total
    let gananciaPerdidaTotal = 0
    let totalConvertido = 0

    const impactoPorMoneda = new Map<string, MonedaImpacto>()

    for (const movimiento of conversiones) {
      const moneda = movimiento.monedaOriginal
      const monedaInfo = monedasMap.get(moneda)

      // Calcular impacto: diferencia entre lo que se obtuvo vs lo que se esperaba con tasa teórica
      const montoEsperado = movimiento.montoOriginal * movimiento.tasaCambio
      const impacto = movimiento.montoConvertido - montoEsperado

      gananciaPerdidaTotal += impacto
      totalConvertido += movimiento.montoConvertido

      if (!impactoPorMoneda.has(moneda)) {
        impactoPorMoneda.set(moneda, {
          codigo: moneda,
          nombre: monedaInfo?.nombre || moneda,
          simbolo: monedaInfo?.simbolo || moneda,
          impactoTotal: 0,
          volumenConvertido: 0,
          transacciones: [],
          tasas: []
        })
      }

      const monedaData = impactoPorMoneda.get(moneda)
      if (monedaData) {
        monedaData.impactoTotal += impacto
        monedaData.volumenConvertido += movimiento.montoOriginal
        monedaData.transacciones.push({
          fecha: movimiento.fecha.toISOString(),
          impacto,
          monto: movimiento.montoOriginal,
          tasa: movimiento.tasaCambio,
          tipo: movimiento.tipo,
          descripcion: movimiento.descripcion
        })
        monedaData.tasas.push(movimiento.tasaCambio)
      }
    }

    // Procesar datos por moneda
    const porMoneda = Array.from(impactoPorMoneda.values()).map(moneda => {
      const tasaPromedio = moneda.tasas.reduce((sum: number, tasa: number) => sum + tasa, 0) / moneda.tasas.length
      const volatilidad = calcularVolatilidad(moneda.tasas)

      // Transacciones más significativas
      const transaccionesSignificativas = moneda.transacciones
        .sort((a, b) => Math.abs(b.impacto) - Math.abs(a.impacto))
        .slice(0, 5)
        .map(tx => ({
          fecha: tx.fecha,
          impacto: tx.impacto
        }))

      return {
        codigo: moneda.codigo,
        nombre: moneda.nombre,
        simbolo: moneda.simbolo,
        impactoTotal: moneda.impactoTotal,
        volumenConvertido: moneda.volumenConvertido,
        transacciones: moneda.transacciones,
        tasas: moneda.tasas,
        tasaPromedio,
        volatilidad,
        transaccionesSignificativas
      }
    })

    // Análisis por cuenta
    const impactoPorCuenta = new Map<string, CuentaImpacto>()

    for (const movimiento of conversiones) {
      const cuentaId = movimiento.cuentaId

      if (!impactoPorCuenta.has(cuentaId)) {
        const cuentaInfo: CuentaImpacto = {
          cuentaId,
          nombreBanco: movimiento.cuenta?.nombreBanco || 'N/A',
          numeroCuenta: movimiento.cuenta?.numeroCuenta || 'N/A',
          moneda: movimiento.cuenta?.moneda || monedaBase,
          totalConversiones: 0,
          volumenTotal: 0,
          impactoTotal: 0,
          nivelRiesgo: 'bajo',
          tiposOperacion: [],
          riesgoPromedio: 0
        }
        impactoPorCuenta.set(cuentaId, cuentaInfo)
      }

      const cuentaData = impactoPorCuenta.get(cuentaId)!
      const montoEsperado = movimiento.montoOriginal * movimiento.tasaCambio
      const impacto = movimiento.montoConvertido - montoEsperado

      cuentaData.totalConversiones += 1
      cuentaData.volumenTotal += movimiento.montoOriginal
      cuentaData.impactoTotal += impacto
    }

    const porCuenta = Array.from(impactoPorCuenta.values()).map(cuenta => {
      const riesgos: number[] = []
      const tiposOperacion = new Set<string>()
      
      // Recalcular riesgos y tipos de operación
      for (const movimiento of conversiones) {
        if (movimiento.cuentaId === cuenta.cuentaId) {
          const montoEsperado = movimiento.montoOriginal * movimiento.tasaCambio
          const impacto = movimiento.montoConvertido - montoEsperado
          riesgos.push(Math.abs(impacto))
          tiposOperacion.add(movimiento.tipo)
        }
      }
      
      const riesgoPromedio = riesgos.length > 0
        ? riesgos.reduce((sum: number, riesgo: number) => sum + riesgo, 0) / riesgos.length
        : 0
      const nivelRiesgo = riesgoPromedio > 1000 ? 'alto' : riesgoPromedio > 500 ? 'medio' : 'bajo'

      return {
        cuentaId: cuenta.cuentaId,
        nombreBanco: cuenta.nombreBanco,
        numeroCuenta: cuenta.numeroCuenta,
        moneda: cuenta.moneda,
        totalConversiones: cuenta.totalConversiones,
        volumenTotal: cuenta.volumenTotal,
        impactoTotal: cuenta.impactoTotal,
        nivelRiesgo,
        tiposOperacion: Array.from(tiposOperacion),
        riesgoPromedio
      }
    })

    // Calcular volatilidad promedio
    const todasLasTasas = conversiones.map(c => c.tasaCambio)
    const volatilidadPromedio = calcularVolatilidad(todasLasTasas)

    // Determinar nivel de riesgo general
    const nivelRiesgo = volatilidadPromedio > 0.1 ? 'alto' : volatilidadPromedio > 0.05 ? 'medio' : 'bajo'

    // Generar recomendaciones
    const recomendaciones = generarRecomendaciones({
      gananciaPerdidaTotal,
      volatilidadPromedio,
      porMoneda,
      porCuenta
    })

    const analisis = {
      resumen: {
        gananciaPerdidaTotal,
        totalConvertido,
        nivelRiesgo,
        volatilidadPromedio
      },
      porMoneda,
      porCuenta,
      recomendaciones
    }

    return NextResponse.json(analisis)

  } catch (error) {
    console.error("Error al generar análisis de impacto del exchange:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

function calcularVolatilidad(valores: number[]): number {
  if (valores.length < 2) return 0

  const promedio = valores.reduce((sum, val) => sum + val, 0) / valores.length
  const varianza = valores.reduce((sum, val) => sum + Math.pow(val - promedio, 2), 0) / valores.length

  return Math.sqrt(varianza) / promedio // Coeficiente de variación
}

function generarRecomendaciones(data: DataAnalisis): Recomendacion[] {
  const recomendaciones: Recomendacion[] = []

  // Recomendación por pérdidas altas
  if (data.gananciaPerdidaTotal < -5000) {
    recomendaciones.push({
      titulo: "Pérdidas significativas por exchange",
      descripcion: "Se han detectado pérdidas importantes debido a fluctuaciones del tipo de cambio. Considere implementar estrategias de cobertura.",
      prioridad: "alta",
      impactoEstimado: Math.abs(data.gananciaPerdidaTotal) * 0.3
    })
  }

  // Recomendación por volatilidad alta
  if (data.volatilidadPromedio > 0.1) {
    recomendaciones.push({
      titulo: "Alta volatilidad en tipos de cambio",
      descripcion: "Los tipos de cambio muestran alta volatilidad. Considere diversificar las monedas o ajustar la frecuencia de conversiones.",
      prioridad: "media"
    })
  }

  // Recomendación por concentración en una moneda
  const monedaDominante = data.porMoneda.reduce((max: MonedaImpacto | null, moneda: MonedaImpacto) =>
    max && Math.abs(max.impactoTotal) > Math.abs(moneda.impactoTotal) ? max : moneda,
    null
  )

  if (monedaDominante && Math.abs(monedaDominante.impactoTotal) > Math.abs(data.gananciaPerdidaTotal) * 0.7) {
    recomendaciones.push({
      titulo: `Concentración de riesgo en ${monedaDominante.codigo}`,
      descripcion: `La mayoría del impacto del exchange proviene de ${monedaDominante.codigo}. Considere diversificar las operaciones.`,
      prioridad: "media"
    })
  }

  // Recomendación por cuentas de alto riesgo
  const cuentasAltoRiesgo = data.porCuenta.filter((cuenta: CuentaImpacto) => cuenta.nivelRiesgo === 'alto')
  if (cuentasAltoRiesgo.length > 0) {
    recomendaciones.push({
      titulo: "Cuentas con alto riesgo cambiario",
      descripcion: `${cuentasAltoRiesgo.length} cuenta(s) muestran alto riesgo cambiario. Revise las operaciones en estas cuentas.`,
      prioridad: "media"
    })
  }

  return recomendaciones
}
