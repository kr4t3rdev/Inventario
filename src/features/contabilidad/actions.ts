'use server';
import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getTransferenciasBancariasAction = withAction(async (
  params: { fechaInicio?: string; fechaFin?: string; cuentaId?: string } = {},
  user: AuthenticatedUser
) => {
  const where: Record<string, any> = {};
  if (params.fechaInicio || params.fechaFin) {
    where.createdAt = {};
    if (params.fechaInicio) where.createdAt.gte = new Date(params.fechaInicio);
    if (params.fechaFin) where.createdAt.lte = new Date(params.fechaFin);
  }
  if (params.cuentaId) where.cuentaId = params.cuentaId;
  const [transferencias, total] = await Promise.all([
    prisma.transferenciaBancaria.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.transferenciaBancaria.count({ where }),
  ]);
  return {
    transferencias: transferencias.map(t => ({
      ...t,
      montoOrigen: Number(t.montoOrigen),
      montoDestino: Number(t.montoDestino),
      tasaCambio: t.tasaCambio ? Number(t.tasaCambio) : null,
    })),
    pagination: { page: 1, limit: 50, total, totalPages: Math.ceil(total / 50) },
  };
});

function bdf(fi: string | null, ff: string | null): Record<string, Date> { const r: Record<string, Date> = {}; if (fi) r.gte = new Date(fi); if (ff) r.lte = new Date(ff); return r; }

export const getResumenFinancieroAction = withAction(async (f: { fechaInicio?: string; fechaFin?: string; cuentaId?: string; moneda?: string }, _user: AuthenticatedUser) => {
  const df = bdf(f.fechaInicio || null, f.fechaFin || null), sf = Object.keys(df).length ? { gte: df.gte, lte: df.lte } : {}, af = f.cuentaId ? { cuentaId: f.cuentaId } : {};
  const wf = Object.keys(sf).length ? { fechaReconciliacion: sf } : {};

  const [cuentas, rV, rS, rG, tfs, ajs, iC, pD, mPC, dC] = await Promise.all([
    prisma.cuentaBancaria.findMany({ where: { isActive: true, ...af }, select: { cuentaId: true, nombreBanco: true, numeroCuenta: true, saldo: true, moneda: true, tipoCuenta: true } }),
    // rV: exclude ALL debt-related tipoReconciliacion — solo ingreso real (ventas, cobros de préstamos)
    prisma.reconciliacionVenta.findMany({ where: { ...af, ...wf, tipoReconciliacion: { notIn: ['PRESTAMO_CASH_DESEMBOLSO', 'DEUDA_CASH_DESEMBOLSO', 'DEUDA_CASH'] } }, select: { monto: true, moneda: true, tipoReconciliacion: true } }),
    prisma.reconciliacionServicio.findMany({ where: { ...af, ...wf }, select: { monto: true, moneda: true } }),
    prisma.reconciliacionGasto.findMany({ where: { ...af, ...wf }, select: { monto: true, moneda: true, tipoGasto: true } }),
    prisma.transferenciaBancaria.findMany({ where: { ...(Object.keys(sf).length ? { fechaTransferencia: sf } : {}), ...(f.cuentaId ? { OR: [{ cuentaOrigenId: f.cuentaId }, { cuentaDestinoId: f.cuentaId }] } : {}) }, select: { montoOrigen: true, monedaOrigen: true, montoDestino: true, monedaDestino: true } }),
    prisma.ajusteBancario.findMany({ where: { ...af, ...(Object.keys(sf).length ? { createdAt: sf } : {}) }, select: { tipo: true, monto: true, moneda: true } }),
    prisma.inyeccionCapital.findMany({ where: { ...af, ...(Object.keys(sf).length ? { createdAt: sf } : {}) }, select: { montoRecibido: true, moneda: true } }),
    prisma.pagoDeuda.findMany({ where: { ...af, ...(Object.keys(sf).length ? { fechaPago: sf } : {}) }, select: { montoPagado: true, cuentaBancaria: { select: { moneda: true } } } }),
    // Desembolsos de préstamos (dinero que sale) → egreso
    prisma.reconciliacionVenta.findMany({ where: { ...af, ...wf, tipoReconciliacion: { in: ['PRESTAMO_CASH_DESEMBOLSO'] } }, select: { monto: true, moneda: true, cuentaBancaria: { select: { moneda: true } } } }),
    // Pagos de deudas cash (dinero que sale para pagar deuda con vendor) → egreso
    prisma.reconciliacionVenta.findMany({ where: { ...af, ...wf, tipoReconciliacion: { in: ['DEUDA_CASH'] } }, select: { monto: true, moneda: true } }),
  ]);

  const sumBy = (items: any[], key: string, val: string) => items.reduce((acc: any, i: any) => { const m = i[key] || 'CUP'; acc[m] = (acc[m] || 0) + Number(i[val]); return acc; }, {} as Record<string, number>);
  const sPD = (items: any[]) => items.reduce((acc: any, i: any) => { const m = i.cuentaBancaria?.moneda || 'CUP'; acc[m] = (acc[m] || 0) + Number(i.montoPagado); return acc; }, {} as Record<string, number>);
  const sPC = (items: any[]) => items.reduce((acc: any, i: any) => { const m = i.moneda || i.cuentaBancaria?.moneda || 'CUP'; acc[m] = (acc[m] || 0) + Number(i.monto); return acc; }, {} as Record<string, number>);

  const iV = sumBy(rV, 'moneda', 'monto'), iS = sumBy(rS, 'moneda', 'monto'), iI = sumBy(iC, 'moneda', 'montoRecibido');
  const eG = sumBy(rG, 'moneda', 'monto'), eA = ajs.filter((a: any) => a.tipo === 'egreso').reduce((acc: any, a: any) => { const m = a.moneda || 'CUP'; acc[m] = (acc[m] || 0) + Number(a.monto); return acc; }, {} as Record<string, number>);
  const iA = ajs.filter((a: any) => a.tipo === 'ingreso').reduce((acc: any, a: any) => { const m = a.moneda || 'CUP'; acc[m] = (acc[m] || 0) + Number(a.monto); return acc; }, {} as Record<string, number>);
  const ePD = sPD(pD), ePC = sPC(mPC), eDC = sumBy(dC, 'moneda', 'monto');

  const todas = new Set([...Object.keys(cuentas.reduce((acc: any, c: any) => { acc[c.moneda || 'CUP'] = 0; return acc; }, {} as Record<string, number>)), ...Object.keys(iV), ...Object.keys(iS), ...Object.keys(iI), ...Object.keys(eG), ...Object.keys(ePD), ...Object.keys(ePC), ...Object.keys(eDC), ...Object.keys(eA), ...Object.keys(iA)]);

  const resumenPorMoneda = Array.from(todas).map((m: string) => ({
    moneda: m, saldoActual: cuentas.filter((c: any) => (c.moneda || 'CUP') === m).reduce((s: number, c: any) => s + Number(c.saldo || 0), 0),
    totalIngresos: (iV[m]||0) + (iS[m]||0) + (iA[m]||0) + (iI[m]||0),
    totalEgresos: (eG[m]||0) + (eA[m]||0) + (ePD[m]||0) + (ePC[m]||0) + (eDC[m]||0),
    flujoNeto: ((iV[m]||0)+(iS[m]||0)+(iA[m]||0)+(iI[m]||0)) - ((eG[m]||0)+(eA[m]||0)+(ePD[m]||0)+(ePC[m]||0)+(eDC[m]||0)),
    desglose: { ingresos: { ventas: iV[m]||0, servicios: iS[m]||0, ajustes: iA[m]||0, inyecciones: iI[m]||0 }, egresos: { gastos: eG[m]||0, ajustes: eA[m]||0, pagosDeuda: ePD[m]||0, prestamosCash: ePC[m]||0, deudasCash: eDC[m]||0 } }
  }));

  return {
    resumenPorMoneda,
    cuentasBancarias: cuentas.map(c => ({ ...c, saldo: Number(c.saldo) })),
    estadisticas: { totalCuentas: cuentas.length, totalReconciliaciones: rV.length + rS.length + rG.length, totalTransferencias: tfs.length, totalAjustes: ajs.length, totalInyecciones: iC.length, periodo: { fechaInicio: f.fechaInicio || 'Sin límite', fechaFin: f.fechaFin || 'Sin límite' } },
    filtros: { fechaInicio: f.fechaInicio || null, fechaFin: f.fechaFin || null, cuentaId: f.cuentaId || null, moneda: f.moneda || 'CUP' }
  };
});

export const getMovimientosReportAction = withAction(async (f: { busqueda?: string; fechaInicio?: string; fechaFin?: string; cuentaId?: string; tipoMovimiento?: string; moneda?: string; page?: number; limit?: number }, _user: AuthenticatedUser) => {
  const { busqueda: bq, fechaInicio: fi, fechaFin: ff, cuentaId: cid, tipoMovimiento: tm, moneda: mo, page: pg = 1, limit: lm = 10 } = f;
  const df = bdf(fi || null, ff || null), af = cid ? { cuentaId: cid } : {};
  const [v, s, g] = await Promise.all([
    prisma.reconciliacionVenta.findMany({ where: { ...af, ...(Object.keys(df).length ? { fechaReconciliacion: df } : {}), ...(mo ? { moneda: mo } : {}) }, select: { reconciliacionId: true, monto: true, moneda: true, fechaReconciliacion: true, observaciones: true, tipoReconciliacion: true, venta: { select: { ventaId: true, total: true } }, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } }, tipoPago: { select: { nombre: true } } } }),
    prisma.reconciliacionServicio.findMany({ where: { ...af, ...(Object.keys(df).length ? { fechaReconciliacion: df } : {}), ...(mo ? { moneda: mo } : {}) }, select: { reconciliacionId: true, monto: true, moneda: true, fechaReconciliacion: true, ventasServicio: { select: { ventaServicioId: true } }, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } }, tipoPago: { select: { nombre: true } } } }),
    prisma.reconciliacionGasto.findMany({ where: { ...af, ...(Object.keys(df).length ? { fechaReconciliacion: df } : {}), ...(mo ? { moneda: mo } : {}) }, select: { reconciliacionId: true, monto: true, moneda: true, tipoGasto: true, descripcion: true, fechaReconciliacion: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } }, tipoPago: { select: { nombre: true } } } }),
  ]);
  const mvs = [].concat(
  // @ts-expect-error
    v.map((m: any) => ({
    id: m.reconciliacionId, tipo: m.tipoReconciliacion === 'PRESTAMO_CASH' ? 'prestamo_cash_pago' : 'venta', fecha: m.fechaReconciliacion, monto: Number(m.monto), moneda: m.moneda||'CUP', descripcion: m.venta ? 'Venta '+m.venta.ventaId : 'Cobro', cuenta: m.cuentaBancaria.nombreBanco, observaciones: m.observaciones
    })),
    s.map((m: any) => ({ id: m.reconciliacionId, tipo: 'servicio', fecha: m.fechaReconciliacion, monto: Number(m.monto), moneda: m.moneda||'CUP', descripcion: 'Servicio '+m.ventasServicio.ventaServicioId, cuenta: m.cuentaBancaria.nombreBanco })),
    g.map((m: any) => ({ id: m.reconciliacionId, tipo: m.tipoGasto||'gasto', fecha: m.fechaReconciliacion, monto: -Number(m.monto), moneda: m.moneda||'CUP', descripcion: m.descripcion, cuenta: m.cuentaBancaria.nombreBanco }))
  );
  let mf = tm && tm !== 'all' ? mvs.filter((x: any) => x.tipo === tm) : mvs;
  if (bq) mf = mf.filter((x: any) => (x.descripcion||'').toLowerCase().includes(bq.toLowerCase()));
  mf.sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  const off = (pg-1)*lm, mp = mf.slice(off, off+lm);
  return { data: mp, pagination: { page: pg, limit: lm, total: mf.length, totalPages: Math.ceil(mf.length/lm) } };
});

export const validarTransferenciaAction = withAction(async (input: { cuentaOrigenId: string; cuentaDestinoId: string; monto: number; motivo: string; descripcion?: string }, _user: AuthenticatedUser) => {
  if (input.cuentaOrigenId === input.cuentaDestinoId) {
    throw new Error('La cuenta origen y destino deben ser diferentes');
  }

  const [cuentaOrigen, cuentaDestino] = await Promise.all([
    prisma.cuentaBancaria.findUnique({ where: { cuentaId: input.cuentaOrigenId }, select: { cuentaId: true, nombreBanco: true, numeroCuenta: true, saldo: true, moneda: true, isActive: true } }),
    prisma.cuentaBancaria.findUnique({ where: { cuentaId: input.cuentaDestinoId }, select: { cuentaId: true, nombreBanco: true, numeroCuenta: true, saldo: true, moneda: true, isActive: true } }),
  ]);

  if (!cuentaOrigen) throw new Error('Cuenta origen no encontrada');
  if (!cuentaOrigen.isActive) throw new Error('La cuenta origen no está activa');
  if (!cuentaDestino) throw new Error('Cuenta destino no encontrada');
  if (!cuentaDestino.isActive) throw new Error('La cuenta destino no está activa');

  const advertencias: string[] = [];
  const saldoNumerico = Number(cuentaOrigen.saldo);
  const saldoSuficiente = saldoNumerico >= input.monto;

  if (!saldoSuficiente) {
    advertencias.push(`Saldo insuficiente. Disponible: ${saldoNumerico} ${cuentaOrigen.moneda}`);
  }

  const saldoRestante = saldoNumerico - input.monto;
  const porcentajeRestante = (saldoRestante / saldoNumerico) * 100;
  if (porcentajeRestante < 20 && saldoRestante > 0) {
    advertencias.push(`El saldo restante será bajo: ${saldoRestante.toFixed(2)} ${cuentaOrigen.moneda}`);
  }

  if (cuentaOrigen.moneda !== cuentaDestino.moneda) {
    advertencias.push('Esta transferencia requiere confirmación de tasa de cambio');
  }

  return { saldoSuficiente, advertencias };
});

export const createTransferenciaBancariaAction = withAction(withPeriodValidation(
  // Transferencias usan la fecha actual como fecha de negocio
  () => new Date(),
  async (input: { cuentaOrigenId: string; cuentaDestinoId: string; montoOrigen: number; montoDestino?: number; motivo: string; descripcion?: string; tasaCambio?: number; monedaPrincipal?: string }, user: AuthenticatedUser) => {
    if (input.cuentaOrigenId === input.cuentaDestinoId) {
      throw new Error('La cuenta origen y destino deben ser diferentes');
    }

    const [cuentaOrigen, cuentaDestino] = await Promise.all([
      prisma.cuentaBancaria.findUnique({ where: { cuentaId: input.cuentaOrigenId } }),
      prisma.cuentaBancaria.findUnique({ where: { cuentaId: input.cuentaDestinoId } }),
    ]);

    if (!cuentaOrigen) throw new Error('Cuenta origen no encontrada');
    if (!cuentaDestino) throw new Error('Cuenta destino no encontrada');
    if (!cuentaOrigen.isActive) throw new Error('La cuenta origen no está activa');
    if (!cuentaDestino.isActive) throw new Error('La cuenta destino no está activa');
    if (Number(cuentaOrigen.saldo) < input.montoOrigen) throw new Error('Saldo insuficiente en la cuenta origen');

    let montoDestino = input.montoDestino || input.montoOrigen;
    let tasaCambioFinal = input.tasaCambio;

    if (cuentaOrigen.moneda !== cuentaDestino.moneda || cuentaDestino.moneda !== 'CUP') {
      if (!input.tasaCambio) throw new Error('Tasa de cambio requerida para transferencias entre diferentes monedas');
      montoDestino = input.montoOrigen * input.tasaCambio;
      tasaCambioFinal = input.tasaCambio;
    }

    const lastTransferencia = await prisma.transferenciaBancaria.findFirst({
      orderBy: { numeroComprobante: 'desc' },
      select: { numeroComprobante: true }
    });

    let nextNumber = 1;
    if (lastTransferencia?.numeroComprobante) {
      const lastNumber = parseInt(lastTransferencia.numeroComprobante.replace(/\D/g, ''));
      nextNumber = lastNumber + 1;
    }
    const numeroComprobante = `TRF-${nextNumber.toString().padStart(6, '0')}`;

    const transferencia = await prisma.$transaction(async (tx: any) => {
      await tx.cuentaBancaria.update({ where: { cuentaId: input.cuentaOrigenId }, data: { saldo: { decrement: input.montoOrigen } } });
      await tx.cuentaBancaria.update({ where: { cuentaId: input.cuentaDestinoId }, data: { saldo: { increment: montoDestino } } });

      return tx.transferenciaBancaria.create({
        data: {
          numeroComprobante,
          cuentaOrigenId: input.cuentaOrigenId,
          cuentaDestinoId: input.cuentaDestinoId,
          montoOrigen: input.montoOrigen,
          monedaOrigen: cuentaOrigen.moneda,
          montoDestino,
          monedaDestino: cuentaDestino.moneda,
          tasaCambio: tasaCambioFinal,
          motivo: input.motivo,
          descripcion: input.descripcion,
          comprobanteGenerado: true,
        } as any,
        include: { cuentaOrigen: { select: { nombreBanco: true, numeroCuenta: true, moneda: true } }, cuentaDestino: { select: { nombreBanco: true, numeroCuenta: true, moneda: true } } }
      });
    });

    return {
      transferencia: {
        ...transferencia,
        montoOrigen: Number(transferencia.montoOrigen),
        montoDestino: Number(transferencia.montoDestino),
        tasaCambio: transferencia.tasaCambio ? Number(transferencia.tasaCambio) : null,
      },
      numeroComprobante,
    };
  }
));
