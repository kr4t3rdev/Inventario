import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import type { Prisma } from '@/generated/prisma'
import { authenticateUser } from '@/lib/auth-middleware'
import { requireFeature } from '@/lib/services/tenant-scope'
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
     prisma.ajusteBancario.findMany({ where: { ...af, ...(Object.keys(df).length ? { fechaOperacion: df } : {}), ...(mo ? { moneda: mo } : {}) }, select: { ajusteId: true, tipo: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, descripcion: true, motivo: true, realizadoPor: true, fechaOperacion: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } } }, orderBy: { fechaOperacion: 'desc' } }),
    prisma.inyeccionCapital.findMany({ where: { ...af, ...(Object.keys(df).length ? { createdAt: df } : {}), ...(mo ? { moneda: mo } : {}) }, select: { id: true, tipo: true, montoRecibido: true, moneda: true, descripcion: true, socio: true, entidadPrestamista: true, createdAt: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.pagoDeuda.findMany({ where: { ...af, ...(Object.keys(df).length ? { fechaPago: df } : {}), ...(mo ? { cuentaBancaria: { moneda: mo } } : {}) }, select: { id: true, montoPagado: true, fechaPago: true, comprobante: true, observaciones: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true, moneda: true } }, inyeccion: { select: { entidadPrestamista: true, tipo: true } } }, orderBy: { fechaPago: 'desc' } })
  ])

  const mvs = ([] as any[]).concat(
    v.map((m: any) => ({ id: m.reconciliacionId, tipo: m.tipoReconciliacion === 'PRESTAMO_CASH' ? 'prestamo_cash_pago' : m.tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO' ? 'prestamo_cash_desembolso' : m.tipoReconciliacion === 'DEUDA_CASH' ? 'deuda_cash_pago' : m.tipoReconciliacion === 'DEUDA_CASH_DESEMBOLSO' ? 'deuda_cash_desembolso' : 'venta', fecha: m.fechaReconciliacion, monto: Number(m.monto), moneda: m.moneda || 'CUP', montoConvertido: m.tasaCambio ? Number(m.monto) * Number(m.tasaCambio) : Number(m.monto), tasaCambio: m.tasaCambio ? Number(m.tasaCambio) : null, descripcion: m.tipoReconciliacion === 'PRESTAMO_CASH' ? 'Cobro Prestamo Cash' : m.tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO' ? 'Desembolso Prestamo Cash' : m.tipoReconciliacion === 'DEUDA_CASH' ? 'Pago Deuda Cash' : m.tipoReconciliacion === 'DEUDA_CASH_DESEMBOLSO' ? 'Desembolso Deuda Cash' : m.venta ? 'Venta ' + m.venta.ventaId : 'Cobro ' + m.reconciliacionId, cuenta: m.cuentaBancaria.nombreBanco + ' - ' + m.cuentaBancaria.numeroCuenta, tipoPago: m.tipoPago.nombre, observaciones: m.observaciones, realizadoPor: m.reconciliadoPor, referencia: m.venta?.ventaId || m.reconciliacionId })),
    s.map((m: any) => ({ id: m.reconciliacionId, tipo: 'servicio', fecha: m.fechaReconciliacion, monto: Number(m.monto), moneda: m.moneda || 'CUP', montoConvertido: m.tasaCambio ? Number(m.monto) * Number(m.tasaCambio) : Number(m.monto), tasaCambio: m.tasaCambio ? Number(m.tasaCambio) : null, descripcion: 'Servicio ' + m.ventasServicio.ventaServicioId, cuenta: m.cuentaBancaria.nombreBanco + ' - ' + m.cuentaBancaria.numeroCuenta, tipoPago: m.tipoPago.nombre, observaciones: m.observaciones, realizadoPor: m.reconciliadoPor, referencia: m.ventasServicio.ventaServicioId })),
    g.map((m: any) => ({ id: m.reconciliacionId, tipo: m.tipoGasto === 'salario' ? 'salario' : 'gasto', fecha: m.fechaReconciliacion, monto: -Number(m.monto), moneda: m.moneda || 'CUP', montoConvertido: m.tasaCambio ? -Number(m.monto) * Number(m.tasaCambio) : -Number(m.monto), tasaCambio: m.tasaCambio ? Number(m.tasaCambio) : null, descripcion: m.descripcion, cuenta: m.cuentaBancaria.nombreBanco + ' - ' + m.cuentaBancaria.numeroCuenta, tipoPago: m.tipoPago.nombre, observaciones: m.observaciones, realizadoPor: m.reconciliadoPor, referencia: m.reconciliacionId })),
    t.flatMap((m: any) => { const r = []; if (!cid || m.cuentaOrigen) r.push({ id: m.transferenciaId + '-origen', tipo: 'transferencia_salida', fecha: m.fechaTransferencia, monto: -Number(m.montoOrigen), moneda: m.monedaOrigen || 'CUP', montoConvertido: null, tasaCambio: m.tasaCambio ? Number(m.tasaCambio) : null, descripcion: 'Transf a ' + m.cuentaDestino.nombreBanco, cuenta: m.cuentaOrigen.nombreBanco + ' - ' + m.cuentaOrigen.numeroCuenta, tipoPago: 'Transferencia', observaciones: m.descripcion, referencia: m.numeroComprobante }); if (!cid || m.cuentaDestino) r.push({ id: m.transferenciaId + '-destino', tipo: 'transferencia_entrada', fecha: m.fechaTransferencia, monto: Number(m.montoDestino), moneda: m.monedaDestino || 'CUP', montoConvertido: Number(m.montoDestino), tasaCambio: m.tasaCambio ? Number(m.tasaCambio) : null, descripcion: 'Transf desde ' + m.cuentaOrigen.nombreBanco, cuenta: m.cuentaDestino.nombreBanco + ' - ' + m.cuentaDestino.numeroCuenta, tipoPago: 'Transferencia', observaciones: m.descripcion, referencia: m.numeroComprobante }); return r }),
     aj.map((m: any) => ({ id: m.ajusteId, tipo: m.tipo === 'ingreso' ? 'ajuste_ingreso' : 'ajuste_egreso', fecha: m.fechaOperacion, monto: m.tipo === 'ingreso' ? Number(m.monto) : -Number(m.monto), moneda: m.moneda || 'CUP', montoConvertido: m.montoConvertido != null ? (m.tipo === 'ingreso' ? Number(m.montoConvertido) : -Number(m.montoConvertido)) : (m.moneda || 'CUP') === 'CUP' ? (m.tipo === 'ingreso' ? Number(m.monto) : -Number(m.monto)) : null, tasaCambio: m.tasaCambio ? Number(m.tasaCambio) : null, descripcion: m.descripcion, cuenta: m.cuentaBancaria.nombreBanco + ' - ' + m.cuentaBancaria.numeroCuenta, tipoPago: m.tipo === 'ingreso' ? 'Ajuste Ingreso' : 'Ajuste Egreso', observaciones: m.motivo, realizadoPor: m.realizadoPor, referencia: m.ajusteId })),
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
     prisma.ajusteBancario.findMany({ where: { ...(Object.keys(df).length ? { fechaOperacion: df } : {}), tasaCambio: { not: null }, moneda: { not: mb } }, include: { cuentaBancaria: true }, orderBy: { fechaOperacion: 'desc' } }),
    prisma.transferenciaBancaria.findMany({ where: { ...(Object.keys(df).length ? { fechaTransferencia: df } : {}), tasaCambio: { not: null }, OR: [{ monedaOrigen: { not: mb } }, { monedaDestino: { not: mb } }] }, include: { cuentaOrigen: true, cuentaDestino: true }, orderBy: { fechaTransferencia: 'desc' } })
  ])
  const c: any[] = []
  rv.forEach((r: any) => c.push({ id: r.reconciliacionId, fecha: r.fechaReconciliacion, tipo: 'venta', monedaOriginal: r.moneda, montoOriginal: Number(r.monto), tasaCambio: Number(r.tasaCambio), montoConvertido: Number(r.montoConvertido || r.monto), cuentaId: r.cuentaId, cuenta: r.cuentaBancaria }))
  rs.forEach((r: any) => c.push({ id: r.reconciliacionId, fecha: r.fechaReconciliacion, tipo: 'servicio', monedaOriginal: r.moneda, montoOriginal: Number(r.monto), tasaCambio: Number(r.tasaCambio), montoConvertido: Number(r.montoConvertido || r.monto), cuentaId: r.cuentaId, cuenta: r.cuentaBancaria }))
  rg.forEach((r: any) => c.push({ id: r.reconciliacionId, fecha: r.fechaReconciliacion, tipo: r.tipoGasto, monedaOriginal: r.moneda, montoOriginal: Number(r.monto), tasaCambio: Number(r.tasaCambio), montoConvertido: Number(r.montoConvertido || r.monto), cuentaId: r.cuentaId, cuenta: r.cuentaBancaria }))
   ab.forEach((a: any) => c.push({ id: a.ajusteId, fecha: a.fechaOperacion, tipo: 'ajuste_' + a.tipo, monedaOriginal: a.moneda, montoOriginal: Number(a.monto), tasaCambio: Number(a.tasaCambio), montoConvertido: Number(a.montoConvertido), cuentaId: a.cuentaId, cuenta: a.cuentaBancaria }))
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
  const iV = rv.filter((r: any) => !r.tipoReconciliacion?.startsWith('PRESTAMO_CASH') && !r.tipoReconciliacion?.startsWith('DEUDA_CASH')).reduce((a: any, r: any) => { const m = r.moneda || 'CUP'; a[m] = (a[m] || 0) + Number(r.monto); return a }, {})
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
  const a = await authenticateUser(request); if ('status' in a) return a as Response; const u = a.user; requireFeature(u, 'inyeccion-capital', 'ver inyecciones de capital');
  const tipo = new URL(request.url).searchParams.get('tipo'); const w: any = {}; if (tipo) w.tipo = tipo
  return NextResponse.json({ inyecciones: await prisma.inyeccionCapital.findMany({ where: w, include: { cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true, moneda: true } }, pagos: true }, orderBy: { createdAt: 'desc' } }) })
}

export async function createInyeccionCapital(request: NextRequest) {
  const a = await authenticateUser(request); if ('status' in a) return a as Response; const u = a.user; requireFeature(u, 'inyeccion-capital', 'registrar inyecciones de capital');
  const v = icSchema.parse(await request.json())
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
  const a = await authenticateUser(request); if ('status' in a) return a as Response; const u = a.user; requireFeature(u, 'inyeccion-capital', 'registrar pagos de deuda');
  const v = pdSchema.parse(await request.json())
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
  const c = await crearCierreContable(u.tenantId ?? '', b.tipo, new Date(b.fechaInicio), new Date(b.fechaFin), u.userId, b.observaciones)
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

const ajSchema = z.object({ cuentaId: z.string().min(1), tipo: z.enum(['ingreso', 'egreso']), monto: z.number().positive(), moneda: z.string().min(1).default('CUP'), tasaCambio: z.number().positive().optional(), descripcion: z.string().min(1), motivo: z.string().min(1), fechaOperacion: z.coerce.date().optional() })

export async function createAjusteBancario(request: NextRequest) {
  const a = await authenticateUser(request); if ('status' in a) return a as Response; const u = a.user; const v = ajSchema.parse(await request.json())
  const cb = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: v.cuentaId } })
  if (!cb || !cb.isActive) return NextResponse.json({ error: 'Cuenta invalida' }, { status: 400 })
  const r = await prisma.$transaction(async (tx: any) => {
    const moneda = v.moneda.toUpperCase()
    const aj = await tx.ajusteBancario.create({ data: { cuentaId: v.cuentaId, tipo: v.tipo, monto: v.monto, moneda: v.moneda, tasaCambio: moneda === 'CUP' ? 1 : v.tasaCambio, montoConvertido: moneda === 'CUP' ? v.monto : v.tasaCambio ? v.monto * v.tasaCambio : null, descripcion: v.descripcion, motivo: v.motivo, realizadoPor: u.userId, fechaOperacion: v.fechaOperacion ?? new Date(), tenantId: u.tenantId ?? undefined } })
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
  if (q.fechaInicio || q.fechaFin) { w.fechaOperacion = {}; if (q.fechaInicio) w.fechaOperacion.gte = new Date(q.fechaInicio); if (q.fechaFin) { const f = new Date(q.fechaFin); f.setHours(23, 59, 59, 999); w.fechaOperacion.lte = f } }
  const off = (q.page - 1) * q.limit
  const [aj, to] = await Promise.all([prisma.ajusteBancario.findMany({ where: w, orderBy: { fechaOperacion: 'desc' }, skip: off, take: q.limit }), prisma.ajusteBancario.count({ where: w })])
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

// ═══ (Cuentas Bancarias, Cuentas x Cobrar/Pagar migradas a Server Actions) ═══
