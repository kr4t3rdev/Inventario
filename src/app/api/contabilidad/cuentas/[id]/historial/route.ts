import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Interfaces para tipos de datos
interface FiltrosFecha {
  gte?: Date
  lte?: Date
}

interface FiltrosTransaccion {
  cuentaId: string
  fecha?: FiltrosFecha
  tipoMovimiento?: string
}

interface TransaccionUnificada {
  transaccionId: string
  fecha: Date
  tipoMovimiento: string
  descripcion: string
  observaciones?: string | null
  monedaOriginal: string
  montoOriginal: number
  tasaCambio?: number | null
  montoConvertido: number
  esIngreso: boolean
  detalles?: Record<string, unknown>
  saldoDespues?: number
}

// Función auxiliar para calcular el monto convertido a la moneda de la cuenta
function calcularMontoConvertido(
  montoOriginal: number,
  monedaOriginal: string,
  cuentaMoneda: string,
  tasaCambio?: number | null
): number {
  if (monedaOriginal === cuentaMoneda) {
    return montoOriginal
  }
  if (tasaCambio && tasaCambio > 0) {
    return montoOriginal * tasaCambio
  }
  // Si no hay tasa de cambio, devolver el monto original (asumiendo que ya está en la moneda correcta o no se puede convertir)
  console.warn(`No se pudo convertir ${montoOriginal} de ${monedaOriginal} a ${cuentaMoneda}, tasaCambio: ${tasaCambio}`)
  return montoOriginal
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cuentaId = id
    const { searchParams } = new URL(request.url)

    const fechaInicio = searchParams.get("fechaInicio")
    const fechaFin = searchParams.get("fechaFin")
    const tipoMovimiento = searchParams.get("tipoMovimiento")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const export_format = searchParams.get("formato") // 'csv' or 'pdf'

    // Verificar que la cuenta existe
    const cuenta = await prisma.cuentaBancaria.findUnique({
      where: { cuentaId }
    })

    if (!cuenta) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      )
    }

    // Construir filtros
    const filtros: FiltrosTransaccion = {
      cuentaId
    }

    if (fechaInicio || fechaFin) {
      filtros.fecha = {}
      if (fechaInicio) {
        filtros.fecha.gte = new Date(fechaInicio)
      }
      if (fechaFin) {
        filtros.fecha.lte = new Date(fechaFin)
      }
    }

    if (tipoMovimiento) {
      filtros.tipoMovimiento = tipoMovimiento
    }

    // Construir filtros de fecha para todas las consultas
    const fechaFiltros: FiltrosFecha = {}
    if (fechaInicio || fechaFin) {
      if (fechaInicio) {
        fechaFiltros.gte = new Date(fechaInicio)
      }
      if (fechaFin) {
        fechaFiltros.lte = new Date(fechaFin)
      }
    }

    // Obtener todas las transacciones relacionadas con la cuenta
    const [reconciliacionesVenta, reconciliacionesServicio, reconciliacionesGasto, ajustesBancarios, inyeccionesCapital, pagosDeuda, transferenciasOrigen, transferenciasDestino] = await Promise.all([
      // Reconciliaciones de ventas
      prisma.reconciliacionVenta.findMany({
        where: {
          cuentaId,
          ...(fechaFiltros && Object.keys(fechaFiltros).length > 0 && {
            fechaReconciliacion: fechaFiltros
          })
        },
        include: {
          venta: true,
          prestamoCash: {
            include: { cliente: { select: { nombre: true } } }
          },
          deudaCash: {
            include: { proveedor: { select: { nombre: true } } }
          },
          cuentaBancaria: true,
          tipoPago: true
        },
        orderBy: { fechaReconciliacion: 'desc' }
      }),

      // Reconciliaciones de servicios
      prisma.reconciliacionServicio.findMany({
        where: {
          cuentaId,
          ...(fechaFiltros && Object.keys(fechaFiltros).length > 0 && {
            fechaReconciliacion: fechaFiltros
          })
        },
        include: {
          cuentaBancaria: true,
          tipoPago: true
        },
        orderBy: { fechaReconciliacion: 'desc' }
      }),

      // Reconciliaciones de gastos
      prisma.reconciliacionGasto.findMany({
        where: {
          cuentaId,
          ...(fechaFiltros && Object.keys(fechaFiltros).length > 0 && {
            fechaReconciliacion: fechaFiltros
          })
        },
        include: {
          cuentaBancaria: true,
          tipoPago: true,
          pagoSalario: {
            include: {
              empleado: true
            }
          },
          gastoDE: true,
          gastoCompra: true
        },
        orderBy: { fechaReconciliacion: 'desc' }
      }),

      // Ajustes bancarios
      prisma.ajusteBancario.findMany({
        where: {
          cuentaId,
          ...(fechaFiltros && Object.keys(fechaFiltros).length > 0 && {
            createdAt: fechaFiltros
          })
        },
        include: {
          cuentaBancaria: true
        },
        orderBy: { createdAt: 'desc' }
      }),

      // Inyecciones de Capital
      prisma.inyeccionCapital.findMany({
        where: {
          cuentaId,
          ...(fechaFiltros && Object.keys(fechaFiltros).length > 0 && {
            createdAt: fechaFiltros
          })
        },
        include: {
          cuentaBancaria: true
        },
        orderBy: { createdAt: 'desc' }
      }),

      // Pagos de Deuda
      prisma.pagoDeuda.findMany({
        where: {
          cuentaId,
          ...(fechaFiltros && Object.keys(fechaFiltros).length > 0 && {
            fechaPago: fechaFiltros
          })
        },
        include: {
          cuentaBancaria: true,
          inyeccion: true
        },
        orderBy: { fechaPago: 'desc' }
      }),

      // Transferencias como origen
      prisma.transferenciaBancaria.findMany({
        where: {
          cuentaOrigenId: cuentaId,
          ...(fechaFiltros && Object.keys(fechaFiltros).length > 0 && {
            fechaTransferencia: fechaFiltros
          })
        },
        include: {
          cuentaOrigen: true,
          cuentaDestino: true
        },
        orderBy: { fechaTransferencia: 'desc' }
      }),

      // Transferencias como destino
      prisma.transferenciaBancaria.findMany({
        where: {
          cuentaDestinoId: cuentaId,
          ...(fechaFiltros && Object.keys(fechaFiltros).length > 0 && {
            fechaTransferencia: fechaFiltros
          })
        },
        include: {
          cuentaOrigen: true,
          cuentaDestino: true
        },
        orderBy: { fechaTransferencia: 'desc' }
      })
    ])

    // Combinar todas las transacciones en un formato unificado
    const todasTransacciones: TransaccionUnificada[] = []

    // Agregar reconciliaciones de ventas (ingresos)
    reconciliacionesVenta.forEach((rec: any) => {
      todasTransacciones.push({
        transaccionId: rec.reconciliacionId,
        fecha: rec.fechaReconciliacion,
        tipoMovimiento: rec.tipoReconciliacion === 'PRESTAMO_CASH'
          ? 'prestamo_cash'
          : rec.tipoReconciliacion === 'DEUDA_CASH'
          ? 'deuda_cash'
          : 'venta',
        descripcion: rec.tipoReconciliacion === 'PRESTAMO_CASH'
          ? `Préstamo Cash - ${rec.prestamoCash?.cliente?.nombre ?? rec.reconciliacionId}`
          : rec.tipoReconciliacion === 'DEUDA_CASH'
          ? `Deuda Cash - ${rec.deudaCash?.proveedor?.nombre ?? rec.reconciliacionId}`
          : `Venta reconciliada - ${rec.venta?.ventaId || 'N/A'}`,
        observaciones: rec.observaciones,
        monedaOriginal: rec.moneda,
        montoOriginal: Number(rec.monto),
        tasaCambio: rec.tasaCambio ? Number(rec.tasaCambio) : null,
        montoConvertido: calcularMontoConvertido(Number(rec.monto), rec.moneda, cuenta.moneda, rec.tasaCambio ? Number(rec.tasaCambio) : null),
        esIngreso: rec.tipoReconciliacion !== 'DEUDA_CASH',
        detalles: {
          tipoPago: rec.tipoPago?.nombre,
          tipoReconciliacion: rec.tipoReconciliacion,
          venta: rec.venta
        }
      })
    })

    // Agregar reconciliaciones de servicios (ingresos)
    reconciliacionesServicio.forEach((rec: any) => {
      todasTransacciones.push({
        transaccionId: rec.reconciliacionId,
        fecha: rec.fechaReconciliacion,
        tipoMovimiento: 'servicio',
        descripcion: `Servicio reconciliado - ${rec.reconciliadoPor}`,
        observaciones: rec.observaciones,
        monedaOriginal: rec.moneda,
        montoOriginal: Number(rec.monto),
        tasaCambio: rec.tasaCambio ? Number(rec.tasaCambio) : null,
        montoConvertido: Number(rec.montoConvertido || rec.monto),
        esIngreso: true,
        detalles: {
          tipoPago: rec.tipoPago?.nombre,
        }
      })
    })

    // Agregar reconciliaciones de gastos (egresos)
    reconciliacionesGasto.forEach((rec: any) => {
      todasTransacciones.push({
        transaccionId: rec.reconciliacionId,
        fecha: rec.fechaReconciliacion,
        tipoMovimiento: rec.tipoGasto,
        descripcion: rec.descripcion,
        observaciones: rec.observaciones,
        monedaOriginal: rec.moneda,
        montoOriginal: Number(rec.monto),
        tasaCambio: Number(rec.tasaCambio),
        montoConvertido: Number(rec.montoConvertido || rec.monto),
        esIngreso: false,
        detalles: {
          tipoPago: rec.tipoPago?.nombre,
          empleado: rec.pagoSalario?.empleado,
          gastoDE: rec.gastoDE,
          gastoCompra: rec.gastoCompra
        }
      })
    })

    // Agregar ajustes bancarios
    ajustesBancarios.forEach((ajuste: any) => {
      todasTransacciones.push({
        transaccionId: ajuste.ajusteId,
        fecha: ajuste.createdAt,
        tipoMovimiento: `ajuste_${ajuste.tipo}`,
        descripcion: ajuste.descripcion ?? 'Ajuste bancario',
        observaciones: ajuste.motivo,
        monedaOriginal: ajuste.moneda,
        montoOriginal: Number(ajuste.monto),
        tasaCambio: ajuste.tasaCambio ? Number(ajuste.tasaCambio) : null,
        montoConvertido: Number(ajuste.montoConvertido || ajuste.monto),
        esIngreso: ajuste.tipo === 'ingreso',
        detalles: {
          tipo: ajuste.tipo,
          realizadoPor: ajuste.realizadoPor
        }
      })
    })

    // Agregar inyecciones de capital
    inyeccionesCapital.forEach((iny: any) => {
      todasTransacciones.push({
        transaccionId: iny.id,
        fecha: iny.createdAt,
        tipoMovimiento: 'inyeccion_capital',
        descripcion: iny.tipo === "CAPITAL_SOCIAL" ? `Inyección Capital Social - ${iny.socio}` : `Préstamo Recibido - ${iny.entidadPrestamista}`,
        observaciones: iny.descripcion,
        monedaOriginal: iny.moneda,
        montoOriginal: Number(iny.montoRecibido),
        tasaCambio: null,
        montoConvertido: Number(iny.montoRecibido),
        esIngreso: true,
        detalles: {
          tipoInyeccion: iny.tipo,
          entidad: iny.tipo === "CAPITAL_SOCIAL" ? iny.socio : iny.entidadPrestamista
        }
      })
    })

    // Agregar pagos de deuda
    pagosDeuda.forEach((pago: any) => {
      todasTransacciones.push({
        transaccionId: pago.id,
        fecha: pago.fechaPago,
        tipoMovimiento: 'pago_deuda',
        descripcion: `Pago Deuda - ${pago.inyeccion.entidadPrestamista}`,
        observaciones: pago.observaciones,
        monedaOriginal: pago.cuentaBancaria.moneda,
        montoOriginal: Number(pago.montoPagado),
        tasaCambio: null,
        montoConvertido: Number(pago.montoPagado),
        esIngreso: false,
        detalles: {
          comprobante: pago.comprobante
        }
      })
    })

    // Agregar transferencias de salida (egresos)
    transferenciasOrigen.forEach((transfer: any) => {
      todasTransacciones.push({
        transaccionId: transfer.transferenciaId,
        fecha: transfer.fechaTransferencia,
        tipoMovimiento: 'transferencia_salida',
        descripcion: `Transferencia a ${transfer.cuentaDestino?.nombreBanco}`,
        observaciones: transfer.descripcion,
        monedaOriginal: transfer.monedaOrigen,
        montoOriginal: Number(transfer.montoOrigen),
        tasaCambio: transfer.tasaCambio ? Number(transfer.tasaCambio) : null,
        montoConvertido: Number(transfer.montoOrigen),
        esIngreso: false,
        detalles: {
          numeroComprobante: transfer.numeroComprobante,
          cuentaDestino: transfer.cuentaDestino,
          motivo: transfer.motivo
        }
      })
    })

    // Agregar transferencias de entrada (ingresos)
    transferenciasDestino.forEach((transfer: any) => {
      todasTransacciones.push({
        transaccionId: transfer.transferenciaId,
        fecha: transfer.fechaTransferencia,
        tipoMovimiento: 'transferencia_entrada',
        descripcion: `Transferencia desde ${transfer.cuentaOrigen?.nombreBanco}`,
        observaciones: transfer.descripcion,
        monedaOriginal: transfer.monedaDestino,
        montoOriginal: Number(transfer.montoDestino),
        tasaCambio: transfer.tasaCambio ? Number(transfer.tasaCambio) : null,
        montoConvertido: Number(transfer.montoDestino),
        esIngreso: true,
        detalles: {
          numeroComprobante: transfer.numeroComprobante,
          cuentaOrigen: transfer.cuentaOrigen,
          motivo: transfer.motivo
        }
      })
    })

    // Filtrar por tipo de movimiento si se especifica
    let transaccionesFiltradas = todasTransacciones
    if (tipoMovimiento && tipoMovimiento !== 'all') {
      transaccionesFiltradas = todasTransacciones.filter((t: TransaccionUnificada) => t.tipoMovimiento === tipoMovimiento)
    }

    // Ordenar por fecha descendente
    transaccionesFiltradas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

    // Si se solicita exportación, generar el archivo
    if (export_format === 'csv') {
      const csvContent = generateCSV(transaccionesFiltradas)
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="historial-cuenta.csv"'
        }
      })
    }

    // Calcular totales
    const total = transaccionesFiltradas.length

    // Aplicar paginación
    const transaccionesPaginadas = transaccionesFiltradas.slice((page - 1) * limit, page * limit)

    // Calcular saldo después de cada transacción (simplificado)
    const transaccionesConSaldo = transaccionesPaginadas.map((transaccion) => ({
      ...transaccion,
      saldoDespues: cuenta.saldo // Por simplicidad, usamos el saldo actual
    }))

    // Calcular resumen del período
    const totalIngresos = transaccionesFiltradas
      .filter(t => t.esIngreso)
      .reduce((sum, t) => sum + Number(t.montoConvertido), 0)

    const totalEgresos = transaccionesFiltradas
      .filter(t => !t.esIngreso)
      .reduce((sum, t) => sum + Number(t.montoConvertido), 0)

    const totalTransferencias = transaccionesFiltradas
      .filter(t => t.tipoMovimiento.includes('transferencia'))
      .length

    const resumen = {
      saldoActual: Number(cuenta.saldo),
      totalIngresos,
      totalEgresos,
      totalTransferencias,
      totalMovimientos: transaccionesFiltradas.length
    }

    const pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }

    return NextResponse.json({
      transacciones: transaccionesConSaldo,
      resumen,
      pagination
    })

  } catch (error) {
    console.error("Error al obtener historial de cuenta:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

function generateCSV(transacciones: TransaccionUnificada[]): string {
  const headers = [
    'Fecha',
    'Tipo',
    'Descripción',
    'Moneda Original',
    'Monto Original',
    'Tasa Cambio',
    'Monto Convertido',
    'Observaciones'
  ]

  const rows = transacciones.map((transaccion) => [
    new Date(transaccion.fecha).toLocaleDateString(),
    transaccion.tipoMovimiento,
    transaccion.descripcion,
    transaccion.monedaOriginal,
    transaccion.montoOriginal.toString(),
    transaccion.tasaCambio?.toString() || '',
    transaccion.montoConvertido.toString(),
    transaccion.observaciones || ''
  ])

  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n')

  return csvContent
}