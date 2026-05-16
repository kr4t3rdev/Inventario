/**
 * @description Server Actions para Reconciliación (ventas, servicios, gastos).
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Stats Hub ────────────────────────────────────────────

export const getReconciliacionStatsAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);

  const [vp, sp, gp, vh, sh, gh, montoHoy, act] = await Promise.all([
    // Pendientes: registros fuente sin reconciliación asignada
    prisma.venta.count({ where: { tenantId, reconciliaciones: { none: {} } } }),
    prisma.ventaServicios.count({ where: { tenantId, NOT: { reconciliado: true } } }),
    prisma.gastosDE.count({ where: { tenantId, reconciliaciones: { none: {} } } }),
    prisma.reconciliacionVenta.count({ where: { fechaReconciliacion: { gte: hoy, lt: manana }, tenantId } }),
    prisma.reconciliacionServicio.count({ where: { fechaReconciliacion: { gte: hoy, lt: manana }, tenantId } }),
    prisma.reconciliacionGasto.count({ where: { fechaReconciliacion: { gte: hoy, lt: manana }, tenantId } }),
    prisma.reconciliacionVenta.aggregate({ where: { fechaReconciliacion: { gte: hoy, lt: manana }, tenantId }, _sum: { monto: true } }),
    prisma.reconciliacionVenta.findMany({ where: { tenantId }, orderBy: { fechaReconciliacion: 'desc' }, take: 10, select: { reconciliacionId: true, monto: true, moneda: true, fechaReconciliacion: true, observaciones: true, cuentaBancaria: { select: { nombreBanco: true } } } }),
  ]);

  const totalHoy = Math.max(vh+vp, sh+sp, gh+gp, 1);
  return {
    modules: {
      ventas: { pending: vp, completedToday: vh, totalToday: vh+vp },
      servicios: { pending: sp, completedToday: sh, totalToday: sh+sp },
      gastos: { pending: gp, completedToday: gh, totalToday: gh+gp },
    },
    stats: { totalPending: vp+sp+gp, completedToday: vh+sh+gh, reconciledAmount: Number(montoHoy._sum.monto??0), efficiency: Math.round(((vh+sh+gh)/totalHoy)*100) },
    recentActivity: act.map((a:any) => ({ id: a.reconciliacionId, type: 'venta', reference: a.reconciliacionId.slice(0,8), description: a.observaciones||'Venta reconciliada', accountName: a.cuentaBancaria?.nombreBanco||'Sin cuenta', amount: Number(a.monto), date: a.fechaReconciliacion.toISOString() })),
  };
});

// ─── Ventas ────────────────────────────────────────────────

export const getVentasPendientesAction = withAction(async (params: {
  fechaInicio?: string; fechaFin?: string; page?: number; limit?: number;
} = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const where: any = { tenantId };
  if (params.fechaInicio || params.fechaFin) {
    where.fechaVenta = {};
    if (params.fechaInicio) where.fechaVenta.gte = new Date(params.fechaInicio);
    if (params.fechaFin) where.fechaVenta.lte = new Date(params.fechaFin);
  }
  const page = params.page || 1;
  const limit = params.limit || 50;
  const [ventas, total] = await Promise.all([
    prisma.venta.findMany({
      where, orderBy: {
  // @ts-expect-error
      fechaVenta: 'desc'
      },
      skip: (page-1)*limit, take: limit,
      include: {
  // @ts-expect-error
      cliente: { select: { nombre: true } }, puntoDeVenta: { select: { nombre: true } }, moneda: true
      },
    }),
    prisma.venta.count({ where }),
  ]);
  return { ventas, pagination: { page, limit, total, totalPages: Math.ceil(total/limit) } };
});

export const getHistorialReconciliacionVentasAction = withAction(async (params: {
  fechaInicio?: string; fechaFin?: string; cuentaId?: string;
} = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const where: any = { tenantId };
  if (params.cuentaId) where.cuentaId = params.cuentaId;
  if (params.fechaInicio || params.fechaFin) {
    where.fechaReconciliacion = {};
    if (params.fechaInicio) where.fechaReconciliacion.gte = new Date(params.fechaInicio);
    if (params.fechaFin) where.fechaReconciliacion.lte = new Date(params.fechaFin);
  }
  const reconciliaciones = await prisma.reconciliacionVenta.findMany({
    where, orderBy: { fechaReconciliacion: 'desc' }, take: 100,
    include: { venta: { select: { ventaId: true, total: true } }, cuentaBancaria: { select: { nombreBanco: true } }, tipoPago: { select: { nombre: true } } },
  });
  const porMoneda = await prisma.reconciliacionVenta.groupBy({ by: ['moneda'], where, _sum: { monto: true } });
  const porTipoDePago = await prisma.reconciliacionVenta.groupBy({ by: ['tipoPagoId'], where, _sum: { monto: true } });
  return {
    reconciliaciones,
    estadisticas: {
      montoTotal: reconciliaciones.reduce((s:number, r:any) => s+Number(r.monto), 0),
      montoConvertidoTotal: reconciliaciones.reduce((s:number, r:any) => s+Number(r.montoConvertido??0), 0),
      porMoneda, porTipoDePago,
    },
    pagination: {},
  };
});

export const reconciliarVentaAction = withAction(async (input: {
  ventaId: string; cuentaId: string; tipoPagoId: string; monto: number; moneda?: string;
  fechaReconciliacion?: string; observaciones?: string;
}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const reconciliacion = await prisma.reconciliacionVenta.create({
  // @ts-expect-error
    data: {
      ventaId: input.ventaId, cuentaId: input.cuentaId, tipoPagoId: input.tipoPagoId,
      monto: input.monto, moneda: input.moneda||'CUP',
      fechaReconciliacion: input.fechaReconciliacion ? new Date(input.fechaReconciliacion) : new Date(),
      observaciones: input.observaciones, tenantId,
    },
  });
  revalidatePath('/busy/contabilidad/reconciliacion');
  return reconciliacion;
});

// ─── Servicios ─────────────────────────────────────────────

export const getServiciosPendientesAction = withAction(async (params: {
  fechaDesde?: string; fechaHasta?: string; page?: number; limit?: number;
} = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const where: any = { tenantId };
  if (params.fechaDesde || params.fechaHasta) {
    where.fechaServicio = {};
    if (params.fechaDesde) where.fechaServicio.gte = new Date(params.fechaDesde);
    if (params.fechaHasta) where.fechaServicio.lte = new Date(params.fechaHasta);
  }
  const page = params.page || 1; const limit = params.limit || 50;
  const [ventaServicios, total] = await Promise.all([
    prisma.ventaServicios.findMany({
      where, orderBy: { fechaServicio: 'desc' },
      skip: (page-1)*limit, take: limit,
      include: { cliente: { select: { nombre: true } }, servicio: { select: { nombre: true } } },
    }),
    prisma.ventaServicios.count({
    where
    }),
  ]);
  return { ventaServicios, pagination: { page, limit, total, totalPages: Math.ceil(total/limit) } };
});

export const getHistorialReconciliacionServiciosAction = withAction(async (params: {
  fechaDesde?: string; fechaHasta?: string; cuentaId?: string;
} = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const where: any = { tenantId };
  if (params.cuentaId) where.cuentaId = params.cuentaId;
  if (params.fechaDesde || params.fechaHasta) {
    where.fechaReconciliacion = {};
    if (params.fechaDesde) where.fechaReconciliacion.gte = new Date(params.fechaDesde);
    if (params.fechaHasta) where.fechaReconciliacion.lte = new Date(params.fechaHasta);
  }
  const reconciliaciones = await prisma.reconciliacionServicio.findMany({
    where, orderBy: { fechaReconciliacion: 'desc' }, take: 100,
    include: {
    ventasServicio: { select: { ventaServicioId: true } }, cuentaBancaria: { select: { nombreBanco: true } }, tipoPago: { select: { nombre: true } }
    },
  });
  return { reconciliaciones, estadisticas: {}, pagination: {} };
});

export const reconciliarServicioAction = withAction(async (input: {
  ventaServicioId: string; cuentaId: string; tipoPagoId: string; monto: number; moneda?: string;
  fechaReconciliacion?: string; observaciones?: string;
}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const reconciliacion = await prisma.reconciliacionServicio.create({
  // @ts-expect-error
    data: {
      ventaServicioId: input.ventaServicioId, cuentaId: input.cuentaId, tipoPagoId: input.tipoPagoId,
      monto: input.monto, moneda: input.moneda||'CUP',
      fechaReconciliacion: input.fechaReconciliacion ? new Date(input.fechaReconciliacion) : new Date(),
      observaciones: input.observaciones, tenantId,
    },
  });
  revalidatePath('/busy/contabilidad/reconciliacion');
  return reconciliacion;
});

// ─── Gastos ────────────────────────────────────────────────

export const getGastosPendientesAction = withAction(async (params: {
  fechaDesde?: string; fechaHasta?: string; tipoGasto?: string; soloNoReconciliados?: boolean;
  page?: number; limit?: number;
} = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);

  // ── Query GastosDE ──
  const whereDE: any = { tenantId };
  if (params.soloNoReconciliados) whereDE.reconciliaciones = { none: {} };
  if (params.fechaDesde || params.fechaHasta) {
    whereDE.createdAt = {};
    if (params.fechaDesde) whereDE.createdAt.gte = new Date(params.fechaDesde);
    if (params.fechaHasta) whereDE.createdAt.lte = new Date(params.fechaHasta);
  }

  // ── Query GastoCompra (compras de productos) ──
  const whereGC: any = { tenantId, deletedAt: null };
  if (params.soloNoReconciliados) whereGC.reconciliaciones = { none: {} };
  if (params.fechaDesde || params.fechaHasta) {
    whereGC.fechaCompra = {};
    if (params.fechaDesde) whereGC.fechaCompra.gte = new Date(params.fechaDesde);
    if (params.fechaHasta) whereGC.fechaCompra.lte = new Date(params.fechaHasta);
  }

  const page = params.page || 1; const limit = params.limit || 50;

  // Traer ambos tipos y unificarlos
  const [gastosDE, gastosCompra] = await Promise.all([
    prisma.gastosDE.findMany({
      where: whereDE, orderBy: { createdAt: 'desc' },
      include: { reconciliaciones: { select: { reconciliacionId: true } } },
    }),
    prisma.gastoCompra.findMany({
      where: whereGC, orderBy: { fechaCompra: 'desc' },
      include: {
        reconciliaciones: { select: { reconciliacionId: true } },
        vendor: { select: { nombre: true } },
        producto: { select: { nombre: true } },
      },
    }),
  ]);

  // Mapear a GastoPendiente
  const gastos = [
    ...gastosDE.map((g: any) => ({
      tipo: 'gastoDE' as const,
      referenciaId: g.gastosDEId,
      descripcion: g.descripcion || `Gasto DE #${g.gastosDEId.slice(0, 8)}`,
      monto: Number(g.monto || g.total || 0),
      periodo: g.periodo || undefined,
      detalles: {
        proveedor: g.proveedor || undefined,
        descripcionOriginal: g.descripcion || undefined,
        isPagado: g.isPagado || undefined,
      },
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    })),
    ...gastosCompra.map((g: any) => ({
      tipo: 'compra' as const,
      referenciaId: g.gastoCompraId,
      descripcion: g.descripcion || `Compra #${g.gastoCompraId.slice(0, 8)}`,
      monto: Number(g.total || 0),
      periodo: g.periodo || undefined,
      detalles: {
        vendor: (g as any).vendor?.nombre || undefined,
        producto: (g as any).producto?.nombre || undefined,
        cantidad: g.cantidad || undefined,
        precioUnitario: g.precioUnitario || undefined,
        fechaCompra: g.fechaCompra?.toISOString() || undefined,
      },
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    })),
  ];

  // Ordenar por createdAt desc
  gastos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = gastos.length;
  const paginated = gastos.slice((page - 1) * limit, page * limit);

  return { gastos: paginated, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
});

export const getHistorialReconciliacionGastosAction = withAction(async (params: {
  fechaInicio?: string; fechaFin?: string; cuentaId?: string; tipoGasto?: string;
} = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const where: any = { tenantId };
  if (params.cuentaId) where.cuentaId = params.cuentaId;
  if (params.tipoGasto) where.tipoGasto = params.tipoGasto;
  if (params.fechaInicio || params.fechaFin) {
    where.fechaReconciliacion = {};
    if (params.fechaInicio) where.fechaReconciliacion.gte = new Date(params.fechaInicio);
    if (params.fechaFin) where.fechaReconciliacion.lte = new Date(params.fechaFin);
  }
  const reconciliaciones = await prisma.reconciliacionGasto.findMany({
    where, orderBy: { fechaReconciliacion: 'desc' }, take: 100,
    include: { cuentaBancaria: { select: { nombreBanco: true } }, tipoPago: { select: { nombre: true } } },
  });
  return { reconciliaciones, estadisticas: {}, pagination: {} };
});

export const reconciliarGastoAction = withAction(async (input: {
  gastoCompraId: string; cuentaId: string; tipoPagoId: string; monto: number; moneda?: string;
  fechaReconciliacion?: string; descripcion?: string; cuentaPorPagarId?: string;
}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const fechaPago = input.fechaReconciliacion ? new Date(input.fechaReconciliacion) : new Date();

  const result = await prisma.$transaction(async (tx: any) => {
    // 1. Crear la reconciliación
    const reconciliacion = await tx.reconciliacionGasto.create({
      data: {
        tipoGasto: 'compra',
        referenciaId: input.gastoCompraId,
        gastoCompraId: input.gastoCompraId,
        cuentaId: input.cuentaId,
        tipoPagoId: input.tipoPagoId,
        monto: input.monto,
        moneda: input.moneda || 'CUP',
        descripcion: input.descripcion || '',
        fechaReconciliacion: fechaPago,
        reconciliadoPor: user.userId,
        estado: 'PAGADA',
        cuentaPorPagarId: input.cuentaPorPagarId || null,
        tenantId,
      },
    });

    // 2. Descontar de la cuenta bancaria
    await tx.cuentaBancaria.update({
      where: { cuentaId: input.cuentaId },
      data: { saldo: { decrement: input.monto } },
    });

    // 3. Si viene de una CuentaPorPagar, actualizarla
    if (input.cuentaPorPagarId) {
      const cxp = await tx.cuentaPorPagar.findUnique({
        where: { cuentaPorPagarId: input.cuentaPorPagarId },
        select: { saldoPendiente: true, montoPagado: true },
      });

      if (cxp) {
        const nuevoPagado = (cxp.montoPagado || 0) + input.monto;
        const nuevoSaldo = Math.max(0, (cxp.saldoPendiente || 0) - input.monto);
        const nuevoEstado = nuevoSaldo <= 0 ? 'PAGADA' : 'PARCIAL';

        await tx.cuentaPorPagar.update({
          where: { cuentaPorPagarId: input.cuentaPorPagarId },
          data: {
            montoPagado: nuevoPagado,
            saldoPendiente: nuevoSaldo,
            estado: nuevoEstado,
          },
        });

        // Registrar el pago en PagoCuentaPorPagar para que se vea en el detalle
        await tx.pagoCuentaPorPagar.create({
          data: {
            cuentaPorPagarId: input.cuentaPorPagarId,
            monto: input.monto,
            numeroTransaccion: input.descripcion?.slice(0, 50) || `Pago ${fechaPago.toISOString().slice(0, 10)}`,
            cuentaProveedor: 'N/A',
            fechaPago,
            observaciones: input.descripcion || null,
          },
        });

        // Si quedó pagada totalmente, actualizar el CompraDocumento vinculado
        if (nuevoEstado === 'PAGADA') {
          const doc = await tx.compraDocumento.findFirst({
            where: { cuentaPorPagarId: input.cuentaPorPagarId },
            select: { compraDocumentoId: true },
          });
          if (doc) {
            await tx.compraDocumento.update({
              where: { compraDocumentoId: doc.compraDocumentoId },
              data: { estado: 'PAGADA' },
            });
          }
        }
      }
    }

    // Serializar Decimal → number para cliente
    return JSON.parse(JSON.stringify(reconciliacion));
  });

  revalidatePath('/busy/contabilidad/reconciliacion');
  revalidatePath('/busy/contabilidad/cuentas-por-pagar');
  return result;
});
