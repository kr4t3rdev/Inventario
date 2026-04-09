import { PrismaClient } from '../../src/generated/prisma'

const prisma = new PrismaClient()

/**
 * @description Resume de alertas detectadas para QA con formato de reporte visual.
 */
interface QaAlertasResumen {
  total: number
  porTipo: {
    ALERTA_STOCK: number
    ALERTA_MARGEN: number
    ALERTA_VENCIMIENTO: number
  }
}

/**
 * @description Detecta productos con stock critico o agotado.
 * @returns {Promise<Array>} Productos en alerta de inventario
 */
async function detectarAlertasStock(): Promise<
  Array<{ id: string; nombre: string; stock: number; stockMinimo: number; tipo: string }>
> {
  const productos = await prisma.producto.findMany({
    select: { id: true, nombre: true, stock: true, stockMinimo: true }
  })

  return productos
    .filter((p) => p.stock === 0 || p.stock <= p.stockMinimo)
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      stock: p.stock,
      stockMinimo: p.stockMinimo,
      tipo: p.stock === 0 ? 'AGOTADO' : 'CRÍTICO'
    }))
}

/**
 * @description Detecta productos con margen negativo o nulo.
 * @returns {Promise<Array>} Productos con precios anomalos
 */
async function detectarAlertasMargen(): Promise<
  Array<{ id: string; nombre: string; precioCosto: number; precioVenta: number; margen: number }>
> {
  const productos = await prisma.producto.findMany({
    select: { id: true, nombre: true, precioCosto: true, precioVenta: true }
  })

  return productos
    .filter((p) => p.precioVenta <= p.precioCosto)
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      precioCosto: p.precioCosto,
      precioVenta: p.precioVenta,
      margen: p.precioVenta - p.precioCosto
    }))
}

/**
 * @description Detecta cuentas por pagar vencidas o proximas a vencer.
 * @returns {Promise<Array>} Cuentas pendiente/parcial vencidas
 */
async function detectarAlertasVencimientoCxP(): Promise<
  Array<{
    id: string
    numeroFactura: string
    estado: string
    saldoPendiente: number
    fechaVencimiento: Date
    diasVencido: number
  }>
> {
  const hoy = new Date()
  const cuentas = await prisma.cuentaPorPagar.findMany({
    where: {
      estado: { in: ['PENDIENTE', 'PARCIAL'] },
      saldoPendiente: { gt: 0 }
    },
    select: {
      cuentaPorPagarId: true,
      numeroFactura: true,
      estado: true,
      saldoPendiente: true,
      fechaVencimiento: true
    }
  })

  return cuentas
    .filter((c) => c.fechaVencimiento && c.fechaVencimiento < hoy)
    .map((c) => ({
      id: c.cuentaPorPagarId,
      numeroFactura: c.numeroFactura,
      estado: c.estado,
      saldoPendiente: Number(c.saldoPendiente),
      fechaVencimiento: c.fechaVencimiento!,
      diasVencido: Math.floor((hoy.getTime() - c.fechaVencimiento!.getTime()) / (1000 * 60 * 60 * 24))
    }))
}

/**
 * @description Detecta cuentas por cobrar vencidas o proximas a vencer.
 * @returns {Promise<Array>} Cuentas pendiente/parcial vencidas
 */
async function detectarAlertasVencimientoCxC(): Promise<
  Array<{
    id: string
    numeroFactura: string
    estado: string
    saldoDeudor: number
    fechaVencimiento: Date
    diasVencido: number
  }>
> {
  const hoy = new Date()
  const cuentas = await prisma.cuentaPorCobrar.findMany({
    where: {
      estado: { in: ['PENDIENTE', 'PARCIAL'] }
    },
    select: {
      id: true,
      numeroFactura: true,
      estado: true,
      montoDeuda: true,
      montoPagado: true,
      fechaVencimiento: true
    }
  })

  return cuentas
    .filter((c) => c.fechaVencimiento && c.fechaVencimiento < hoy && Number(c.montoDeuda) > Number(c.montoPagado))
    .map((c) => ({
      id: c.id,
      numeroFactura: c.numeroFactura || 'N/A',
      estado: c.estado,
      saldoDeudor: Number(c.montoDeuda) - Number(c.montoPagado),
      fechaVencimiento: c.fechaVencimiento!,
      diasVencido: Math.floor((hoy.getTime() - c.fechaVencimiento!.getTime()) / (1000 * 60 * 60 * 24))
    }))
}

/**
 * @description Genera un reporte visual de alertas QA con formato tabular.
 * @returns {Promise<void>} Reporte impreso en consola
 */
export async function generateQaReport(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗')
  console.log('║                    📊 REPORTE QA - INICIAL SISTEMAS              ║')
  console.log('╚════════════════════════════════════════════════════════════════════╝\n')

  const alertasStock = await detectarAlertasStock()
  const alertasMargen = await detectarAlertasMargen()
  const alertasVencidosCxP = await detectarAlertasVencimientoCxP()
  const alertasVencidosCxC = await detectarAlertasVencimientoCxC()

  const totalAlertas =
    alertasStock.length + alertasMargen.length + alertasVencidosCxP.length + alertasVencidosCxC.length

  // Banner resumen
  console.log(`Total de alertas detectadas: ${totalAlertas}\n`)

  // STOCK ALERTS
  if (alertasStock.length > 0) {
    console.log('⚠️  ALERTA_STOCK - Productos con inventario crítico o agotado')
    console.log('─────────────────────────────────────────────────────────────────────')
    console.table(alertasStock)
    console.log('')
  } else {
    console.log('✅ ALERTA_STOCK - Sin alertas de inventario')
    console.log('')
  }

  // MARGEN ALERTS
  if (alertasMargen.length > 0) {
    console.log('⚠️  ALERTA_MARGEN - Productos con margen negativo o nulo')
    console.log('─────────────────────────────────────────────────────────────────────')
    console.table(alertasMargen)
    console.log('')
  } else {
    console.log('✅ ALERTA_MARGEN - Sin alertas de margen')
    console.log('')
  }

  // VENCIMIENTO CXP ALERTS
  if (alertasVencidosCxP.length > 0) {
    console.log('⚠️  ALERTA_VENCIMIENTO - Cuentas por Pagar vencidas')
    console.log('─────────────────────────────────────────────────────────────────────')
    const alertasCxPFormato = alertasVencidosCxP.map((a) => ({
      ...a,
      saldoPendiente: `$${a.saldoPendiente.toLocaleString()}`,
      diasVencido: `${a.diasVencido} días`
    }))
    console.table(alertasCxPFormato)
    console.log('')
  } else {
    console.log('✅ ALERTA_VENCIMIENTO (CxP) - Sin cuentas vencidas')
    console.log('')
  }

  // VENCIMIENTO CXC ALERTS
  if (alertasVencidosCxC.length > 0) {
    console.log('⚠️  ALERTA_VENCIMIENTO - Cuentas por Cobrar vencidas')
    console.log('─────────────────────────────────────────────────────────────────────')
    const alertasCxCFormato = alertasVencidosCxC.map((a) => ({
      ...a,
      saldoDeudor: `$${a.saldoDeudor.toLocaleString()}`,
      diasVencido: `${a.diasVencido} días`
    }))
    console.table(alertasCxCFormato)
    console.log('')
  } else {
    console.log('✅ ALERTA_VENCIMIENTO (CxC) - Sin cuentas vencidas')
    console.log('')
  }

  // SUMMARY
  console.log('╔════════════════════════════════════════════════════════════════════╗')
  console.log(`║ Total ALERTA_STOCK:        ${alertasStock.length.toString().padEnd(48)}║`)
  console.log(`║ Total ALERTA_MARGEN:       ${alertasMargen.length.toString().padEnd(48)}║`)
  console.log(
    `║ Total ALERTA_VENCIMIENTO:  ${(alertasVencidosCxP.length + alertasVencidosCxC.length).toString().padEnd(48)}║`
  )
  console.log(`║ TOTAL ALERTAS:             ${totalAlertas.toString().padEnd(48)}║`)
  console.log('╚════════════════════════════════════════════════════════════════════╝\n')
}

const isDirectExecution = process.argv.some((arg) => arg.includes('qa-report.ts'))

if (isDirectExecution) {
  generateQaReport()
    .catch((error) => {
      console.error('❌ Error en reporte QA:', error)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
