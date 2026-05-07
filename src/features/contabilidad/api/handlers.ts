import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import type { Prisma } from '@/generated/prisma'
import { authenticateUser } from '@/lib/auth-middleware'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { executeAnticipo, reverseAnticipo } from '@/lib/services/anticipos-workflow'
import { crearCierreContable } from '@/lib/services/cierreContableService'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

function bdf(fi: string | null, ff: string | null): Record<string, Date> {
  const r: Record<string, Date> = {}; if (fi) r.gte = new Date(fi); if (ff) r.lte = new Date(ff); return r
}

export async function getMovimientosReport(request: NextRequest) {
  const a = await authenticateUser(request); if ('status' in a) return a as Response
  const sp = new URL(request.url).searchParams
  const bq = sp.get('busqueda'), fi = sp.get('fechaInicio'), ff = sp.get('fechaFin'), cid = sp.get('cuentaId')
  const tm = sp.get('tipoMovimiento'), mo = sp.get('moneda'), pg = parseInt(sp.get('page') || '1'), lm = parseInt(sp.get('limit') || '10'), ex = sp.get('formato')
  const df = bdf(fi, ff), af = cid ? { cuentaId: cid } : {}

  const [v, s, g, t, aj, i, pd] = await Promise.all([
    prisma.reconciliacionVenta.findMany({ where: { ...af, ...(Object.keys(df).length ? { fechaReconciliacion: df } : {}), ...(mo ? { moneda: mo } : {}) }, select: { reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, fechaReconciliacion: true, observaciones: true, reconciliadoPor: true, tipoReconciliacion: true, venta: { select: { ventaId: true, total: true, createdAt: true } }, prestamoCash: { select: { id: true, cliente: { select: { nombre: true } } } }, deudaCash: { select: { id: true, proveedor: { select: { nombre: true } } } }, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } }, tipoPago: { select: { nombre: true } } }, orderBy: { fechaReconciliacion: 'desc' } }),
    prisma.reconciliacionServicio.findMany({ where: { ...af, ...(Object.keys(df).length ? { fechaReconciliacion: df } : {}), ...(mo ? { moneda: mo } : {}) }, select: { reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, fechaReconciliacion: true, observaciones: true, reconciliadoPor: true, ventasServicio: { select: { ventaServicioId: true } }, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } }, tipoPago: { select: { nombre: true } } }, orderBy: { fechaReconciliacion: 'desc' } }),
    prisma.reconciliacionGasto.findMany({ where: { ...af, ...(Object.keys(df).length ? { fechaReconciliacion: df } : {}), ...(mo ? { moneda: mo } : {}) }, select: { reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, tipoGasto: true, descripcion: true, periodo: true, fechaReconciliacion: true, observaciones: true, reconciliadoPor: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } }, tipoPago: { select: { nombre: true } } }, orderBy: { fechaReconciliacion: 'desc' } }),
    prisma.transferenciaBancaria.findMany({ where: { ...(Object.keys(df).length ? { fechaTransferencia: df } : {}), ...(cid ? { OR: [{ cuentaOrigenId: cid }, { cuentaDestinoId: cid }] } : {}), ...(mo ? { OR: [{ monedaOrigen: mo }, { monedaDestino: mo }] } : {}) }, select: { transferenciaId: true, numeroComprobante: true, montoOrigen: true, monedaOrigen: true, montoDestino: true, monedaDestino: true, tasaCambio: true, motivo: true, descripcion: true, fechaTransferencia: true, cuentaOrigen: { select: { nombreBanco: true, numeroCuenta: true } }, cuentaDestino: { select: { nombreBanco: true, numeroCuenta: true } } }, orderBy: { fechaTransferencia: 'desc' } }),
    prisma.ajusteBancario.findMany({ where: { ...af, ...(Object.keys(df).length ? { createdAt: df } : {}), ...(mo ? { moneda: mo } : {}) }, select: { ajusteId: true, tipo: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, descripcion: true, motivo: true, realizadoPor: true, createdAt: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.inyeccionCapital.findMany({ where: { ...af, ...(Object.keys(df).length ? { createdAt: df } : {}), ...(mo ? { moneda: mo } : {}) }, select: { id: true, tipo: true, montoRecibido: true, moneda: true, descripcion: true, socio: true, entidadPrestamista: true, createdAt: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.pagoDeuda.findMany({ where: { ...af, ...(Object.keys(df).length ? { fechaPago: df } : {}), ...(mo ? { cuentaBancaria: { moneda } } : {}) }, select: { id: true, montoPagado: true, fechaPago: true, comprobante: true, observaciones: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true, moneda: true } }, inyeccion: { select: { entidadPrestamista: true, tipo: true } } }, orderBy: { fechaPago: 'desc' } })
  ])

  const mvs = ([] as any[]).concat(
    v.map((m: any) => ({ id: m.reconciliacionId, tipo: m.tipoReconciliacion === 'PRESTAMO_CASH' ? 'prestamo_cash_pago' : m.tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO' ? 'prestamo_cash_desembolso' : m.tipoReconciliacion === 'DEUDA_CASH' ? 'deuda_cash_pago' : m.tipoReconciliacion === 'DEUDA_CASH_DESEMBOLSO' ? 'deuda_cash_desembolso' : 'venta', fecha: m.fechaReconciliacion, monto: Number(m.monto), moneda: m.moneda || 'CUP', montoConvertido: m.tasaCambio ? Number(m.monto) * Number(m.tasaCambio) : Number(m.monto), tasaCambio: m.tasaCambio ? Number(m.tasaCambio) : null, descripcion: m.tipoReconciliacion === 'PRESTAMO_CASH' ? 'Cobro Prestamo Cash' : m.tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO' ? 'Desembolso Prestamo Cash' : m.tipoReconciliacion === 'DEUDA_CASH' ? 'Pago Deuda Cash' : m.tipoReconciliacion === 'DEUDA_CASH_DESEMBOLSO' ? 'Desembolso Deuda Cash' : m.venta ? 'Venta ' + m.venta.ventaId : 'Cobro ' + m.reconciliacionId, cuenta: m.cuentaBancaria.nombreBanco + ' - ' + m.cuentaBancaria.numeroCuenta, tipoPago: m.tipoPago.nombre, observaciones: m.observaciones, realizadoPor: m.reconciliadoPor, referencia: m.venta?.ventaId || m.reconciliacionId })),
    s.map((m: any) => ({ id: m.reconciliacionId, tipo: 'servicio', fecha: m.fechaReconciliacion, monto: Number(m.monto), moneda: m.moneda || 'CUP', montoConvertido: m.tasaCambio ? Number(m.monto) * Number(m.tasaCambio) : Number(m.monto), tasaCambio: m.tasaCambio ? Number(m.tasaCambio) : null, descripcion: 'Servicio ' + m.ventasServicio.ventaServicioId, cuenta: m.cuentaBancaria.nombreBanco + ' - ' + m.cuentaBancaria.numeroCuenta, tipoPago: m.tipoPago.nombre, observaciones: m.observaciones, realizadoPor: m.reconciliadoPor, referencia: m.ventasServicio.ventaServicioId })),
    g.map((m: any) => ({ id: m.reconciliacionId, tipo: m.tipoGasto === 'salario' ? 'salario' : 'gasto', fecha: m.fechaReconciliacion, monto: -Number(m.monto), moneda: m.moneda || 'CUP', montoConvertido: m.tasaCambio ? -Number(m.monto) * Number(m.tasaCambio) : -Number(m.monto), tasaCambio: m.tasaCambio ? Number(m.tasaCambio) : null, descripcion: m.descripcion, cuenta: m.cuentaBancaria.nombreBanco + ' - ' + m.cuentaBancaria.numeroCuenta, tipoPago: m.tipoPago.nombre, observaciones: m.observaciones, realizadoPor: m.reconciliadoPor, referencia: m.reconciliacionId })),
    t.flatMap((m: any) => { const r = []; if (!cid || m.cuentaOrigen) r.push({ id: m.transferenciaId + '-origen', tipo: 'transferencia_salida', fecha: m.fechaTransferencia, monto: -Number(m.montoOrigen), moneda: m.monedaOrigen || 'CUP', montoConvertido: null, tasaCambio: m.tasaCambio ? Number(m.tasaCambio) : null, descripcion: 'Transf a ' + m.cuentaDestino.nombreBanco, cuenta: m.cuentaOrigen.nombreBanco + ' - ' + m.cuentaOrigen.numeroCuenta, tipoPago: 'Transferencia', observaciones: m.descripcion, referencia: m.numeroComprobante }); if (!cid || m.cuentaDestino) r.push({ id: m.transferenciaId + '-destino', tipo: 'transferencia_entrada', fecha: m.fechaTransferencia, monto: Number(m.montoDestino), moneda: m.monedaDestino || 'CUP', montoConvertido: Number(m.montoDestino), tasaCambio: m.tasaCambio ? Number(m.tasaCambio) : null, descripcion: 'Transf desde ' + m.cuentaOrigen.nombreBanco, cuenta: m.cuentaDestino.nombreBanco + ' - ' + m.cuentaDestino.numeroCuenta, tipoPago: 'Transferencia', observaciones: m.descripcion, referencia: m.numeroComprobante }); return r }),
    aj.map((m: any) => ({ id: m.ajusteId, tipo: m.tipo === 'ingreso' ? 'ajuste_ingreso' : 'ajuste_egreso', fecha: m.createdAt, monto: m.tipo === 'ingreso' ? Number(m.monto) : -Number(m.monto), moneda: m.moneda || 'CUP', montoConvertido: m.tasaCambio ? (m.tipo === 'ingreso' ? Number(m.monto) * Number(m.tasaCambio) : -Number(m.monto) * Number(m.tasaCambio)) : (m.tipo === 'ingreso' ? Number(m.monto) : -Number(m.monto)), tasaCambio: m.tasaCambio ? Number(m.tasaCambio) : null, descripcion: m.descripcion, cuenta: m.cuentaBancaria.nombreBanco + ' - ' + m.cuentaBancaria.numeroCuenta, tipoPago: m.tipo === 'ingreso' ? 'Ajuste Ingreso' : 'Ajuste Egreso', observaciones: m.motivo, realizadoPor: m.realizadoPor, referencia: m.ajusteId })),
    i.map((m: any) => ({ id: m.id, tipo: 'inyeccion_capital', fecha: m.createdAt, monto: Number(m.montoRecibido), moneda: m.moneda || 'CUP', montoConvertido: Number(m.montoRecibido), tasaCambio: null, descripcion: m.tipo === 'CAPITAL_SOCIAL' ? 'Aportacion ' + m.socio : 'Prestamo ' + m.entidadPrestamista, cuenta: m.cuentaBancaria.nombreBanco + ' - ' + m.cuentaBancaria.numeroCuenta, tipoPago: m.tipo === 'CAPITAL_SOCIAL' ? 'Capital Social' : 'Deuda Externa', observaciones: m.descripcion, realizadoPor: 'Sistema', referencia: m.id })),
    pd.map((m: any) => ({ id: m.id, tipo: 'pago_deuda', fecha: m.fechaPago, monto: -Number(m.montoPagado), moneda: m.cuentaBancaria.moneda || 'CUP', montoConvertido: -Number(m.montoPagado), tasaCambio: null, descripcion: 'Pago Deuda: ' + m.inyeccion.entidadPrestamista, cuenta: m.cuentaBancaria.nombreBanco + ' - ' + m.cuentaBancaria.numeroCuenta, tipoPago: 'Pago Deuda', observaciones: m.observaciones, realizadoPor: 'Sistema', referencia: m.comprobante || m.id }))
  )

  let mf = tm && tm !== 'all' ? mvs.filter((x: any) => x.tipo === tm) : mvs
  if (bq) mf = mf.filter((x: any) => (x.descripcion || '').toLowerCase().includes(bq.toLowerCase()))
  mf.sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  const off = (pg - 1) * lm, mp = mf.slice(off, off + lm)
  if (ex === 'csv') {
    const csv = ['Fecha,Tipo,Descripcion,Monto,Moneda', ...mp.map((x: any) => new Date(x.fecha).toLocaleDateString() + ',' + x.tipo + ',' + x.descripcion + ',' + x.monto + ',' + x.moneda)].join('\n')
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="movimientos.csv"' } })
  }
  const tot = mf.reduce((a: any, x: any) => { const c = x.moneda; if (!a[c]) a[c] = { ingresos: 0, egresos: 0, neto: 0 }; x.monto > 0 ? a[c].ingresos += x.monto : a[c].egresos += Math.abs(x.monto); a[c].neto += x.monto; return a }, {})
  return NextResponse.json({ data: mp, totales: tot, pagination: { page: pg, limit: lm, total: mf.length, totalPages: Math.ceil(mf.length / lm) }, filtros: { busqueda: bq, fechaInicio: fi, fechaFin: ff, cuentaId: cid, tipoMovimiento: tm, moneda: mo } })
}

function cv(v: number[]): number {
  if (v.length < 2) return 0; const m = v.reduce((s, x) => s + x, 0) / v.length; return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length) / m
}

export async function getExchangeImpactAnalysis(request: NextRequest) {
  const sp = new URL(request.url).searchParams; const fi = sp.get('fechaInicio'), ff = sp.get('fechaFin'), mb = sp.get('monedaBase') || 'CUP', df = bdf(fi, ff)
  const [rv, rs, rg, ab, tr] = await Promise.all([
    prisma.reconciliacionVenta.findMany({ where: { ...(Object.keys(df).length ? { fechaReconciliacion: df } : {}), tasaCambio: { not: null }, moneda: { not: mb } }, include: { cuentaBancaria: true }, orderBy: { fechaReconciliacion: 'desc' } }),
    prisma.reconciliacionServicio.findMany({ where: { ...(Object.keys(df).length ? { fechaReconciliacion: df } : {}), tasaCambio: { not: null }, moneda: { not: mb } }, include: { cuentaBancaria: true }, orderBy: { fechaReconciliacion: 'desc' } }),
    prisma.reconciliacionGasto.findMany({ where: { ...(Object.keys(df).length ? { fechaReconciliacion: df } : {}), tasaCambio: { not: null }, moneda: { not: mb } }, include: { cuentaBancaria: true }, orderBy: { fechaReconciliacion: 'desc' } }),
    prisma.ajusteBancario.findMany({ where: { ...(Object.keys(df).length ? { createdAt: df } : {}), tasaCambio: { not: null }, moneda: { not: mb } }, include: { cuentaBancaria: true }, orderBy: { createdAt: 'desc' } }),
    prisma.transferenciaBancaria.findMany({ where: { ...(Object.keys(df).length ? { fechaTransferencia: df } : {}), tasaCambio: { not: null }, OR: [{ monedaOrigen: { not: mb } }, { monedaDestino: { not: mb } }] }, include: { cuentaOrigen: true, cuentaDestino: true }, orderBy: { fechaTransferencia: 'desc' } })
  ])
  const c: any[] = []
  rv.forEach((r: any) => c.push({ id: r.reconciliacionId, fecha: r.fechaReconciliacion, tipo: 'venta', monedaOriginal: r.moneda, montoOriginal: Number(r.monto), tasaCambio: Number(r.tasaCambio), montoConvertido: Number(r.montoConvertido || r.monto), cuentaId: r.cuentaId, cuenta: r.cuentaBancaria }))
  rs.forEach((r: any) => c.push({ id: r.reconciliacionId, fecha: r.fechaReconciliacion, tipo: 'servicio', monedaOriginal: r.moneda, montoOriginal: Number(r.monto), tasaCambio: Number(r.tasaCambio), montoConvertido: Number(r.montoConvertido || r.monto), cuentaId: r.cuentaId, cuenta: r.cuentaBancaria }))
  rg.forEach((r: any) => c.push({ id: r.reconciliacionId, fecha: r.fechaReconciliacion, tipo: r.tipoGasto, monedaOriginal: r.moneda, montoOriginal: Number(r.monto), tasaCambio: Number(r.tasaCambio), montoConvertido: Number(r.montoConvertido || r.monto), cuentaId: r.cuentaId, cuenta: r.cuentaBancaria }))
  ab.forEach((a: any) => c.push({ id: a.ajusteId, fecha: a.createdAt, tipo: 'ajuste_' + a.tipo, monedaOriginal: a.moneda, montoOriginal: Number(a.monto), tasaCambio: Number(a.tasaCambio), montoConvertido: Number(a.montoConvertido || a.monto), cuentaId: a.cuentaId, cuenta: a.cuentaBancaria }))
  tr.forEach((t: any) => { if (t.monedaOrigen !== mb && t.tasaCambio) c.push({ id: t.transferenciaId + '_o', fecha: t.fechaTransferencia, tipo: 'transferencia_origen', monedaOriginal: t.monedaOrigen, montoOriginal: Number(t.montoOrigen), tasaCambio: Number(t.tasaCambio), montoConvertido: Number(t.montoDestino), cuentaId: t.cuentaOrigenId, cuenta: t.cuentaOrigen }); if (t.monedaDestino !== mb && t.tasaCambio) c.push({ id: t.transferenciaId + '_d', fecha: t.fechaTransferencia, tipo: 'transferencia_destino', monedaOriginal: t.monedaDestino, montoOriginal: Number(t.montoDestino), tasaCambio: Number(t.tasaCambio), montoConvertido: Number(t.montoOrigen), cuentaId: t.cuentaDestinoId, cuenta: t.cuentaDestino }) })

  const mi = await prisma.moneda.findMany({ where: { codigo: { in: [...new Set(c.map(x => x.monedaOriginal))] } } })
  const mm = new Map(mi.map((x: any) => [x.codigo, x]))
  let gpt = 0; const ipm = new Map<string, any>()
  for (const x of c) {
    const mon = x.monedaOriginal, me = x.montoOriginal * x.tasaCambio, im = x.montoConvertido - me; gpt += im
    if (!ipm.has(mon)) { const inf = mm.get(mon); ipm.set(mon, { codigo: mon, nombre: inf?.nombre || mon, simbolo: inf?.simbolo || mon, impactoTotal: 0, volumenConvertido: 0, transacciones: [], tasas: [] }) }
    const d = ipm.get(mon); if (d) { d.impactoTotal += im; d.volumenConvertido += x.montoOriginal; d.transacciones.push({ fecha: x.fecha?.toISOString?.() || x.fecha, impacto: im, monto: x.montoOriginal, tasa: x.tasaCambio, tipo: x.tipo }); d.tasas.push(x.tasaCambio) }
  }
  const pm = Array.from(ipm.values()).map((x: any) => ({ codigo: x.codigo, nombre: x.nombre, simbolo: x.simbolo, impactoTotal: x.impactoTotal, volumenConvertido: x.volumenConvertido, transacciones: x.transacciones, tasas: x.tasas, tasaPromedio: x.tasas.reduce((s: number, t: number) => s + t, 0) / x.tasas.length, volatilidad: cv(x.tasas) }))
  return NextResponse.json({ resumen: { gananciaPerdidaTotal: gpt, totalConvertido: c.reduce((s, x) => s + x.montoConvertido, 0), nivelRiesgo: 'medio', volatilidadPromedio: cv(c.map(x => x.tasaCambio)) }, porMoneda: pm })
}

export async function getResumenFinanciero(request: NextRequest) {
  const a = await authenticateUser(request); if ('status' in a) return a as Response
  const sp = new URL(request.url).searchParams; const fi = sp.get('fechaInicio'), ff = sp.get('fechaFin'), cid = sp.get('cuentaId'), ex = sp.get('export')
  const df = bdf(fi, ff), af = cid ? { cuentaId: cid } : {}
  const ctas = await prisma.cuentaBancaria.findMany({ where: { isActive: true, ...(cid ? { cuentaId: cid } : {}) }, select: { nombreBanco: true, numeroCuenta: true, saldo: true, moneda: true } })
  const spm = ctas.reduce((a: any, c: any) => { const m = c.moneda || 'CUP'; a[m] = (a[m] || 0) + Number(c.saldo || 0); return a }, {})
  const rv = await prisma.reconciliacionVenta.findMany({ where: { ...af, ...(Object.keys(df).length ? { fechaReconciliacion: df } : {}) }, select: { monto: true, moneda: true, tipoReconciliacion: true } })
  const rg = await prisma.reconciliacionGasto.findMany({ where: { ...af, ...(Object.keys(df).length ? { fechaReconciliacion: df } : {}) }, select: { monto: true, moneda: true } })
  const iV = rv.filter((r: any) => !r.tipoReconciliacion?.startsWith('PRESTAMO_CASH')).reduce((a: any, r: any) => { const m = r.moneda || 'CUP'; a[m] = (a[m] || 0) + Number(r.monto); return a }, {})
  const eG = rg.reduce((a: any, r: any) => { const m = r.moneda || 'CUP'; a[m] = (a[m] || 0) + Number(r.monto); return a }, {})
  const monedas = [...new Set([...Object.keys(spm), ...Object.keys(iV), ...Object.keys(eG)])]
  const rpm = monedas.map((c: string) => ({ moneda: c, saldoActual: spm[c] || 0, totalIngresos: iV[c] || 0, totalEgresos: eG[c] || 0, flujoNeto: (iV[c] || 0) - (eG[c] || 0) }))
  if (ex === 'csv') return new NextResponse('Moneda,Saldo,Ingresos,Egresos\n' + rpm.map((r: any) => r.moneda + ',' + r.saldoActual + ',' + r.totalIngresos + ',' + r.totalEgresos).join('\n'), { headers: { 'Content-Type': 'text/csv' } })
  return NextResponse.json({ resumenPorMoneda: rpm, cuentasBancarias: ctas, estadisticas: { totalCuentas: ctas.length }, filtros: { fechaInicio: fi, fechaFin: ff } })
}

export async function getExchangeReport(request: NextRequest) {
  const a = await authenticateUser(request); if ('status' in a) return a as Response
  const sp = new URL(request.url).searchParams; const fi = sp.get('fechaInicio'), ff = sp.get('fechaFin'), df = bdf(fi, ff)
  const ht = await prisma.tasaCambio.findMany({ where: { ...(Object.keys(df).length ? { fechaVigencia: df } : {}) }, include: { monedaOrigen: { select: { codigo: true, nombre: true, simbolo: true } } }, orderBy: { fechaVigencia: 'desc' } })
  const rV = await prisma.reconciliacionVenta.findMany({ where: { tasaCambio: { not: null }, ...(Object.keys(df).length ? { fechaReconciliacion: df } : {}) }, select: { reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, fechaReconciliacion: true, venta: { select: { ventaId: true } } } })
  const conv = rV.map((r: any) => ({ id: r.reconciliacionId, tipo: 'venta', fecha: r.fechaReconciliacion, montoOriginal: Number(r.monto), monedaOriginal: r.moneda || 'CUP', montoConvertido: Number(r.montoConvertido || 0), monedaDestino: 'CUP', tasaCambio: Number(r.tasaCambio || 0), referencia: r.venta.ventaId }))
  conv.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  return NextResponse.json({ historialTasas: ht.map((t: any) => ({ tasaId: t.tasaId, monedaOrigen: t.monedaOrigen, monedaDestino: t.monedaDestino, tasa: Number(t.tasa), fechaVigencia: t.fechaVigencia })), conversiones: conv })
}

const ctrSchema = z.object({ cuentaOrigenId: z.string().min(1), cuentaDestinoId: z.string().min(1), montoOrigen: z.number().positive(), motivo: z.string().min(1), descripcion: z.string().optional(), tasaCambio: z.number().positive().optional() })

export async function getTransferencias(request: NextRequest) {
  const sp = new URL(request.url).searchParams; const pg = parseInt(sp.get('page') || '1'), lm = parseInt(sp.get('limit') || '10'), cid = sp.get('cuentaId')
  const fd = sp.get('fechaDesde'), fh = sp.get('fechaHasta'), sk = (pg - 1) * lm; const w: any = {}
  if (cid) w.OR = [{ cuentaOrigenId: cid }, { cuentaDestinoId: cid }]
  if (fd || fh) { w.fechaTransferencia = {}; if (fd) w.fechaTransferencia.gte = new Date(fd); if (fh) w.fechaTransferencia.lte = new Date(fh) }
  const [tr, to] = await Promise.all([prisma.transferenciaBancaria.findMany({ where: w, skip: sk, take: lm, select: { transferenciaId: true, numeroComprobante: true, montoOrigen: true, monedaOrigen: true, montoDestino: true, monedaDestino: true, tasaCambio: true, motivo: true, fechaTransferencia: true, cuentaOrigen: { select: { nombreBanco: true, numeroCuenta: true, moneda: true } }, cuentaDestino: { select: { nombreBanco: true, numeroCuenta: true, moneda: true } } }, orderBy: { fechaTransferencia: 'desc' } }), prisma.transferenciaBancaria.count({ where: w })])
  return NextResponse.json({ transferencias: tr.map((t: any) => ({ ...t, montoOrigen: Number(t.montoOrigen), montoDestino: Number(t.montoDestino), tasaCambio: t.tasaCambio ? Number(t.tasaCambio) : null })), pagination: { page: pg, limit: lm, total: to, pages: Math.ceil(to / lm) } })
}

export async function createTransferencia(request: NextRequest) {
  const body = await request.json(); const v = ctrSchema.parse(body)
  if (v.cuentaOrigenId === v.cuentaDestinoId) return NextResponse.json({ error: 'Cuentas deben ser diferentes' }, { status: 400 })
  const [co, cd] = await Promise.all([prisma.cuentaBancaria.findUnique({ where: { cuentaId: v.cuentaOrigenId } }), prisma.cuentaBancaria.findUnique({ where: { cuentaId: v.cuentaDestinoId } })])
  if (!co || !cd) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
  if (!co.isActive || !cd.isActive) return NextResponse.json({ error: 'Cuenta inactiva' }, { status: 400 })
  if (Number(co.saldo) < v.montoOrigen) return NextResponse.json({ error: 'Saldo insuficiente' }, { status: 400 })
  const tr = await prisma.$transaction(async (tx: any) => {
    await tx.cuentaBancaria.update({ where: { cuentaId: v.cuentaOrigenId }, data: { saldo: { decrement: v.montoOrigen } } })
    await tx.cuentaBancaria.update({ where: { cuentaId: v.cuentaDestinoId }, data: { saldo: { increment: v.montoOrigen } } })
    return tx.transferenciaBancaria.create({ data: { numeroComprobante: 'TRF-' + Date.now(), cuentaOrigenId: v.cuentaOrigenId, cuentaDestinoId: v.cuentaDestinoId, montoOrigen: v.montoOrigen, monedaOrigen: co.moneda, montoDestino: v.montoOrigen, monedaDestino: cd.moneda, motivo: v.motivo, descripcion: v.descripcion, comprobanteGenerado: false } as any })
  })
  const au = await authenticateUser(request); const u = 'status' in au ? null : au.user
  if (u) await AuditLogService.log({ accion: 'CREATE', entidad: 'TRANSFERENCIA', entidadId: tr.transferenciaId, usuarioId: u.userId, detalles: {} })
  return NextResponse.json({ message: 'Transferencia exitosa', transferencia: tr }, { status: 201 })
}

export async function getTransferenciaById(id: string) {
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  const t = await prisma.transferenciaBancaria.findUnique({ where: { transferenciaId: id }, include: { cuentaOrigen: true, cuentaDestino: true } })
  if (!t) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json({ transferencia: t })
}

export async function getComprobanteTransferencia(id: string) {
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  const t = await prisma.transferenciaBancaria.findUnique({ where: { transferenciaId: id }, include: { cuentaOrigen: { select: { nombreBanco: true, numeroCuenta: true, tipoCuenta: true, moneda: true } }, cuentaDestino: { select: { nombreBanco: true, numeroCuenta: true, tipoCuenta: true, moneda: true } } } })
  if (!t || !t.cuentaOrigen || !t.cuentaDestino) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  const pdf = await PDFDocument.create(); const pg = pdf.addPage([595.28, 841.89]); const fR = await pdf.embedFont(StandardFonts.Helvetica), fB = await pdf.embedFont(StandardFonts.HelveticaBold)
  let y = pg.getSize().height - 60; pg.drawText('COMPROBANTE', { x: 200, y, size: 18, font: fB }); y -= 30
  pg.drawText('Banco Origen: ' + t.cuentaOrigen.nombreBanco, { x: 50, y, size: 11, font: fR }); y -= 20
  pg.drawText('Banco Destino: ' + t.cuentaDestino.nombreBanco, { x: 50, y, size: 11, font: fR }); y -= 20
  pg.drawText('Monto: ' + Number(t.montoOrigen).toFixed(2) + ' ' + t.monedaOrigen, { x: 50, y, size: 11, font: fR })
  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="comprobante-' + t.numeroComprobante + '.pdf"' } })
}

const vldSchema = z.object({ cuentaOrigenId: z.string().min(1), cuentaDestinoId: z.string().min(1), monto: z.number().positive(), motivo: z.string().min(1) })

export async function validarTransferencia(request: NextRequest) {
  const body = await request.json(); const v = vldSchema.parse(body)
  if (v.cuentaOrigenId === v.cuentaDestinoId) return NextResponse.json({ error: 'Deben ser diferentes' }, { status: 400 })
  const co = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: v.cuentaOrigenId }, select: { saldo: true, isActive: true } })
  if (!co || !co.isActive) return NextResponse.json({ error: 'Cuenta origen invalida' }, { status: 400 })
  return NextResponse.json({ saldoSuficiente: Number(co.saldo) >= v.monto, advertencias: [] })
}

const icSchema = z.object({ tipo: z.enum(['CAPITAL_SOCIAL', 'DEUDA_EXTERNA']), montoRecibido: z.number().positive(), moneda: z.string().default('CUP'), cuentaId: z.string().min(1), descripcion: z.string().optional(), socio: z.string().optional(), entidadPrestamista: z.string().optional() })

export async function getInyeccionesCapital(request: NextRequest) {
  const tipo = new URL(request.url).searchParams.get('tipo'); const w: any = {}; if (tipo) w.tipo = tipo
  return NextResponse.json({ inyecciones: await prisma.inyeccionCapital.findMany({ where: w, include: { cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true, moneda: true } }, pagos: true }, orderBy: { createdAt: 'desc' } }) })
}

export async function createInyeccionCapital(request: NextRequest) {
  const a = await authenticateUser(request); if ('status' in a) return a as Response; const u = a.user; const v = icSchema.parse(await request.json())
  const r = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const i = await tx.inyeccionCapital.create({ data: { tipo: v.tipo, montoRecibido: v.montoRecibido, moneda: v.moneda, cuentaId: v.cuentaId, descripcion: v.descripcion, socio: v.socio, entidadPrestamista: v.entidadPrestamista, estado: v.tipo === 'DEUDA_EXTERNA' ? 'ACTIVA' : null } })
    await tx.cuentaBancaria.update({ where: { cuentaId: v.cuentaId }, data: { saldo: { increment: v.montoRecibido } } })
    return i
  })
  await AuditLogService.log({ accion: 'CREATE', entidad: 'INYECCION_CAPITAL', entidadId: r.id, usuarioId: u.userId, detalles: {} })
  return NextResponse.json({ inyeccion: r }, { status: 201 })
}

const pdSchema = z.object({ montoPagado: z.number().positive(), cuentaId: z.string().min(1), comprobante: z.string().optional() })

export async function pagarDeudaCapital(request: NextRequest, id: string) {
  const a = await authenticateUser(request); if ('status' in a) return a as Response; const u = a.user; const v = pdSchema.parse(await request.json())
  const iny = await prisma.inyeccionCapital.findUnique({ where: { id }, include: { pagos: true } })
  if (!iny || iny.tipo !== 'DEUDA_EXTERNA') return NextResponse.json({ error: 'Invalida' }, { status: 400 })
  const r = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const p = await tx.pagoDeuda.create({ data: { inyeccionId: id, montoPagado: v.montoPagado, cuentaId: v.cuentaId, comprobante: v.comprobante, numeroCuota: iny.pagos.length + 1 } })
    await tx.cuentaBancaria.update({ where: { cuentaId: v.cuentaId }, data: { saldo: { decrement: v.montoPagado } } })
    return p
  })
  await AuditLogService.log({ accion: 'CREATE', entidad: 'PAGO_DEUDA', entidadId: r.id, usuarioId: u.userId, detalles: {} })
  return NextResponse.json({ pago: r }, { status: 201 })
}

export async function getCierres() { return NextResponse.json(await prisma.cierreContable.findMany({ orderBy: { createdAt: 'desc' } })) }

export async function createCierre(request: NextRequest) {
  const a = await authenticateUser(request); if ('status' in a) return a as Response; const u = a.user; const b = await request.json()
  if (!b.tipo || !b.fechaInicio || !b.fechaFin) return NextResponse.json({ error: 'Campos requeridos' }, { status: 400 })
  const c = await crearCierreContable(b.tipo, new Date(b.fechaInicio), new Date(b.fechaFin), u.userId, b.observaciones)
  await AuditLogService.log({ accion: 'CREATE', entidad: 'CIERRE_CONTABLE', entidadId: c.cierreId, usuarioId: u.userId, detalles: {} })
  return NextResponse.json(c, { status: 201 })
}

export async function getCierreById(id: string) {
  const c = await prisma.cierreContable.findUnique({ where: { cierreId: id } })
  if (!c) return NextResponse.json({ error: 'No encontrado' }, { status: 404 }); return NextResponse.json(c)
}

export async function updateCierre(request: NextRequest, id: string) {
  const a = await authenticateUser(request); if ('status' in a) return a as Response; const u = a.user
  const ex = await prisma.cierreContable.findUnique({ where: { cierreId: id } })
  if (!ex) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const c = await prisma.cierreContable.update({ where: { cierreId: id }, data: await request.json() })
  await AuditLogService.log({ accion: 'UPDATE', entidad: 'CIERRE_CONTABLE', entidadId: id, usuarioId: u.userId, detalles: {} })
  return NextResponse.json(c)
}

export async function deleteCierre(request: NextRequest, id: string) {
  const a = await authenticateUser(request); if ('status' in a) return a as Response; const u = a.user
  const ex = await prisma.cierreContable.findUnique({ where: { cierreId: id } })
  if (!ex) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  await prisma.cierreContable.delete({ where: { cierreId: id } })
  await AuditLogService.log({ accion: 'DELETE', entidad: 'CIERRE_CONTABLE', entidadId: id, usuarioId: u.userId, detalles: {} })
  return NextResponse.json({ message: 'Eliminado' })
}

const ajSchema = z.object({ cuentaId: z.string().min(1), tipo: z.enum(['ingreso', 'egreso']), monto: z.number().positive(), moneda: z.string().min(1).default('CUP'), descripcion: z.string().min(1), motivo: z.string().min(1) })

export async function createAjusteBancario(request: NextRequest) {
  const a = await authenticateUser(request); if ('status' in a) return a as Response; const u = a.user; const v = ajSchema.parse(await request.json())
  const cb = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: v.cuentaId } })
  if (!cb || !cb.isActive) return NextResponse.json({ error: 'Cuenta invalida' }, { status: 400 })
  const r = await prisma.$transaction(async (tx: any) => {
    const aj = await tx.ajusteBancario.create({ data: { cuentaId: v.cuentaId, tipo: v.tipo, monto: v.monto, moneda: v.moneda, descripcion: v.descripcion, motivo: v.motivo, realizadoPor: u.userId } })
    await tx.cuentaBancaria.update({ where: { cuentaId: v.cuentaId }, data: { saldo: v.tipo === 'ingreso' ? { increment: v.monto } : { decrement: v.monto } } })
    return { ajuste: aj }
  })
  await AuditLogService.log({ accion: 'CREATE', entidad: 'AJUSTE_BANCARIO', entidadId: r.ajuste.ajusteId, usuarioId: u.userId, detalles: {} })
  return NextResponse.json({ success: true, ajuste: r.ajuste })
}

const qSch = z.object({ page: z.string().nullable().optional().transform(v => v ? parseInt(v) : 1), limit: z.string().nullable().optional().transform(v => v ? parseInt(v) : 50), fechaInicio: z.string().nullable().optional(), fechaFin: z.string().nullable().optional() })

export async function getAjustesByCuenta(request: NextRequest, cuentaId: string) {
  await authenticateUser(request)
  const sp = new URL(request.url).searchParams; const q = qSch.parse({ page: sp.get('page'), limit: sp.get('limit'), fechaInicio: sp.get('fechaInicio'), fechaFin: sp.get('fechaFin') })
  const w: any = {}; if (cuentaId !== 'all') w.cuentaId = cuentaId
  if (q.fechaInicio || q.fechaFin) { w.createdAt = {}; if (q.fechaInicio) w.createdAt.gte = new Date(q.fechaInicio); if (q.fechaFin) { const f = new Date(q.fechaFin); f.setHours(23, 59, 59, 999); w.createdAt.lte = f } }
  const off = (q.page - 1) * q.limit
  const [aj, to] = await Promise.all([prisma.ajusteBancario.findMany({ where: w, orderBy: { createdAt: 'desc' }, skip: off, take: q.limit }), prisma.ajusteBancario.count({ where: w })])
  return NextResponse.json({ success: true, data: { ajustes: aj, pagination: { currentPage: q.page, totalPages: Math.ceil(to / q.limit), totalCount: to } } })
}

const EAS = z.object({ contexto: z.enum(['COMPRA_PRODUCTO', 'COMPRA_SERVICIO', 'FACTURA_OFERTA', 'FACTURA_DIRECTA']), documentoDestinoId: z.string().min(1), montoObjetivo: z.coerce.number().positive(), monedaObjetivo: z.string().min(1), tasaAplicada: z.coerce.number().positive().optional(), idempotencyKey: z.string().min(1), observaciones: z.string().optional() })

export async function executeAnticipoHandler(request: NextRequest, anticipoId: string, user: { userId: string }) {
  const p = EAS.parse(await request.json())
  const ant = await prisma.anticipo.findUnique({ where: { anticipoId }, select: { saldoDisponible: true } })
  if (!ant) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const r = await prisma.$transaction(async (tx) => executeAnticipo(tx, { anticipoId, contexto: p.contexto, documentoDestinoId: p.documentoDestinoId, montoObjetivo: p.montoObjetivo, monedaObjetivo: p.monedaObjetivo, tasaAplicada: p.tasaAplicada, idempotencyKey: p.idempotencyKey, observaciones: p.observaciones, usuarioId: user.userId }))
  return NextResponse.json({ result: r }, { status: 200 })
}

const RAS = z.object({ documentoDestinoId: z.string().min(1), montoReverso: z.coerce.number().positive(), observaciones: z.string().optional() })

export async function reverseAnticipoHandler(request: NextRequest, anticipoId: string, user: { userId: string }) {
  const p = RAS.parse(await request.json())
  const r = await prisma.$transaction(async (tx) => reverseAnticipo(tx, { anticipoId, documentoDestinoId: p.documentoDestinoId, montoReverso: p.montoReverso, observaciones: p.observaciones, usuarioId: user.userId }))
  return NextResponse.json({ result: r }, { status: 200 })
}

const DQS = z.object({ contexto: z.enum(['compra', 'factura']).optional(), proveedorId: z.string().optional(), clienteId: z.string().optional(), moneda: z.string().optional() })

export async function getAnticiposDisponibles(raw: Record<string, string | undefined>) {
  const p = DQS.parse(raw); const w: Record<string, unknown> = { estado: 'RESERVADO', saldoDisponible: { gt: 0 } }
  if (p.contexto === 'compra') w.tipo = 'PAGO'; else if (p.contexto === 'factura') w.tipo = 'COBRO'
  if (p.proveedorId) w.proveedorId = p.proveedorId; if (p.clienteId) w.clienteId = p.clienteId; if (p.moneda) w.moneda = p.moneda
  return NextResponse.json({ anticipos: await prisma.anticipo.findMany({ where: w, include: { proveedor: { select: { nombre: true } }, cliente: { select: { nombre: true } } }, orderBy: { createdAt: 'desc' } }) })
}

export async function getResumenAnticipos(sp: URLSearchParams) {
  const ant = await prisma.anticipo.findMany({ select: { tipo: true, estado: true, moneda: true, montoOriginal: true, saldoDisponible: true } })
  return NextResponse.json({ resumen: { porTipo: ant.reduce((a: any, r: any) => { const k = r.tipo || 'UNK'; a[k] = (a[k] || 0) + Number(r.montoOriginal || 0); return a }, {}), totalesGenerales: { totalAnticipos: ant.reduce((s, r) => s + Number(r.montoOriginal || 0), 0) } } })
}

export async function getAnticiposPorProveedor(sp: URLSearchParams) {
  const ant = await prisma.anticipo.findMany({ where: { tipo: 'PAGO' }, include: { proveedor: { select: { nombre: true } } }, orderBy: { fechaReserva: 'desc' } })
  const g = new Map<string, any>()
  for (const a of ant) { const k = a.proveedorId || 'sin-proveedor'; const cur = g.get(k) || { proveedor: a.proveedor || null, anticipos: [], totales: { totalOriginal: 0 } }; cur.anticipos.push(a); cur.totales.totalOriginal += Number(a.montoOriginal || 0); g.set(k, cur) }
  return NextResponse.json({ proveedores: Array.from(g.values()) })
}

export async function getAnticiposPorCliente(sp: URLSearchParams) {
  const ant = await prisma.anticipo.findMany({ where: { tipo: 'COBRO' }, include: { cliente: { select: { nombre: true } } }, orderBy: { fechaReserva: 'desc' } })
  const g = new Map<string, any>()
  for (const a of ant) { const k = a.clienteId || 'sin-cliente'; const cur = g.get(k) || { cliente: a.cliente || null, anticipos: [], totales: { totalOriginal: 0 } }; cur.anticipos.push(a); cur.totales.totalOriginal += Number(a.montoOriginal || 0); g.set(k, cur) }
  return NextResponse.json({ clientes: Array.from(g.values()) })
}

export async function getContabilidadLogs(request: NextRequest) {
  const a = await authenticateUser(request); if ('status' in a) return a as Response; const u = a.user
  if (u.role !== 'admin') return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  const sp = request.nextUrl.searchParams
  const r = await AuditLogService.getLogs({ entidad: sp.get('entidad') || undefined, limit: parseInt(sp.get('limit') || '50'), offset: parseInt(sp.get('offset') || '0') })
  return NextResponse.json(r)
}

// ═══ Cuentas Bancarias ═══

import { CurrencyConversionService } from '@/lib/services/currency-conversion-service'

const cuentaBancariaSchema = z.object({
  nombreBanco: z.string().min(1, 'Nombre del banco es requerido'),
  numeroCuenta: z.string().min(1, 'Número de cuenta es requerido'),
  tipoCuenta: z.string().optional(),
  saldo: z.number().optional(),
  moneda: z.string().optional().default('CUP'),
  isActive: z.boolean().optional().default(true),
})

const updateCuentaBancariaSchema = z.object({
  nombreBanco: z.string().min(1).optional(),
  tipoCuenta: z.string().optional(),
  saldo: z.number().optional(),
  moneda: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function getCuentasHandler() {
  const cuentas = await prisma.cuentaBancaria.findMany({
    include: {
      reconciliacionesVenta: { select: { reconciliacionId: true, monto: true, fechaReconciliacion: true } },
      reconciliacionesServicio: { select: { reconciliacionId: true, monto: true, fechaReconciliacion: true } },
      reconciliacionesGasto: { select: { reconciliacionId: true, monto: true, fechaReconciliacion: true } },
      ajustes: { select: { ajusteId: true, tipo: true, monto: true, createdAt: true } },
      transferenciasOrigen: { select: { transferenciaId: true, montoOrigen: true, fechaTransferencia: true } },
      transferenciasDestino: { select: { transferenciaId: true, montoDestino: true, fechaTransferencia: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  const monedaPrincipal = await CurrencyConversionService.getMainCurrency()
  const cuentasConConversion = await Promise.all(
    cuentas.map(async (cuenta) => {
      if (cuenta.moneda === monedaPrincipal.codigo) return { ...cuenta, saldoEnMonedaPrincipal: Number(cuenta.saldo), tasaConversionAplicada: 1 }
      const { montoEnPrincipal, tasa } = await CurrencyConversionService.convertToMainCurrency(Number(cuenta.saldo), cuenta.moneda)
      return { ...cuenta, saldoEnMonedaPrincipal: montoEnPrincipal, tasaConversionAplicada: tasa }
    })
  )
  return NextResponse.json({ cuentas: cuentasConConversion, monedaPrincipal: monedaPrincipal.codigo })
}

export async function createCuentaHandler(request: NextRequest) {
  const body = await request.json()
  const validatedData = cuentaBancariaSchema.parse(body)
  const existing = await prisma.cuentaBancaria.findUnique({ where: { numeroCuenta: validatedData.numeroCuenta } })
  if (existing) return NextResponse.json({ error: 'Ya existe una cuenta con este número', code: 'ACCOUNT_NUMBER_EXISTS' }, { status: 400 })
  const authOpt = await authenticateUser(request)
  const user = 'status' in authOpt ? null : authOpt.user
  const nueva = await prisma.cuentaBancaria.create({
    data: { nombreBanco: validatedData.nombreBanco, numeroCuenta: validatedData.numeroCuenta, tipoCuenta: validatedData.tipoCuenta || '', saldo: validatedData.saldo || 0, moneda: validatedData.moneda || 'CUP', isActive: validatedData.isActive ?? true },
  })
  if (user) await AuditLogService.log({ accion: 'CREATE', entidad: 'CUENTA_BANCARIA', entidadId: nueva.cuentaId, usuarioId: user.userId, detalles: { nombreBanco: nueva.nombreBanco, numeroCuenta: nueva.numeroCuenta } })
  return NextResponse.json({ cuenta: nueva }, { status: 201 })
}

export async function getCuentaByIdHandler(req: NextRequest, id: string) {
  const cuenta = await prisma.cuentaBancaria.findUnique({
    where: { cuentaId: id },
    include: {
      reconciliacionesVenta: { include: { venta: { select: { ventaId: true, total: true, createdAt: true, puntoDeVenta: { select: { nombre: true } } } }, tipoPago: { select: { nombre: true } } }, orderBy: { fechaReconciliacion: 'desc' } },
      reconciliacionesServicio: { include: { tipoPago: { select: { nombre: true } } }, orderBy: { fechaReconciliacion: 'desc' } },
      reconciliacionesGasto: { include: { tipoPago: { select: { nombre: true } } }, orderBy: { fechaReconciliacion: 'desc' } },
      ajustes: { orderBy: { createdAt: 'desc' } },
      transferenciasOrigen: { include: { cuentaDestino: { select: { nombreBanco: true, numeroCuenta: true } } }, orderBy: { fechaTransferencia: 'desc' } },
      transferenciasDestino: { include: { cuentaOrigen: { select: { nombreBanco: true, numeroCuenta: true } } }, orderBy: { fechaTransferencia: 'desc' } },
    },
  })
  if (!cuenta) return NextResponse.json({ error: 'Cuenta bancaria no encontrada', code: 'ACCOUNT_NOT_FOUND' }, { status: 404 })
  return NextResponse.json(cuenta)
}

export async function updateCuentaHandler(request: NextRequest, id: string) {
  const auth = await authenticateUser(request)
  if ('status' in auth) return auth as Response
  const user = auth.user
  const body = await request.json()
  if (body.numeroCuenta !== undefined) return NextResponse.json({ error: 'No se puede modificar el número de cuenta', code: 'CANNOT_UPDATE_ACCOUNT_NUMBER' }, { status: 400 })
  const validatedData = updateCuentaBancariaSchema.parse(body)
  const existing = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: id } })
  if (!existing) return NextResponse.json({ error: 'Cuenta bancaria no encontrada', code: 'ACCOUNT_NOT_FOUND' }, { status: 404 })
  const updated = await prisma.cuentaBancaria.update({ where: { cuentaId: id }, data: validatedData })
  await AuditLogService.log({ accion: 'UPDATE', entidad: 'CUENTA_BANCARIA', entidadId: id, usuarioId: user.userId, detalles: { cambios: validatedData } })
  return NextResponse.json(updated)
}

export async function deleteCuentaHandler(request: NextRequest, id: string) {
  const auth = await authenticateUser(request)
  if ('status' in auth) return auth as Response
  const user = auth.user
  const existing = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: id } })
  if (!existing) return NextResponse.json({ error: 'Cuenta bancaria no encontrada', code: 'ACCOUNT_NOT_FOUND' }, { status: 404 })
  await prisma.cuentaBancaria.update({ where: { cuentaId: id }, data: { isActive: false } })
  await AuditLogService.log({ accion: 'DELETE', entidad: 'CUENTA_BANCARIA', entidadId: id, usuarioId: user.userId, detalles: { nombreBanco: existing.nombreBanco, numeroCuenta: existing.numeroCuenta } })
  return NextResponse.json({ message: 'Cuenta bancaria desactivada exitosamente' })
}

interface TransaccionUnificada {
  id: string; fecha: Date; tipoMovimiento: string; descripcion: string; montoOriginal: number
  monedaOriginal: string; tasaCambio?: number | null; montoConvertido: number; observaciones?: string
}

function normalizeMontoToCup(monto: number, moneda?: string | null, tasaCambio?: number): number {
  if (moneda === 'CUP' || !moneda) return monto
  if (typeof tasaCambio === 'number' && Number.isFinite(tasaCambio) && tasaCambio > 0) return monto * tasaCambio
  return monto
}

export async function getCuentaHistorialHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cuenta = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: id } })
  if (!cuenta) return NextResponse.json({ error: 'Cuenta bancaria no encontrada', code: 'ACCOUNT_NOT_FOUND' }, { status: 404 })

  const sp = new URL(request.url).searchParams
  const fi = sp.get('fechaInicio'), ff = sp.get('fechaFin'), tm = sp.get('tipoMovimiento')
  const pg = parseInt(sp.get('page') || '1'), lm = parseInt(sp.get('limit') || '50')
  const df = bdf(fi, ff); const sf = Object.keys(df).length ? { gte: df.gte, lte: df.lte } : {}
  const wf = Object.keys(sf).length ? { fechaReconciliacion: sf } : {}

  const [rV, rS, rG, aj, tO, tD, iC, pD] = await Promise.all([
    prisma.reconciliacionVenta.findMany({ where: { cuentaId: id, ...wf }, select: { reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, fechaReconciliacion: true, observaciones: true, tipoReconciliacion: true } }),
    prisma.reconciliacionServicio.findMany({ where: { cuentaId: id, ...wf }, select: { reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, fechaReconciliacion: true, observaciones: true } }),
    prisma.reconciliacionGasto.findMany({ where: { cuentaId: id, ...wf }, select: { reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, tipoGasto: true, descripcion: true, fechaReconciliacion: true, observaciones: true } }),
    prisma.ajusteBancario.findMany({ where: { cuentaId: id, ...(Object.keys(sf).length ? { createdAt: sf } : {}) }, select: { ajusteId: true, tipo: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, descripcion: true, motivo: true, createdAt: true } }),
    prisma.transferenciaBancaria.findMany({ where: { cuentaOrigenId: id, ...(Object.keys(sf).length ? { fechaTransferencia: sf } : {}) }, select: { transferenciaId: true, montoOrigen: true, monedaOrigen: true, montoDestino: true, monedaDestino: true, tasaCambio: true, motivo: true, fechaTransferencia: true, descripcion: true, cuentaDestino: { select: { nombreBanco: true, numeroCuenta: true } } } }),
    prisma.transferenciaBancaria.findMany({ where: { cuentaDestinoId: id, ...(Object.keys(sf).length ? { fechaTransferencia: sf } : {}) }, select: { transferenciaId: true, montoOrigen: true, monedaOrigen: true, montoDestino: true, monedaDestino: true, tasaCambio: true, motivo: true, fechaTransferencia: true, descripcion: true, cuentaOrigen: { select: { nombreBanco: true, numeroCuenta: true } } } }),
    prisma.inyeccionCapital.findMany({ where: { cuentaId: id, ...(Object.keys(sf).length ? { createdAt: sf } : {}) }, select: { id: true, tipo: true, montoRecibido: true, moneda: true, descripcion: true, createdAt: true } }),
    prisma.pagoDeuda.findMany({ where: { cuentaId: id, ...(Object.keys(sf).length ? { fechaPago: sf } : {}) }, select: { id: true, montoPagado: true, fechaPago: true, comprobante: true, observaciones: true } }),
  ])

  let transacciones: TransaccionUnificada[] = []
  transacciones = transacciones.concat(
    rV.map((r: any) => ({ id: r.reconciliacionId, fecha: r.fechaReconciliacion, tipoMovimiento: ['PRESTAMO_CASH', 'PRESTAMO_CASH_DESEMBOLSO', 'DEUDA_CASH', 'DEUDA_CASH_DESEMBOLSO'].includes(r.tipoReconciliacion) ? r.tipoReconciliacion.toLowerCase() : 'venta_reconciliada', descripcion: 'Venta ' + r.reconciliacionId, montoOriginal: Number(r.monto), monedaOriginal: r.moneda || 'CUP', tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null, montoConvertido: Number(r.montoConvertido || r.monto), observaciones: r.observaciones || undefined })),
    rS.map((r: any) => ({ id: r.reconciliacionId, fecha: r.fechaReconciliacion, tipoMovimiento: 'servicio_reconciliado', descripcion: 'Servicio ' + r.reconciliacionId, montoOriginal: Number(r.monto), monedaOriginal: r.moneda || 'CUP', tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null, montoConvertido: Number(r.montoConvertido || r.monto), observaciones: r.observaciones || undefined })),
    rG.map((r: any) => ({ id: r.reconciliacionId, fecha: r.fechaReconciliacion, tipoMovimiento: 'gasto', descripcion: r.descripcion || 'Gasto ' + r.reconciliacionId, montoOriginal: Number(r.monto), monedaOriginal: r.moneda || 'CUP', tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null, montoConvertido: Number(r.montoConvertido || r.monto), observaciones: r.observaciones || undefined })),
    aj.map((a: any) => ({ id: a.ajusteId, fecha: a.createdAt, tipoMovimiento: a.tipo === 'ingreso' ? 'ajuste_ingreso' : 'ajuste_egreso', descripcion: a.descripcion, montoOriginal: Number(a.monto), monedaOriginal: a.moneda || 'CUP', tasaCambio: a.tasaCambio ? Number(a.tasaCambio) : null, montoConvertido: Number(a.montoConvertido || a.monto), observaciones: a.motivo || undefined })),
    tO.map((t: any) => ({ id: t.transferenciaId + '-origen', fecha: t.fechaTransferencia, tipoMovimiento: 'transferencia_salida', descripcion: 'Transferencia a ' + (t.cuentaDestino?.nombreBanco || '') + ' - ' + (t.cuentaDestino?.numeroCuenta || ''), montoOriginal: Number(t.montoOrigen), monedaOriginal: t.monedaOrigen || 'CUP', tasaCambio: t.tasaCambio ? Number(t.tasaCambio) : null, montoConvertido: Number(t.montoDestino), observaciones: t.descripcion || undefined })),
    tD.map((t: any) => ({ id: t.transferenciaId + '-destino', fecha: t.fechaTransferencia, tipoMovimiento: 'transferencia_entrada', descripcion: 'Transferencia desde ' + (t.cuentaOrigen?.nombreBanco || '') + ' - ' + (t.cuentaOrigen?.numeroCuenta || ''), montoOriginal: Number(t.montoDestino), monedaOriginal: t.monedaDestino || 'CUP', tasaCambio: t.tasaCambio ? Number(t.tasaCambio) : null, montoConvertido: Number(t.montoOrigen), observaciones: t.descripcion || undefined })),
    iC.map((i: any) => ({ id: i.id, fecha: i.createdAt, tipoMovimiento: 'inyeccion_capital', descripcion: i.descripcion || i.tipo, montoOriginal: Number(i.montoRecibido), monedaOriginal: i.moneda || 'CUP', tasaCambio: null, montoConvertido: Number(i.montoRecibido) })),
    pD.map((p: any) => ({ id: p.id, fecha: p.fechaPago, tipoMovimiento: 'pago_deuda', descripcion: 'Pago de deuda: ' + (p.comprobante || p.id), montoOriginal: Number(p.montoPagado), monedaOriginal: cuenta.moneda || 'CUP', tasaCambio: null, montoConvertido: Number(p.montoPagado), observaciones: p.observaciones || undefined }))
  )

  transacciones.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  if (tm) transacciones = transacciones.filter(t => t.tipoMovimiento === tm)
  const total = transacciones.length; const offset = (pg - 1) * lm; const paginated = transacciones.slice(offset, offset + lm)

  return NextResponse.json({
    transacciones: paginated, resumen: { saldoActual: Number(cuenta.saldo), totalIngresos: transacciones.filter(t => t.montoOriginal > 0).reduce((s, t) => s + t.montoOriginal, 0), totalEgresos: transacciones.filter(t => t.montoOriginal < 0).reduce((s, t) => s + Math.abs(t.montoOriginal), 0), totalMovimientos: total },
    pagination: { page: pg, limit: lm, total, totalPages: Math.ceil(total / lm) }
  })
}

// ═══ Cuentas por Cobrar ═══

interface CreateCuentaPorCobrarRequest { ventaId: string; monto: number; moneda: string }

export async function getCuentasPorCobrarHandler(request: NextRequest) {
  const cxc = await prisma.cuentaPorCobrar.findMany({
    include: { venta: { select: { ventaId: true, total: true, createdAt: true, cliente: { select: { nombre: true } } } }, pagos: { select: { monto: true, fechaPago: true } } },
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json({ cuentasPorCobrar: cxc })
}

export async function createCuentaPorCobrarHandler(request: NextRequest) {
  const data: CreateCuentaPorCobrarRequest = await request.json()
  const cxc = await prisma.cuentaPorCobrar.create({
    data: { ventaId: data.ventaId, montoOriginal: data.monto, moneda: data.moneda, saldoPendiente: data.monto, estado: 'PENDIENTE' }
  })
  return NextResponse.json({ cuentaPorCobrar: cxc }, { status: 201 })
}

export async function updateCuentaPorCobrarHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const body = await request.json()
  const updated = await prisma.cuentaPorCobrar.update({ where: { cuentaPorCobrarId: id }, data: body })
  return NextResponse.json({ cuentaPorCobrar: updated })
}

// ═══ Cuentas por Pagar ═══

export async function getCuentasPorPagarHandler(request: NextRequest) {
  const cxp = await prisma.cuentaPorPagar.findMany({
    include: { proveedor: { select: { vendorId: true, nombre: true } }, pagos: { select: { id: true, monto: true, fechaPago: true } } },
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json({ cuentasPorPagar: cxp })
}

export async function createCuentaPorPagarHandler(request: NextRequest) {
  const body = await request.json()
  const cxp = await prisma.cuentaPorPagar.create({
    data: { proveedorId: body.proveedorId, montoOriginal: body.monto, moneda: body.moneda || 'CUP', saldoPendiente: body.monto, descripcion: body.descripcion, estado: 'PENDIENTE', fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined }
  })
  return NextResponse.json({ cuentaPorPagar: cxp }, { status: 201 })
}

export async function pagarCuentaPorPagarHandler(request: NextRequest) {
  const body = await request.json()
  const cxp = await prisma.cuentaPorPagar.findUnique({ where: { cuentaPorPagarId: body.cuentaPorPagarId } })
  if (!cxp) return NextResponse.json({ error: 'Cuenta por pagar no encontrada' }, { status: 404 })
  await prisma.$transaction(async (tx: any) => {
    await tx.pagoCuentaPorPagar.create({ data: { cuentaPorPagarId: body.cuentaPorPagarId, monto: body.monto, cuentaBancariaId: body.cuentaBancariaId, fechaPago: new Date(), referencia: body.referencia } })
    const nsp = Number(cxp.saldoPendiente) - body.monto
    await tx.cuentaPorPagar.update({ where: { cuentaPorPagarId: body.cuentaPorPagarId }, data: { saldoPendiente: nsp, estado: nsp <= 0 ? 'PAGADA' : 'PARCIAL' } })
  })
  return NextResponse.json({ message: 'Pago registrado exitosamente' }, { status: 201 })
}
