import { Prisma } from '@/generated/prisma'

export type TipoVencimientoFactura = 'fecha' | 'plazo' | 'contra_pago'

const PLAZO_VENCIMIENTO_DIAS = 30

export function normalizeTipoVencimiento(
  tipoVencimiento?: string | null
): TipoVencimientoFactura {
  const normalized = (tipoVencimiento || '').trim().toLowerCase()

  if (normalized === 'fecha') {
    return 'fecha'
  }

  if (normalized === 'credito' || normalized === 'crédito') {
    return 'fecha'
  }

  if (normalized === 'plazo' || normalized === 'plazo_30') {
    return 'plazo'
  }

  if (
    normalized === 'contra_pago' ||
    normalized === 'contra_entrega' ||
    normalized === 'contraentrega'
  ) {
    return 'contra_pago'
  }

  return 'contra_pago'
}

export function resolveFechaVencimiento(
  tipoVencimiento: TipoVencimientoFactura,
  fechaVencimiento?: string | null
): Date | null {
  if (tipoVencimiento === 'contra_pago') {
    return null
  }

  if (tipoVencimiento === 'plazo') {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + PLAZO_VENCIMIENTO_DIAS)
    return fecha
  }

  if (!fechaVencimiento) {
    throw new Error('La fecha de vencimiento es obligatoria para tipo fecha')
  }

  const parsed = new Date(fechaVencimiento)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Fecha de vencimiento inválida')
  }

  return parsed
}

export interface FacturacionCobroWorkflowParams {
  ventaId: string
  facturaId: string
  clienteId: string
  montoTotal: number
  usuarioId: string
  tenantId: string
  observaciones?: string | null
  tipoVencimiento?: string | null
  fechaVencimiento?: string | null
  cuentaBancariaId?: string | null
}

interface CuentaTipoPagoResolucion {
  cuenta: {
    cuentaId: string
    moneda: string
  }
  tipoPago: {
    tipoId: string
    nombre: string
  }
}

async function resolveCuentaYTipoPago(
  tx: Prisma.TransactionClient,
  cuentaBancariaId?: string | null
): Promise<CuentaTipoPagoResolucion> {
  let cuentaPreferida: { cuentaId: string; moneda: string } | null = null
  if (cuentaBancariaId) {
    cuentaPreferida = await tx.cuentaBancaria.findFirst({
      where: {
        cuentaId: cuentaBancariaId,
        isActive: true
      },
      select: {
        cuentaId: true,
        moneda: true
      }
    })
  }

  const tipoPagoActivos = await tx.tipoPago.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: {
      tipoId: true,
      nombre: true,
      cuentaDefecto: true
    }
  })

  if (tipoPagoActivos.length === 0) {
    throw new Error('No hay tipos de pago activos para registrar el cobro')
  }

  let cuentaDefecto: { cuentaId: string; moneda: string } | null = null
  let tipoPagoSeleccionado = tipoPagoActivos[0]

  for (const tipoPago of tipoPagoActivos) {
    if (!tipoPago.cuentaDefecto) {
      continue
    }

    const cuenta = await tx.cuentaBancaria.findFirst({
      where: {
        cuentaId: tipoPago.cuentaDefecto,
        isActive: true
      },
      select: {
        cuentaId: true,
        moneda: true
      }
    })

    if (!cuenta) {
      continue
    }

    cuentaDefecto = cuenta
    tipoPagoSeleccionado = tipoPago
    break
  }

  const cuentaFallback =
    cuentaPreferida ||
    cuentaDefecto ||
    (await tx.cuentaBancaria.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        cuentaId: true,
        moneda: true
      }
    }))

  if (!cuentaFallback) {
    throw new Error('No hay cuentas bancarias activas para registrar el cobro')
  }

  return {
    cuenta: cuentaFallback,
    tipoPago: {
      tipoId: tipoPagoSeleccionado.tipoId,
      nombre: tipoPagoSeleccionado.nombre
    }
  }
}

export interface ReconciliacionDirectaParams {
  ventaId: string
  montoTotal: number
  usuarioId: string
  tenantId: string
  observaciones?: string | null
  cuentaBancariaId?: string | null
}

export async function reconciliarVentaDirecta(
  tx: Prisma.TransactionClient,
  params: ReconciliacionDirectaParams
): Promise<string> {
  const montoTotal = Number(params.montoTotal || 0)
  if (!Number.isFinite(montoTotal) || montoTotal <= 0) {
    throw new Error('El monto total de la venta debe ser mayor que cero')
  }

  const { cuenta, tipoPago } = await resolveCuentaYTipoPago(tx, params.cuentaBancariaId)
  
  // Para ventas directas sin factura, usamos una referencia genérica
  const referenciaCobro = `AUTO-${params.ventaId.slice(-8)}`

  const reconciliacion = await tx.reconciliacionVenta.create({
    data: {
      tenantId: params.tenantId,
      ventaId: params.ventaId,
      cuentaId: cuenta.cuentaId,
      tipoPagoId: tipoPago.tipoId,
      monto: montoTotal,
      moneda: cuenta.moneda,
      tasaCambio: 1,
      montoConvertido: montoTotal,
      verificacionTransferenciaId: referenciaCobro,
      idTransferencia: referenciaCobro,
      observaciones: params.observaciones || `Venta directa al contado`,
      reconciliadoPor: params.usuarioId
    }
  })

  await tx.cuentaBancaria.update({
    where: { cuentaId: cuenta.cuentaId },
    data: {
      saldo: {
        increment: montoTotal
      }
    }
  })

  return reconciliacion.reconciliacionId
}

export async function applyFacturacionCobroWorkflow(
  tx: Prisma.TransactionClient,
  params: FacturacionCobroWorkflowParams
): Promise<{ tipoVencimiento: TipoVencimientoFactura; reconciliacionId: string | null }> {
  const montoTotal = Number(params.montoTotal || 0)
  if (!Number.isFinite(montoTotal) || montoTotal <= 0) {
    throw new Error('El monto total de la factura debe ser mayor que cero')
  }

  const tipoVencimiento = params.tipoVencimiento
    ? normalizeTipoVencimiento(params.tipoVencimiento)
    : (params.fechaVencimiento ? 'fecha' : 'contra_pago')
  
  const fechaVencimiento = resolveFechaVencimiento(
    tipoVencimiento,
    params.fechaVencimiento
  )

  if (tipoVencimiento === 'contra_pago') {
    const { cuenta, tipoPago } = await resolveCuentaYTipoPago(tx, params.cuentaBancariaId)
    const referenciaCobro = `AUTO-${params.facturaId.slice(-8)}`

    const reconciliacion = await tx.reconciliacionVenta.create({
      data: {
        tenantId: params.tenantId,
        ventaId: params.ventaId,
        cuentaId: cuenta.cuentaId,
        tipoPagoId: tipoPago.tipoId,
        monto: montoTotal,
        moneda: cuenta.moneda,
        tasaCambio: 1,
        montoConvertido: montoTotal,
        verificacionTransferenciaId: referenciaCobro,
        idTransferencia: referenciaCobro,
        observaciones: params.observaciones || `Cobro total por contra pago`,
        reconciliadoPor: params.usuarioId
      }
    })

    await tx.cuentaBancaria.update({
      where: { cuentaId: cuenta.cuentaId },
      data: {
        saldo: {
          increment: montoTotal
        }
      }
    })

    await tx.factura.update({
      where: { idFactura: params.facturaId },
      data: {
        estado: 'PAGADA',
        fechaVencimiento: null
      }
    })

    return {
      tipoVencimiento,
      reconciliacionId: reconciliacion.reconciliacionId
    }
  }

  await tx.cuentaPorCobrar.upsert({
    where: { facturaId: params.facturaId },
    update: {
      clienteId: params.clienteId,
      montoDeuda: montoTotal,
      montoPagado: 0,
      estado: 'PENDIENTE',
      fechaVencimiento,
      idTransferencia: null
    },
    create: {
      tenantId: params.tenantId,
      facturaId: params.facturaId,
      clienteId: params.clienteId,
      montoDeuda: montoTotal,
      montoPagado: 0,
      estado: 'PENDIENTE',
      fechaVencimiento
    }
  })

  await tx.factura.update({
    where: { idFactura: params.facturaId },
    data: {
      estado: 'PENDIENTE',
      fechaVencimiento
    }
  })

  return { tipoVencimiento, reconciliacionId: null }
}
