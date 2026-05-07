import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma'
import { AuditLogService } from '@/lib/services/audit-log-service'
import {
  applyPagoGastoWorkflow,
  isGastoWorkflowError
} from '@/lib/services/pago-gastos-workflow'

export { isGastoWorkflowError }

export const reconciliacionGastoSchema = z.object({
  tipoGasto: z.enum(['salario', 'gastoDE', 'compra'], { errorMap: () => ({ message: 'Tipo de gasto debe ser: salario, gastoDE o compra' }) }),
  pgId: z.string().optional(),
  gastosDEId: z.string().optional(),
  gastoCompraId: z.string().optional(),
  referenciaId: z.string().optional(),
  cuentaId: z.string().min(1, 'ID de cuenta bancaria es requerido').optional(),
  tipoPagoId: z.string().min(1, 'Tipo de pago es requerido').optional(),
  monto: z.number().positive('El monto debe ser positivo'),
  moneda: z.string().default('CUP'),
  tasaCambio: z.number().positive().optional(),
  descripcion: z.string().min(1, 'Descripción es requerida'),
  periodo: z.string().optional(),
  observaciones: z.string().optional(),
  estado: z.enum(['PENDIENTE', 'PAGADA', 'PARCIAL']).default('PAGADA'),
  cuentaPorPagarId: z.string().optional(),
  numeroTransaccion: z.string().optional(),
  distribucion: z.array(z.object({ cuentaId: z.string(), monto: z.number().positive(), porcentaje: z.number().min(0).max(100).optional() })).optional()
}).refine((d) => {
  if (d.tipoGasto === 'salario' && !(d.pgId || d.referenciaId)) return false
  if (d.tipoGasto === 'gastoDE' && !(d.gastosDEId || d.referenciaId)) return false
  if (d.tipoGasto === 'compra' && !(d.gastoCompraId || d.referenciaId)) return false
  return true
}, { message: "Debe proporcionar el ID correspondiente al tipo de gasto" }).refine((d) => {
  if (d.estado === 'PAGADA') return (Array.isArray(d.distribucion) && d.distribucion.length > 0) || !!d.cuentaId
  return true
}, { message: 'Debe indicar una cuenta bancaria o distribución multi-cuenta para pagar', path: ['cuentaId'] })

export async function handleGetReconciliacionGastos(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tipoGasto = searchParams.get('tipoGasto')
  const fechaDesde = searchParams.get('fechaDesde')
  const fechaHasta = searchParams.get('fechaHasta')
  const fechaDesdeDate = fechaDesde ? new Date(fechaDesde) : undefined
  const fechaHastaDate = fechaHasta ? new Date(fechaHasta) : undefined
  if (fechaDesdeDate) fechaDesdeDate.setHours(0, 0, 0, 0)
  if (fechaHastaDate) fechaHastaDate.setHours(23, 59, 59, 999)
  const periodo = searchParams.get('periodo')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const skip = (page - 1) * limit

  const gastosPendientes: any[] = []

  if (!tipoGasto || tipoGasto === 'salario') {
    const whereSalarios: any = { ReconciliacionGasto: { none: {} } }
    if (fechaDesdeDate || fechaHastaDate) { whereSalarios.createdAt = {}; if (fechaDesdeDate) whereSalarios.createdAt.gte = fechaDesdeDate; if (fechaHastaDate) whereSalarios.createdAt.lte = fechaHastaDate }
    if (periodo) whereSalarios.periodo = periodo
    const salarios = await prisma.pagosalario.findMany({
      where: whereSalarios,
      select: { pgId: true, salario: true, bonificaciones: true, deducciones: true, horasExtras: true, periodo: true, createdAt: true, updatedAt: true, empleado: { select: { nombre: true, apellido: true, cargo: true } }, ReconciliacionGasto: true }
    })
    for (const ps of salarios) {
      const total = ps.salario + (ps.bonificaciones || 0) + (ps.horasExtras || 0) - (ps.deducciones || 0)
      gastosPendientes.push({ tipo: 'salario', referenciaId: ps.pgId, descripcion: `Salario - ${ps.empleado.nombre} ${ps.empleado.apellido}`, monto: total, periodo: ps.periodo, reconciliado: false, detalles: { empleado: { nombre: ps.empleado.nombre, apellido: ps.empleado.apellido, cargo: ps.empleado.cargo }, salarioBases: ps.salario, bonificaciones: ps.bonificaciones, deducciones: ps.deducciones, horasExtras: ps.horasExtras }, createdAt: ps.createdAt, updatedAt: ps.updatedAt })
    }
  }

  if (!tipoGasto || tipoGasto === 'gastoDE') {
    const whereGastosDE: any = { reconciliaciones: { none: {} } }
    if (fechaDesdeDate || fechaHastaDate) { whereGastosDE.createdAt = {}; if (fechaDesdeDate) whereGastosDE.createdAt.gte = fechaDesdeDate; if (fechaHastaDate) whereGastosDE.createdAt.lte = fechaHastaDate }
    if (periodo) whereGastosDE.periodo = periodo
    const gastosDE = await prisma.gastosDE.findMany({
      where: whereGastosDE,
      select: { gastosDEId: true, tipo: true, proveedor: true, monto: true, periodo: true, descripcion: true, isPagado: true, createdAt: true, updatedAt: true, reconciliaciones: true }
    })
    for (const g of gastosDE) {
      if (g.reconciliaciones.length === 0) {
        gastosPendientes.push({ tipo: 'gastoDE', referenciaId: g.gastosDEId, descripcion: `${g.tipo} - ${g.proveedor}`, monto: g.monto, periodo: g.periodo, reconciliado: false, detalles: { tipo: g.tipo, proveedor: g.proveedor, descripcionOriginal: g.descripcion, isPagado: g.isPagado }, createdAt: g.createdAt, updatedAt: g.updatedAt })
      }
    }
  }

  if (!tipoGasto || tipoGasto === 'compra') {
    const whereCompras: any = { reconciliaciones: { none: {} } }
    if (fechaDesdeDate || fechaHastaDate) { whereCompras.createdAt = {}; if (fechaDesdeDate) whereCompras.createdAt.gte = fechaDesdeDate; if (fechaHastaDate) whereCompras.createdAt.lte = fechaHastaDate }
    const compras = await prisma.gastoCompra.findMany({
      where: whereCompras,
      include: { producto: { select: { nombre: true } }, vendor: { select: { nombre: true } }, reconciliaciones: true, cuentaPorPagar: true }
    })
    for (const c of compras) {
      const tieneRec = c.reconciliaciones && c.reconciliaciones.length > 0
      const tieneCxP = !!c.cuentaPorPagar && !!c.cuentaPorPagar.cuentaPorPagarId
      if (!tieneRec && !tieneCxP) {
        gastosPendientes.push({ tipo: 'compra', referenciaId: c.gastoCompraId, descripcion: `Compra - ${c.producto.nombre} (${c.vendor.nombre})`, monto: c.total, periodo: null, reconciliado: false, detalles: { producto: c.producto.nombre, vendor: c.vendor.nombre, cantidad: c.cantidad, precioUnitario: c.precioUnitario, fechaCompra: c.fechaCompra, descripcionOriginal: c.descripcion }, createdAt: c.createdAt, updatedAt: c.updatedAt })
      }
    }
  }

  gastosPendientes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const total = gastosPendientes.length
  return NextResponse.json({ gastos: gastosPendientes.slice(skip, skip + limit), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
}

export async function handlePostReconciliacionGastos(request: NextRequest, user: { userId: string }) {
  const body = await request.json()
  const validatedData = reconciliacionGastoSchema.parse(body)

  let referenciaExiste = false; let referenciaId = ''
  let pgIdResolved: string | undefined; let gastosDEIdResolved: string | undefined; let gastoCompraIdResolved: string | undefined

  switch (validatedData.tipoGasto) {
    case 'salario': {
      const id = validatedData.pgId ?? validatedData.referenciaId
      if (!id) return NextResponse.json({ error: 'Id de pago salario es requerido para gastos de salario', code: 'EMPLEADO_ID_REQUERIDO' }, { status: 400 })
      const pago = await prisma.pagosalario.findUnique({ where: { pgId: id } })
      if (pago) { referenciaExiste = true; referenciaId = id; pgIdResolved = id }
      break
    }
    case 'gastoDE': {
      const id = validatedData.gastosDEId ?? validatedData.referenciaId
      if (!id) return NextResponse.json({ error: 'gastosDEId es requerido para gastos DE', code: 'GASTO_DE_ID_REQUERIDO' }, { status: 400 })
      const gasto = await prisma.gastosDE.findUnique({ where: { gastosDEId: id } })
      if (gasto) { referenciaExiste = true; referenciaId = id; gastosDEIdResolved = id }
      break
    }
    case 'compra': {
      const id = validatedData.gastoCompraId ?? validatedData.referenciaId
      if (!id) return NextResponse.json({ error: 'gastoCompraId es requerido para gastos de compra', code: 'GASTO_COMPRA_ID_REQUERIDO' }, { status: 400 })
      const compra = await prisma.gastoCompra.findUnique({ where: { gastoCompraId: id } })
      if (compra) { referenciaExiste = true; referenciaId = id; gastoCompraIdResolved = id }
      break
    }
  }

  if (!referenciaExiste) return NextResponse.json({ error: `${validatedData.tipoGasto} no encontrado`, code: 'REFERENCIA_NO_ENCONTRADA' }, { status: 404 })

  if (!validatedData.cuentaPorPagarId) {
    const whereRec: any = { tipoGasto: validatedData.tipoGasto, ...(validatedData.periodo && { periodo: validatedData.periodo }) }
    whereRec.referenciaId = referenciaId
    const existente = await prisma.reconciliacionGasto.findFirst({ where: whereRec })
    if (existente) return NextResponse.json({ error: 'Este gasto ya ha sido reconciliado', code: 'GASTO_YA_RECONCILIADO' }, { status: 400 })
  }

  if (validatedData.distribucion && validatedData.distribucion.length > 0) {
    const cuentaIds = Array.from(new Set(validatedData.distribucion.map(d => d.cuentaId)))
    if (cuentaIds.length > 0) {
      const cuentas = await prisma.cuentaBancaria.findMany({ where: { cuentaId: { in: cuentaIds } }, select: { cuentaId: true, moneda: true } })
      if (cuentas.some((c: any) => c.moneda !== validatedData.moneda) && !validatedData.tasaCambio) return NextResponse.json({ error: 'Tasa de cambio requerida por desajuste de moneda', code: 'TASA_CAMBIO_REQUERIDA' }, { status: 400 })
    }
  } else if (validatedData.cuentaId) {
    const cuenta = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: validatedData.cuentaId }, select: { moneda: true } })
    if (cuenta && cuenta.moneda !== validatedData.moneda && !validatedData.tasaCambio) return NextResponse.json({ error: 'Tasa de cambio requerida por desajuste de moneda', code: 'TASA_CAMBIO_REQUERIDA' }, { status: 400 })
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    return applyPagoGastoWorkflow(tx, {
      tipoGasto: validatedData.tipoGasto, referenciaId, reconciliadoPor: user.userId, descripcion: validatedData.descripcion,
      monto: Number(validatedData.monto), moneda: validatedData.moneda, tenantId: '', tasaCambio: validatedData.tasaCambio, periodo: validatedData.periodo,
      observaciones: validatedData.observaciones, estado: validatedData.estado, cuentaPorPagarId: validatedData.cuentaPorPagarId,
      numeroTransaccion: validatedData.numeroTransaccion, pgId: pgIdResolved, gastosDEId: gastosDEIdResolved, gastoCompraId: gastoCompraIdResolved,
      cuentaId: validatedData.cuentaId, tipoPagoId: validatedData.tipoPagoId, distribucion: validatedData.distribucion
    })
  })

  for (const rec of result.reconciliaciones) {
    try { await AuditLogService.log({ accion: "CREATE", entidad: "RECONCILIACION", entidadId: rec.reconciliacionId, usuarioId: user.userId, detalles: { tipo: "GASTO", tipoGasto: validatedData.tipoGasto, referenciaId, cuentaId: rec.cuentaId, monto: rec.monto, moneda: rec.moneda, montoConvertido: rec.montoConvertido, descripcion: rec.descripcion } }) }
    catch (e) { console.error('Error registrando auditoría de reconciliación de gasto:', e) }
  }

  return NextResponse.json({ message: 'Gasto reconciliado exitosamente', reconciliaciones: result.reconciliaciones, cuentaPorPagar: result.cuentaPorPagar, pagoCuentaPorPagar: result.pagoCuentaPorPagar, distribucionMultiCuenta: Boolean(validatedData.distribucion?.length) }, { status: 201 })
}

export async function handleGetReconciliacionGastosHistorial(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tipoGasto = searchParams.get('tipoGasto'); const cuentaId = searchParams.get('cuentaId')
  const fechaDesde = searchParams.get('fechaDesde'); const fechaHasta = searchParams.get('fechaHasta')
  const periodo = searchParams.get('periodo'); const reconciliadoPor = searchParams.get('reconciliadoPor')
  const page = parseInt(searchParams.get('page') || '1'); const limit = parseInt(searchParams.get('limit') || '50')
  const skip = (page - 1) * limit

  const whereClause: any = {}
  if (tipoGasto) whereClause.tipoGasto = tipoGasto
  if (cuentaId) whereClause.cuentaId = cuentaId
  if (periodo) whereClause.periodo = periodo
  if (reconciliadoPor) whereClause.reconciliadoPor = reconciliadoPor
  if (fechaDesde || fechaHasta) { whereClause.fechaReconciliacion = {}; if (fechaDesde) whereClause.fechaReconciliacion.gte = new Date(fechaDesde); if (fechaHasta) whereClause.fechaReconciliacion.lte = new Date(fechaHasta) }

  const [reconciliaciones, total] = await Promise.all([
    prisma.reconciliacionGasto.findMany({
      where: whereClause,
      include: { cuentaBancaria: { select: { cuentaId: true, nombreBanco: true, numeroCuenta: true, tipoCuenta: true, moneda: true } }, tipoPago: { select: { tipoId: true, nombre: true, descripcion: true } }, pagoSalario: { include: { empleado: { select: { empleadoId: true, nombre: true, apellido: true, cargo: true } } } }, gastoDE: { select: { gastosDEId: true, tipo: true, proveedor: true, monto: true, periodo: true } }, gastoCompra: { select: { gastoCompraId: true, cantidad: true, precioUnitario: true, total: true, fechaCompra: true, producto: { select: { nombre: true } }, vendor: { select: { nombre: true } } } } },
      orderBy: { fechaReconciliacion: 'desc' }, skip, take: limit
    }),
    prisma.reconciliacionGasto.count({ where: whereClause })
  ])

  const reconciliacionesEnriquecidas = await Promise.all(reconciliaciones.map(async (rec: any) => {
    let detallesReferencia = null
    try {
      switch (rec.tipoGasto) {
        case 'salario': if (rec.pagoSalario?.empleado) { const emp = await prisma.empleado.findUnique({ where: { empleadoId: rec.pagoSalario.empleado.empleadoId }, select: { empleadoId: true, nombre: true, apellido: true, cargo: true, salarioBases: true } }); detallesReferencia = { ...emp, pago: rec.pagoSalario } }; break
        case 'gastoDE': if (rec.gastosDEId) detallesReferencia = await prisma.gastosDE.findUnique({ where: { gastosDEId: rec.gastosDEId }, select: { gastosDEId: true, tipo: true, proveedor: true, monto: true, periodo: true, descripcion: true, isPagado: true } }); break
        case 'compra': if (rec.gastoCompraId) detallesReferencia = await prisma.gastoCompra.findUnique({ where: { gastoCompraId: rec.gastoCompraId }, include: { producto: { select: { nombre: true } }, vendor: { select: { nombre: true } } } }); break
      }
    } catch (e) { console.warn(`Error fetching reference details for ${rec.tipoGasto} ${rec.referenciaId}:`, e) }
    return { ...rec, detallesReferencia }
  }))

  const estadisticas = await prisma.reconciliacionGasto.groupBy({ by: ['tipoGasto', 'moneda'], where: whereClause, _sum: { monto: true, montoConvertido: true }, _count: { reconciliacionId: true } })
  const totalesPorCuenta = await prisma.reconciliacionGasto.groupBy({ by: ['cuentaId'], where: whereClause, _sum: { monto: true, montoConvertido: true }, _count: { reconciliacionId: true } })
  const cuentasInfo = await prisma.cuentaBancaria.findMany({ where: { cuentaId: { in: totalesPorCuenta.map((t: any) => t.cuentaId) } }, select: { cuentaId: true, nombreBanco: true, numeroCuenta: true, moneda: true } })

  return NextResponse.json({
    reconciliaciones: reconciliacionesEnriquecidas,
    estadisticas: { porTipoGasto: estadisticas, porCuenta: totalesPorCuenta.map((t: any) => ({ ...t, cuenta: cuentasInfo.find((c: any) => c.cuentaId === t.cuentaId) })), totalGeneral: { cantidad: total, montoTotal: estadisticas.reduce((s: number, st: any) => s + Number(st._sum.monto || 0), 0), montoConvertidoTotal: estadisticas.reduce((s: number, st: any) => s + Number(st._sum.montoConvertido || 0), 0) } },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  })
}
