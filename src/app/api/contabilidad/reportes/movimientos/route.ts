import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const { searchParams } = new URL(request.url)
    const busqueda = searchParams.get('busqueda')
    const fechaInicio = searchParams.get('fechaInicio')
    const fechaFin = searchParams.get('fechaFin')
    const cuentaId = searchParams.get('cuentaId')
    const tipoMovimiento = searchParams.get('tipoMovimiento') // 'venta', 'servicio', 'gasto', 'transferencia', 'ajuste'
    const moneda = searchParams.get('moneda')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const export_format = searchParams.get('formato') // 'csv' or 'pdf'

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

    // Obtener movimientos de ventas
    const ventasMovimientos = await prisma.reconciliacionVenta.findMany({
      where: {
        ...accountFilter,
        ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}),
        ...(moneda ? { moneda } : {})
      },
      select: {
        reconciliacionId: true,
        monto: true,
        moneda: true,
        montoConvertido: true,
        tasaCambio: true,
        fechaReconciliacion: true,
        observaciones: true,
        reconciliadoPor: true,
        tipoReconciliacion: true,
        venta: {
          select: {
            ventaId: true,
            total: true,
            createdAt: true
          }
        },
        prestamoCash: {
          select: {
            id: true,
            cliente: { select: { nombre: true } }
          }
        },
        deudaCash: {
          select: {
            id: true,
            proveedor: { select: { nombre: true } }
          }
        },
        cuentaBancaria: {
          select: {
            nombreBanco: true,
            numeroCuenta: true
          }
        },
        tipoPago: {
          select: {
            nombre: true
          }
        }
      },
      orderBy: { fechaReconciliacion: 'desc' }
    })

    // Obtener movimientos de servicios
    const serviciosMovimientos = await prisma.reconciliacionServicio.findMany({
      where: {
        ...accountFilter,
        ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}),
        ...(moneda ? { moneda } : {})
      },
      select: {
        reconciliacionId: true,
        monto: true,
        moneda: true,
        montoConvertido: true,
        tasaCambio: true,
        fechaReconciliacion: true,
        observaciones: true,
        reconciliadoPor: true,
        ventasServicio: {
          select: {
            ventaServicioId: true,
            // nota: el servicio relacionado se obtiene a través de ventasServicio
          }
        },
        cuentaBancaria: {
          select: {
            nombreBanco: true,
            numeroCuenta: true
          }
        },
        tipoPago: {
          select: {
            nombre: true
          }
        }
      },
      orderBy: { fechaReconciliacion: 'desc' }
    })

    // Obtener movimientos de gastos
    const gastosMovimientos = await prisma.reconciliacionGasto.findMany({
      where: {
        ...accountFilter,
        ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}),
        ...(moneda ? { moneda } : {})
      },
      select: {
        reconciliacionId: true,
        monto: true,
        moneda: true,
        montoConvertido: true,
        tasaCambio: true,
        tipoGasto: true,
        descripcion: true,
        periodo: true,
        fechaReconciliacion: true,
        observaciones: true,
        reconciliadoPor: true,
        cuentaBancaria: {
          select: {
            nombreBanco: true,
            numeroCuenta: true
          }
        },
        tipoPago: {
          select: {
            nombre: true
          }
        }
      },
      orderBy: { fechaReconciliacion: 'desc' }
    })

    // Obtener transferencias bancarias
    const transferenciasMovimientos = await prisma.transferenciaBancaria.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 ? { fechaTransferencia: dateFilter } : {}),
        ...(cuentaId ? {
          OR: [
            { cuentaOrigenId: cuentaId },
            { cuentaDestinoId: cuentaId }
          ]
        } : {}),
        ...(moneda ? {
          OR: [
            { monedaOrigen: moneda },
            { monedaDestino: moneda }
          ]
        } : {})
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
        descripcion: true,
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
      },
      orderBy: { fechaTransferencia: 'desc' }
    })

    // Obtener ajustes bancarios
    const ajustesMovimientos = await prisma.ajusteBancario.findMany({
      where: {
        ...accountFilter,
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        ...(moneda ? { moneda } : {})
      },
      select: {
        ajusteId: true,
        tipo: true,
        monto: true,
        moneda: true,
        montoConvertido: true,
        tasaCambio: true,
        descripcion: true,
        motivo: true,
        realizadoPor: true,
        createdAt: true,
        cuentaBancaria: {
          select: {
            nombreBanco: true,
            numeroCuenta: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Obtener inyecciones de capital
    const inyeccionesMovimientos = await prisma.inyeccionCapital.findMany({
      where: {
        ...accountFilter,
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        ...(moneda ? { moneda } : {})
      },
      select: {
        id: true,
        tipo: true,
        montoRecibido: true,
        moneda: true,
        descripcion: true,
        socio: true,
        entidadPrestamista: true,
        createdAt: true,
        cuentaBancaria: {
          select: {
            nombreBanco: true,
            numeroCuenta: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Obtener pagos de deuda
    const pagosDeudaMovimientos = await prisma.pagoDeuda.findMany({
      where: {
        ...accountFilter,
        ...(Object.keys(dateFilter).length > 0 ? { fechaPago: dateFilter } : {}),
        ...(moneda ? { cuentaBancaria: { moneda } } : {})
      },
      select: {
        id: true,
        montoPagado: true,
        fechaPago: true,
        comprobante: true,
        observaciones: true,
        cuentaBancaria: {
          select: {
            nombreBanco: true,
            numeroCuenta: true,
            moneda: true
          }
        },
        inyeccion: {
          select: {
            entidadPrestamista: true,
            tipo: true
          }
        }
      },
      orderBy: { fechaPago: 'desc' }
    })

    // Normalizar todos los movimientos a un formato común
    const movimientos = [
      ...ventasMovimientos.map((mov: any) => ({
        id: mov.reconciliacionId,
        tipo: (
          mov.tipoReconciliacion === 'PRESTAMO_CASH'
            ? 'prestamo_cash_pago'
            : mov.tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO'
            ? 'prestamo_cash_desembolso'
            : mov.tipoReconciliacion === 'DEUDA_CASH'
            ? 'deuda_cash_pago'
            : mov.tipoReconciliacion === 'DEUDA_CASH_DESEMBOLSO'
            ? 'deuda_cash_desembolso'
            : 'venta'
        ),
        fecha: mov.fechaReconciliacion,
        monto: Number(mov.monto),
        moneda: mov.moneda || 'CUP',
        montoConvertido: mov.tasaCambio ? Number(mov.monto) * Number(mov.tasaCambio) : Number(mov.monto),
        tasaCambio: mov.tasaCambio ? Number(mov.tasaCambio) : null,
        descripcion: mov.tipoReconciliacion === 'PRESTAMO_CASH'
          ? `Cobro de Préstamo Cash - ${mov.prestamoCash?.cliente?.nombre ?? mov.reconciliacionId}`
          : mov.tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO'
          ? `Desembolso de Préstamo Cash - ${mov.prestamoCash?.cliente?.nombre ?? mov.reconciliacionId}`
          : mov.tipoReconciliacion === 'DEUDA_CASH'
          ? `Pago de Deuda Cash - ${mov.deudaCash?.proveedor?.nombre ?? mov.reconciliacionId}`
          : mov.tipoReconciliacion === 'DEUDA_CASH_DESEMBOLSO'
          ? `Desembolso de Deuda Cash - ${mov.deudaCash?.proveedor?.nombre ?? mov.reconciliacionId}`
          : mov.venta ? `Venta ${mov.venta.ventaId}` : `Cobro reconciliado ${mov.reconciliacionId}`,
        cuenta: `${mov.cuentaBancaria.nombreBanco} - ${mov.cuentaBancaria.numeroCuenta}`,
        tipoPago: mov.tipoPago.nombre,
        observaciones: mov.observaciones,
        realizadoPor: mov.reconciliadoPor,
        referencia: mov.tipoReconciliacion === 'PRESTAMO_CASH' || mov.tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO'
          ? (mov.prestamoCash?.id ?? mov.reconciliacionId)
          : mov.tipoReconciliacion === 'DEUDA_CASH' || mov.tipoReconciliacion === 'DEUDA_CASH_DESEMBOLSO'
          ? (mov.deudaCash?.id ?? mov.reconciliacionId)
          : (mov.venta?.ventaId ?? mov.reconciliacionId),
        detalles: {
          tipoReconciliacion: mov.tipoReconciliacion,
          totalVenta: mov.venta ? Number(mov.venta.total) : null,
          fechaVenta: mov.venta?.createdAt ?? null,
          prestamoCashId: mov.tipoReconciliacion === 'PRESTAMO_CASH' || mov.tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO' ? mov.prestamoCash?.id ?? null : null,
          clientePrestamo: mov.tipoReconciliacion === 'PRESTAMO_CASH' || mov.tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO' ? mov.prestamoCash?.cliente?.nombre ?? null : null,
          esPrestamoCash: mov.tipoReconciliacion === 'PRESTAMO_CASH' || mov.tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO'
        }
      })),
      ...serviciosMovimientos.map((mov: any) => ({
        id: mov.reconciliacionId,
        tipo: 'servicio' as const,
        fecha: mov.fechaReconciliacion,
        monto: Number(mov.monto),
        moneda: mov.moneda || 'CUP',
        montoConvertido: mov.tasaCambio ? Number(mov.monto) * Number(mov.tasaCambio) : Number(mov.monto),
        tasaCambio: mov.tasaCambio ? Number(mov.tasaCambio) : null,
        descripcion: `Servicio ${mov.ventasServicio.ventaServicioId}`,
        cuenta: `${mov.cuentaBancaria.nombreBanco} - ${mov.cuentaBancaria.numeroCuenta}`,
        tipoPago: mov.tipoPago.nombre,
        observaciones: mov.observaciones,
        realizadoPor: mov.reconciliadoPor,
        referencia: mov.ventasServicio.ventaServicioId,
        detalles: {
          ventaServicioId: mov.ventasServicio.ventaServicioId
        }
      })),
      ...gastosMovimientos.map((mov: any) => ({
        id: mov.reconciliacionId,
        tipo: mov.tipoGasto === 'salario' ? 'salario' : 'gasto',
        fecha: mov.fechaReconciliacion,
        monto: -Number(mov.monto),
        moneda: mov.moneda || 'CUP',
        montoConvertido: mov.tasaCambio ? -Number(mov.monto) * Number(mov.tasaCambio) : -Number(mov.monto),
        tasaCambio: mov.tasaCambio ? Number(mov.tasaCambio) : null,
        descripcion: mov.descripcion,
        cuenta: `${mov.cuentaBancaria.nombreBanco} - ${mov.cuentaBancaria.numeroCuenta}`,
        tipoPago: mov.tipoPago.nombre,
        observaciones: mov.observaciones,
        realizadoPor: mov.reconciliadoPor,
        referencia: mov.reconciliacionId,
        detalles: {
          tipoGasto: mov.tipoGasto,
          periodo: mov.periodo
        }
      })),
      ...transferenciasMovimientos.flatMap((mov: any) => {
        const movimientos = []

        // Movimiento de salida (cuenta origen)
        if (!cuentaId || mov.cuentaOrigen) {
          movimientos.push({
            id: `${mov.transferenciaId}-origen`,
            tipo: 'transferencia_salida' as const,
            fecha: mov.fechaTransferencia,
            monto: -Number(mov.montoOrigen), // Negativo para salida
            moneda: mov.monedaOrigen || 'CUP',
            montoConvertido: null,
            tasaCambio: mov.tasaCambio ? Number(mov.tasaCambio) : null,
            descripcion: `Transferencia a ${mov.cuentaDestino.nombreBanco}`,
            cuenta: `${mov.cuentaOrigen.nombreBanco} - ${mov.cuentaOrigen.numeroCuenta}`,
            tipoPago: 'Transferencia',
            observaciones: mov.descripcion,
            referencia: mov.numeroComprobante,
            detalles: {
              motivo: mov.motivo,
              cuentaDestino: `${mov.cuentaDestino.nombreBanco} - ${mov.cuentaDestino.numeroCuenta}`
            }
          })
        }

        // Movimiento de entrada (cuenta destino)
        if (!cuentaId || mov.cuentaDestino) {
          movimientos.push({
            id: `${mov.transferenciaId}-destino`,
            tipo: 'transferencia_entrada' as const,
            fecha: mov.fechaTransferencia,
            monto: Number(mov.montoDestino),
            moneda: mov.monedaDestino || 'CUP',
            montoConvertido: Number(mov.montoDestino),
            tasaCambio: mov.tasaCambio ? Number(mov.tasaCambio) : null,
            descripcion: `Transferencia desde ${mov.cuentaOrigen.nombreBanco}`,
            cuenta: `${mov.cuentaDestino.nombreBanco} - ${mov.cuentaDestino.numeroCuenta}`,
            tipoPago: 'Transferencia',
            observaciones: mov.descripcion,
            referencia: mov.numeroComprobante,
            detalles: {
              motivo: mov.motivo,
              cuentaOrigen: `${mov.cuentaOrigen.nombreBanco} - ${mov.cuentaOrigen.numeroCuenta}`
            }
          })
        }

        return movimientos
      }),
      ...ajustesMovimientos.map((mov: any) => ({
        id: mov.ajusteId,
        tipo: mov.tipo === 'ingreso' ? 'ajuste_ingreso' : 'ajuste_egreso' as const,
        fecha: mov.createdAt,
        monto: mov.tipo === 'ingreso' ? Number(mov.monto) : -Number(mov.monto),
        moneda: mov.moneda || 'CUP',
        montoConvertido: mov.tasaCambio ? 
          (mov.tipo === 'ingreso' ? Number(mov.monto) * Number(mov.tasaCambio) : -Number(mov.monto) * Number(mov.tasaCambio)) : 
          (mov.tipo === 'ingreso' ? Number(mov.monto) : -Number(mov.monto)),
        tasaCambio: mov.tasaCambio ? Number(mov.tasaCambio) : null,
        descripcion: mov.descripcion,
        cuenta: `${mov.cuentaBancaria.nombreBanco} - ${mov.cuentaBancaria.numeroCuenta}`,
        tipoPago: mov.tipo === 'ingreso' ? 'Ajuste Ingreso' : 'Ajuste Egreso',
        observaciones: mov.motivo,
        realizadoPor: mov.realizadoPor,
        referencia: mov.ajusteId,
        detalles: {
          tipoAjuste: mov.tipo,
          motivo: mov.motivo
        }
      })),
      ...inyeccionesMovimientos.map((mov: any) => ({
        id: mov.id,
        tipo: 'inyeccion_capital' as const,
        fecha: mov.createdAt,
        monto: Number(mov.montoRecibido),
        moneda: mov.moneda || 'CUP',
        montoConvertido: Number(mov.montoRecibido),
        tasaCambio: null,
        descripcion: mov.tipo === "CAPITAL_SOCIAL" ? `Aportación Capital: ${mov.socio}` : `Préstamo: ${mov.entidadPrestamista}`,
        cuenta: `${mov.cuentaBancaria.nombreBanco} - ${mov.cuentaBancaria.numeroCuenta}`,
        tipoPago: mov.tipo === "CAPITAL_SOCIAL" ? 'Capital Social' : 'Deuda Externa',
        observaciones: mov.descripcion,
        realizadoPor: 'Sistema',
        referencia: mov.id,
        detalles: {
          tipoInyeccion: mov.tipo,
          entidad: mov.tipo === "CAPITAL_SOCIAL" ? mov.socio : mov.entidadPrestamista
        }
      })),
      ...pagosDeudaMovimientos.map((mov: any) => ({
        id: mov.id,
        tipo: 'pago_deuda' as const,
        fecha: mov.fechaPago,
        monto: -Number(mov.montoPagado),
        moneda: mov.cuentaBancaria.moneda || 'CUP',
        montoConvertido: -Number(mov.montoPagado),
        tasaCambio: null,
        descripcion: `Pago Deuda: ${mov.inyeccion.entidadPrestamista}`,
        cuenta: `${mov.cuentaBancaria.nombreBanco} - ${mov.cuentaBancaria.numeroCuenta}`,
        tipoPago: 'Pago Deuda',
        observaciones: mov.observaciones,
        realizadoPor: 'Sistema',
        referencia: mov.comprobante || mov.id,
        detalles: {
          comprobante: mov.comprobante
        }
      }))
    ]

    // Filtrar por tipo de movimiento si se especifica
    let movimientosFiltrados = tipoMovimiento && tipoMovimiento !== "all"
      ? movimientos.filter(mov => mov.tipo === tipoMovimiento)
      : movimientos

    // Filtrar por búsqueda si se especifica
    if (busqueda) {
      movimientosFiltrados = movimientosFiltrados.filter(mov =>
        mov.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
        mov.referencia?.toLowerCase().includes(busqueda.toLowerCase()) ||
        mov.observaciones?.toLowerCase().includes(busqueda.toLowerCase())
      )
    }

    // Ordenar por fecha descendente
    movimientosFiltrados.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

    // Aplicar paginación
    const offset = (page - 1) * limit
    const movimientosPaginados = movimientosFiltrados.slice(offset, offset + limit)

    // Si se solicita exportación, generar el archivo
    if (export_format === 'csv') {
      const csvContent = generateCSV(movimientosFiltrados)
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="movimientos.csv"'
        }
      })
    }

    // Calcular totales por moneda
    const totalesPorMoneda = movimientosFiltrados.reduce((acc, mov) => {
      const moneda = mov.moneda
      if (!acc[moneda]) {
        acc[moneda] = { ingresos: 0, egresos: 0, neto: 0 }
      }

      if (mov.monto > 0) {
        acc[moneda].ingresos += mov.monto
      } else {
        acc[moneda].egresos += Math.abs(mov.monto)
      }
      acc[moneda].neto += mov.monto

      return acc
    }, {} as Record<string, { ingresos: number, egresos: number, neto: number }>)

    return NextResponse.json({
      data: movimientosPaginados,
      totales: totalesPorMoneda,
      pagination: {
        page,
        limit,
        total: movimientosFiltrados.length,
        totalPages: Math.ceil(movimientosFiltrados.length / limit)
      },
      filtros: {
        busqueda,
        fechaInicio,
        fechaFin,
        cuentaId,
        tipoMovimiento,
        moneda
      }
    })

  } catch (error) {
    console.error('Error al obtener movimientos:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

function generateCSV(movimientos: unknown[]): string {
  const headers = [
    'Fecha',
    'Tipo',
    'Descripción',
    'Cuenta',
    'Tipo Pago',
    'Monto',
    'Moneda',
    'Monto Convertido',
    'Tasa Cambio',
    'Realizado Por',
    'Referencia',
    'Observaciones'
  ]

  const rows = movimientos.map((mov: any) => [
    new Date(mov.fecha).toLocaleDateString(),
    mov.tipo,
    mov.descripcion,
    mov.cuenta,
    mov.tipoPago,
    mov.monto.toString(),
    mov.moneda,
    mov.montoConvertido?.toString() || '',
    mov.tasaCambio?.toString() || '',
    mov.realizadoPor,
    mov.referencia,
    mov.observaciones || ''
  ])

  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n')

  return csvContent
}
