import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'
import { canAccessAccountingItem } from '@/lib/plan-access'

interface CuentaBancariaResumen {
  cuentaId: string
  nombreBanco: string
  numeroCuenta: string
  saldo: number
  moneda: string | null
  tipoCuenta: string
}

interface ReconciliacionVentaResumen {
  monto: number
  moneda: string
  montoConvertido: number | null
  fechaReconciliacion: Date
  cuentaBancaria: {
    nombreBanco: string
    numeroCuenta: string
  }
}

interface ReconciliacionServicioResumen {
  monto: number
  moneda: string
  montoConvertido: number | null
  fechaReconciliacion: Date
  cuentaBancaria: {
    nombreBanco: string
    numeroCuenta: string
  }
}

interface ReconciliacionGastoResumen {
  monto: number
  moneda: string
  montoConvertido: number | null
  tipoGasto: string
  fechaReconciliacion: Date
  cuentaBancaria: {
    nombreBanco: string
    numeroCuenta: string
  }
}

interface AjusteBancarioResumen {
  tipo: string
  monto: number
  moneda: string
  montoConvertido: number | null
}

interface InyeccionCapitalResumen {
  tipo: string
  montoRecibido: number
  moneda: string
}

interface PagoDeudaResumen {
  montoPagado: number
  cuentaBancaria: {
    moneda: string
  }
}

interface ResumenPorMoneda {
  moneda: string
  saldoActual: number
  totalIngresos: number
  totalEgresos: number
  flujoNeto: number
  desglose: {
    ingresos: {
      ventas: number
      servicios: number
      ajustes: number
      inyecciones: InyeccionCapitalResumen[]
    }
    egresos: {
      gastos: number
      ajustes: number
      pagosDeuda: number
    }
  }
}

interface EstadisticasResumen {
  totalCuentas: number
  totalReconciliaciones: number
  totalTransferencias: number
  totalAjustes: number
  totalInyecciones: number
  periodo: {
    fechaInicio: string | null
    fechaFin: string | null
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const canViewServicios = user.planFeatures?.servicios === true
    const canViewTransfers = canAccessAccountingItem(user, 'Transferencias Bancarias')
    const canViewAdjustments = canAccessAccountingItem(user, 'Ajustes Bancarios')
    const canViewCapital = user.planFeatures?.['inyeccion-capital'] === true
    const canViewPrestamosCash = user.planFeatures?.['prestamos-cash'] === true

    const { searchParams } = new URL(request.url)
    const fechaInicio = searchParams.get('fechaInicio')
    const fechaFin = searchParams.get('fechaFin')
    const cuentaId = searchParams.get('cuentaId')
    const moneda = searchParams.get('moneda') || 'CUP'
    const export_format = searchParams.get('export') // 'csv' or 'pdf'

    // Construir filtros de fecha
    const dateFilter: Record<string, Date> = {}
    if (fechaInicio) {
      dateFilter.gte = new Date(fechaInicio)
    }
    if (fechaFin) {
      dateFilter.lte = new Date(fechaFin)
    }

    // Filtro de cuenta específica
    const accountFilter = cuentaId ? { cuentaId } : {}

    // Obtener resumen de cuentas bancarias
    const cuentasBancarias = await prisma.cuentaBancaria.findMany({
      where: {
        isActive: true,
        ...(cuentaId ? { cuentaId } : {})
      },
      select: {
        cuentaId: true,
        nombreBanco: true,
        numeroCuenta: true,
        saldo: true,
        moneda: true,
        tipoCuenta:true
      }
    })

    // Calcular saldo total por moneda
    const saldosPorMoneda = cuentasBancarias.reduce((acc: Record<string, number>, cuenta: CuentaBancariaResumen) => {
      const monedaCuenta = cuenta.moneda || 'CUP'
      if (!acc[monedaCuenta]) {
        acc[monedaCuenta] = 0
      }
      acc[monedaCuenta] += Number(cuenta.saldo || 0)
      return acc
    }, {} as Record<string, number>)

    // Obtener reconciliaciones de ventas
    const reconciliacionesVentas = await prisma.reconciliacionVenta.findMany({
      where: {
        ...accountFilter,
        ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}),
        tipoReconciliacion: { notIn: ['PRESTAMO_CASH_DESEMBOLSO'] }
      },
      select: {
        monto: true,
        moneda: true,
        montoConvertido: true,
        fechaReconciliacion: true,
        tipoReconciliacion: true,
        cuentaBancaria: {
          select: {
            nombreBanco: true,
            numeroCuenta: true
          }
        }
      }
    })

    // Obtener reconciliaciones de servicios
    const reconciliacionesServicios = canViewServicios ? await prisma.reconciliacionServicio.findMany({
      where: {
        ...accountFilter,
        ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {})
      },
      select: {
        monto: true,
        moneda: true,
        montoConvertido: true,
        fechaReconciliacion: true,
        cuentaBancaria: {
          select: {
            nombreBanco: true,
            numeroCuenta: true
          }
        }
      }
    }) : []

    // Obtener reconciliaciones de gastos
    const reconciliacionesGastos = await prisma.reconciliacionGasto.findMany({
      where: {
        ...accountFilter,
        ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {})
      },
      select: {
        monto: true,
        moneda: true,
        montoConvertido: true,
        tipoGasto: true,
        fechaReconciliacion: true,
        cuentaBancaria: {
          select: {
            nombreBanco: true,
            numeroCuenta: true
          }
        }
      }
    })

    // Obtener transferencias bancarias
    const transferencias = canViewTransfers ? await prisma.transferenciaBancaria.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 ? { fechaTransferencia: dateFilter } : {}),
        ...(cuentaId ? {
          OR: [
            { cuentaOrigenId: cuentaId },
            { cuentaDestinoId: cuentaId }
          ]
        } : {})
      },
      select: {
        montoOrigen: true,
        monedaOrigen: true,
        montoDestino: true,
        monedaDestino: true,
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
    }) : []

    // Obtener ajustes bancarios
    const ajustesBancarios = canViewAdjustments ? await prisma.ajusteBancario.findMany({
      where: {
        ...accountFilter,
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
      },
      select: {
        tipo: true,
        monto: true,
        moneda: true,
        montoConvertido: true,
        descripcion: true,
        createdAt: true,
        cuentaBancaria: {
          select: {
            nombreBanco: true,
            numeroCuenta: true
          }
        }
      }
    }) : []

    // Obtener inyecciones de capital
    const inyeccionesCapital = canViewCapital ? await prisma.inyeccionCapital.findMany({
      where: {
        ...accountFilter,
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
      },
      select: {
        tipo: true,
        montoRecibido: true,
        moneda: true,
        cuentaBancaria: {
          select: {
            nombreBanco: true,
            numeroCuenta: true
          },
        },
        cuentaId:true,
        descripcion: true,
        socio: true,
        entidadPrestamista: true,
        tasaInteres: true,
        plazoMeses: true,
        fechaInicioPago: true,
        estado:true,
        montoInteres: true,
        montoTotalDeuda: true,
        saldoPendiente: true,
      }
    }) : []

    // Obtener pagos de deuda
    const pagosDeuda = canViewCapital ? await prisma.pagoDeuda.findMany({
      where: {
        ...accountFilter,
        ...(Object.keys(dateFilter).length > 0 ? { fechaPago: dateFilter } : {})
      },
      select: {
        montoPagado: true,
        cuentaBancaria: {
          select: {
            moneda: true
          }
        }
      }
    }) : []

    const movimientosPrestamoCash = canViewPrestamosCash ? await prisma.reconciliacionVenta.findMany({
      where: {
        ...accountFilter,
        ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}),
        tipoReconciliacion: { in: ['PRESTAMO_CASH_DESEMBOLSO'] }
      },
      select: {
        monto: true,
        moneda: true,
        cuentaBancaria: {
          select: { moneda: true }
        }
      }
    }) : []

    // Calcular totales de ingresos por moneda
    const ingresosVentas = reconciliacionesVentas.reduce((acc: any, rec: any) => {
      if (rec.tipoReconciliacion?.startsWith('PRESTAMO_CASH')) {
        return acc
      }
      const monedaRec = rec.moneda || 'CUP'
      if (!acc[monedaRec]) acc[monedaRec] = 0
      acc[monedaRec] += Number(rec.monto)
      return acc
    }, {} as Record<string, number>)

    const ingresosServicios = reconciliacionesServicios.reduce((acc: any, rec: any) => {
      const monedaRec = rec.moneda || 'CUP'
      if (!acc[monedaRec]) acc[monedaRec] = 0
      acc[monedaRec] += Number(rec.monto)
      return acc
    }, {} as Record<string, number>)

    const ingresosInyecciones = inyeccionesCapital.reduce((acc: any, iny: any) => {
      const monedaIny = iny.moneda || 'CUP'
      if (!acc[monedaIny]) acc[monedaIny] = 0
      acc[monedaIny] += Number(iny.montoRecibido)
      return acc
    }, {} as Record<string, number>)

    // Calcular totales de egresos por moneda
    const egresosGastos = reconciliacionesGastos.reduce((acc: any, rec: any) => {
      const monedaRec = rec.moneda || 'CUP'
      if (!acc[monedaRec]) acc[monedaRec] = 0
      acc[monedaRec] += Number(rec.monto)
      return acc
    }, {} as Record<string, number>)

    const egresosPagosDeuda = pagosDeuda.reduce((acc: any, pago: any) => {
      const monedaPago = pago.cuentaBancaria.moneda || 'CUP'
      if (!acc[monedaPago]) acc[monedaPago] = 0
      acc[monedaPago] += Number(pago.montoPagado)
      return acc
    }, {} as Record<string, number>)

    const egresosPrestamosCash = movimientosPrestamoCash.reduce((acc: any, mov: any) => {
      const monedaMov = mov.moneda || mov.cuentaBancaria.moneda || 'CUP'
      if (!acc[monedaMov]) acc[monedaMov] = 0
      acc[monedaMov] += Number(mov.monto)
      return acc
    }, {} as Record<string, number>)

    const egresosAjustes = ajustesBancarios
      .filter((ajuste: any) => ajuste.tipo === 'egreso')
      .reduce((acc: any, ajuste: any) => {
        const monedaAjuste = ajuste.moneda || 'CUP'
        if (!acc[monedaAjuste]) acc[monedaAjuste] = 0
        acc[monedaAjuste] += Number(ajuste.monto)
        return acc
      }, {} as Record<string, number>)

    const ingresosAjustes = ajustesBancarios
      .filter((ajuste: any) => ajuste.tipo === 'ingreso')
      .reduce((acc: any, ajuste: any) => {
        const monedaAjuste = ajuste.moneda || 'CUP'
        if (!acc[monedaAjuste]) acc[monedaAjuste] = 0
        acc[monedaAjuste] += Number(ajuste.monto)
        return acc
      }, {} as Record<string, number>)

    // Obtener todas las monedas utilizadas
    const monedasUtilizadas = new Set([
      ...Object.keys(saldosPorMoneda),
      ...Object.keys(ingresosVentas),
      ...Object.keys(ingresosServicios),
      ...Object.keys(ingresosInyecciones),
      ...Object.keys(egresosGastos),
      ...Object.keys(egresosPagosDeuda),
      ...Object.keys(egresosPrestamosCash),
      ...Object.keys(egresosAjustes),
      ...Object.keys(ingresosAjustes)
    ])

    // Construir resumen por moneda
    const resumenPorMoneda: any[] = Array.from(monedasUtilizadas).map((monedaCode: string) => {
      const totalIngresos = (ingresosVentas[monedaCode] || 0) + 
                           (ingresosServicios[monedaCode] || 0) + 
                           (ingresosAjustes[monedaCode] || 0) +
                           (ingresosInyecciones[monedaCode] || 0)
      
      const totalEgresos = (egresosGastos[monedaCode] || 0) + 
                           (egresosAjustes[monedaCode] || 0) +
                           (egresosPagosDeuda[monedaCode] || 0) +
                           (egresosPrestamosCash[monedaCode] || 0)
      
      return {
        moneda: monedaCode,
        saldoActual: saldosPorMoneda[monedaCode] || 0,
        totalIngresos,
        totalEgresos,
        flujoNeto: totalIngresos - totalEgresos,
        desglose: {
          ingresos: {
            ventas: ingresosVentas[monedaCode] || 0,
            servicios: ingresosServicios[monedaCode] || 0,
            ajustes: ingresosAjustes[monedaCode] || 0,
            inyecciones: inyeccionesCapital,
          },
          egresos: {
            gastos: egresosGastos[monedaCode] || 0,
            ajustes: egresosAjustes[monedaCode] || 0,
            pagosDeuda: egresosPagosDeuda[monedaCode] || 0,
            prestamosCash: egresosPrestamosCash[monedaCode] || 0
          }
        }
      }
    })

    // Estadísticas adicionales
    const estadisticas = {
      totalCuentas: cuentasBancarias.length,
      totalReconciliaciones: reconciliacionesVentas.length + reconciliacionesServicios.length + reconciliacionesGastos.length,
      totalTransferencias: transferencias.length,
      totalAjustes: ajustesBancarios.length,
      totalInyecciones: inyeccionesCapital.length,
      periodo: {
        fechaInicio: fechaInicio || 'Sin límite',
        fechaFin: fechaFin || 'Sin límite'
      }
    }

    // Si se solicita exportación, generar el archivo
    if (export_format === 'csv') {
      const csvContent = generateResumenCSV(resumenPorMoneda, cuentasBancarias, estadisticas)
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="resumen-financiero.csv"'
        }
      })
    }

    return NextResponse.json({
      resumenPorMoneda,
      cuentasBancarias,
      estadisticas,
      filtros: {
        fechaInicio,
        fechaFin,
        cuentaId,
        moneda
      }
    })

  } catch (error) {
    console.error('Error al generar resumen financiero:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

function generateResumenCSV(resumenPorMoneda: ResumenPorMoneda[], cuentasBancarias: CuentaBancariaResumen[], estadisticas: EstadisticasResumen): string {
  const sections: string[] = []

  // Sección de resumen por moneda
  sections.push('RESUMEN POR MONEDA')
  sections.push('Moneda,Saldo Actual,Total Ingresos,Total Egresos,Flujo Neto,Ingresos Ventas,Ingresos Servicios,Ingresos Ajustes,Egresos Gastos,Egresos Ajustes')
  
  resumenPorMoneda.forEach((resumen: ResumenPorMoneda) => {
    sections.push([
      resumen.moneda,
      resumen.saldoActual,
      resumen.totalIngresos,
      resumen.totalEgresos,
      resumen.flujoNeto,
      resumen.desglose.ingresos.ventas,
      resumen.desglose.ingresos.servicios,
      resumen.desglose.ingresos.ajustes,
      resumen.desglose.egresos.gastos,
      resumen.desglose.egresos.ajustes
    ].join(','))
  })

  sections.push('')
  sections.push('CUENTAS BANCARIAS')
  sections.push('Banco,Número Cuenta,Saldo,Moneda')
  
  cuentasBancarias.forEach((cuenta: CuentaBancariaResumen) => {
    sections.push([
      cuenta.nombreBanco,
      cuenta.numeroCuenta,
      cuenta.saldo,
      cuenta.moneda || 'CUP'
    ].map((field: string | number) => `"${field}"`).join(','))
  })

  sections.push('')
  sections.push('ESTADÍSTICAS')
  sections.push(`Total Cuentas,${estadisticas.totalCuentas}`)
  sections.push(`Total Reconciliaciones,${estadisticas.totalReconciliaciones}`)
  sections.push(`Total Transferencias,${estadisticas.totalTransferencias}`)
  sections.push(`Total Ajustes,${estadisticas.totalAjustes}`)

  return sections.join('\n')
}
