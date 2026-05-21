/**
 * @description Server Actions para Reconciliación (ventas, servicios, gastos).
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Stats Hub ────────────────────────────────────────────

export const getReconciliacionStatsAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);

  const [vp, sp, gp, gs, gc, gvs, vh, sh, gh, montoHoy, act] = await Promise.all([
    // Pendientes: registros fuente sin reconciliación asignada
    prisma.venta.count({ where: { tenantId, reconciliaciones: { none: {} } } }),
    prisma.ventaServicios.count({ where: { tenantId, NOT: { reconciliado: true } } }),
    prisma.gastosDE.count({ where: { tenantId, reconciliaciones: { none: {} } } }),
    prisma.pagosalario.count({ where: { tenantId, ReconciliacionGasto: { none: {} } } }),
    // CompraServicio sin reconciliar - obtener IDs reconciliados primero
    (async () => {
      const reconciliados = await prisma.reconciliacionGasto.findMany({
        where: { tenantId, tipoGasto: 'servicio' },
        select: { referenciaId: true },
        distinct: ['referenciaId'],
      });
      const idsReconciliados = reconciliados.map(r => r.referenciaId).filter(Boolean);
      return prisma.compraServicio.count({
        where: {
          tenantId,
          compraServicioId: idsReconciliados.length > 0 ? { notIn: idsReconciliados } : undefined,
        },
      });
    })(),
    // VentaServicios con costo > 0 sin reconciliar en ReconciliacionGasto (venta_servicio)
    (async () => {
      const reconciliados = await prisma.reconciliacionGasto.findMany({
        where: { tenantId, tipoGasto: 'venta_servicio' },
        select: { referenciaId: true },
        distinct: ['referenciaId'],
      });
      const idsReconciliados = reconciliados.map(r => r.referenciaId).filter(Boolean);
      return prisma.ventaServicios.count({
        where: {
          tenantId,
          costo: { gt: 0 },
          ventaServicioId: idsReconciliados.length > 0 ? { notIn: idsReconciliados } : undefined,
        },
      });
    })(),
    prisma.reconciliacionVenta.count({ where: { fechaReconciliacion: { gte: hoy, lt: manana }, tenantId } }),
    prisma.reconciliacionServicio.count({ where: { fechaReconciliacion: { gte: hoy, lt: manana }, tenantId } }),
    prisma.reconciliacionGasto.count({ where: { fechaReconciliacion: { gte: hoy, lt: manana }, tenantId } }),
    prisma.reconciliacionVenta.aggregate({ where: { fechaReconciliacion: { gte: hoy, lt: manana }, tenantId }, _sum: { monto: true } }),
    prisma.reconciliacionVenta.findMany({ where: { tenantId }, orderBy: { fechaReconciliacion: 'desc' }, take: 10, select: { reconciliacionId: true, monto: true, moneda: true, fechaReconciliacion: true, observaciones: true, cuentaBancaria: { select: { nombreBanco: true } } } }),
  ]);

  const gastosPendientes = gp + gs + gc + gvs;

  const totalHoy = Math.max(vh+vp, sh+sp, gh+gastosPendientes, 1);
  return {
    modules: {
      ventas: { pending: vp, completedToday: vh, totalToday: vh+vp },
      servicios: { pending: sp, completedToday: sh, totalToday: sh+sp },
      gastos: { pending: gastosPendientes, completedToday: gh, totalToday: gh+gastosPendientes },
    },
    stats: { totalPending: vp+sp+gastosPendientes, completedToday: vh+sh+gh, reconciledAmount: Number(montoHoy._sum.monto??0), efficiency: Math.round(((vh+sh+gh)/totalHoy)*100) },
    recentActivity: act.map((a:any) => ({ id: a.reconciliacionId, type: 'venta', reference: a.reconciliacionId.slice(0,8), description: a.observaciones||'Venta reconciliada', accountName: a.cuentaBancaria?.nombreBanco||'Sin cuenta', amount: Number(a.monto), date: a.fechaReconciliacion.toISOString() })),
  };
});

// ─── Ventas ────────────────────────────────────────────────

export const getVentasPendientesAction = withAction(async (params: {
  fechaInicio?: string; fechaFin?: string; puntoDeVentaId?: string;
  page?: number; limit?: number;
} = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const page = params.page || 1;
  const limit = Math.min(200, params.limit || 50);
  const skip = (page - 1) * limit;

  // Build WHERE clause for raw SQL
  const whereParts: Prisma.Sql[] = [Prisma.sql`v."tenantId" = ${tenantId}`];
  if (params.fechaInicio) whereParts.push(Prisma.sql`v."fechaVenta" >= ${new Date(params.fechaInicio)}`);
  if (params.fechaFin) {
    const fechaFinDate = new Date(params.fechaFin);
    fechaFinDate.setUTCHours(23, 59, 59, 999);
    whereParts.push(Prisma.sql`v."fechaVenta" <= ${fechaFinDate}`);
  }
  if (params.puntoDeVentaId) whereParts.push(Prisma.sql`v."puntoDeVentaId" = ${params.puntoDeVentaId}`);

  const whereSql = whereParts.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`
    : Prisma.sql``;

  // Step 1: Get ventaIds that still have pending balance using raw SQL
  // (LEFT JOIN with ReconciliacionVenta, HAVING total - totalPagado > 0.1)
  const pendingRows = await prisma.$queryRaw<Array<{ ventaId: string; totalPagado: number }>>(Prisma.sql`
    SELECT v."ventaId",
      COALESCE(SUM(
        CASE
          WHEN rv."moneda" = 'CUP' THEN rv."monto"
          WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0 THEN rv."monto" * rv."tasaCambio"
          ELSE rv."monto"
        END
      ), 0)::double precision AS "totalPagado"
    FROM "Venta" v
    LEFT JOIN "ReconciliacionVenta" rv ON rv."ventaId" = v."ventaId"
    ${whereSql}
    GROUP BY v."ventaId", v."total", v."fechaVenta"
    HAVING (COALESCE(v."total", 0) - COALESCE(SUM(
      CASE
        WHEN rv."moneda" = 'CUP' THEN rv."monto"
        WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0 THEN rv."monto" * rv."tasaCambio"
        ELSE rv."monto"
      END
    ), 0)) > 0.1
    ORDER BY v."fechaVenta" DESC
    OFFSET ${skip} LIMIT ${limit}
  `);

  // Count total pending for pagination
  const totalRows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS total FROM (
      SELECT v."ventaId"
      FROM "Venta" v
      LEFT JOIN "ReconciliacionVenta" rv ON rv."ventaId" = v."ventaId"
      ${whereSql}
      GROUP BY v."ventaId", v."total"
      HAVING (COALESCE(v."total", 0) - COALESCE(SUM(
        CASE
          WHEN rv."moneda" = 'CUP' THEN rv."monto"
          WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0 THEN rv."monto" * rv."tasaCambio"
          ELSE rv."monto"
        END
      ), 0)) > 0.1
    ) AS pendientes
  `);

  const total = Number(totalRows[0]?.total || 0);
  const ventaIds = pendingRows.map(r => r.ventaId);

  if (ventaIds.length === 0) {
    return { ventas: [], pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // Step 2: Fetch full venta records with includes
  const ventasRaw = await prisma.venta.findMany({
    where: { ventaId: { in: ventaIds } },
    include: {
      cliente: { select: { nombre: true } },
      puntoDeVenta: { select: { nombre: true } },
      moneda: true,
    },
  });

  // Step 3: Merge pending balance into each venta
  const pagosMap = new Map(pendingRows.map(r => [r.ventaId, Number(r.totalPagado || 0)]));
  const ventasMap = new Map(ventasRaw.map(v => [v.ventaId, v]));

  const ventas = ventaIds
    .map(ventaId => {
      const venta = ventasMap.get(ventaId);
      if (!venta) return null;
      const totalVenta = Number(venta.total || 0);
      const totalPagado = pagosMap.get(ventaId) || 0;
      return {
        ...venta,
        total: totalVenta,
        totalPagado,
        saldoPendiente: Math.max(0, totalVenta - totalPagado),
      };
    })
    .filter(Boolean);

  return { ventas, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
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
    reconciliaciones: reconciliaciones.map(r => ({
      ...r,
      monto: Number(r.monto),
      tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null,
      montoConvertido: r.montoConvertido ? Number(r.montoConvertido) : null,
      venta: r.venta ? { ...r.venta, total: Number(r.venta.total) } : undefined,
    })),
    estadisticas: {
      montoTotal: reconciliaciones.reduce((s:number, r:any) => s+Number(r.monto), 0),
      montoConvertidoTotal: reconciliaciones.reduce((s:number, r:any) => s+Number(r.montoConvertido??0), 0),
      porMoneda, porTipoDePago,
    },
    pagination: {},
  };
});

export const reconciliarVentaAction = withAction(withPeriodValidation(
  (input) => input.fechaReconciliacion ? new Date(input.fechaReconciliacion) : new Date(),
  async (input: {
    ventaId: string; cuentaId: string; tipoPagoId: string; monto: number; moneda?: string;
    fechaReconciliacion?: string; observaciones?: string;
  }, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);

    const result = await prisma.$transaction(async (tx) => {
      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          ventaId: input.ventaId, cuentaId: input.cuentaId, tipoPagoId: input.tipoPagoId,
          monto: input.monto, moneda: input.moneda||'CUP',
          fechaReconciliacion: input.fechaReconciliacion ? new Date(input.fechaReconciliacion) : new Date(),
          observaciones: input.observaciones, tenantId, reconciliadoPor: user.userId,
        },
      });

      // Actualizar estado de CuentaPorCobrar asociada
      // Resolver Venta → Factura para buscar CxC por facturaId correcto
      const ventaWithFactura = await tx.venta.findUnique({
        where: { ventaId: input.ventaId },
        select: { factura: { select: { idFactura: true } } },
      });
      const facturaIdReal = ventaWithFactura?.factura?.idFactura;
      const cuentaPorCobrar = await tx.cuentaPorCobrar.findFirst({
        where: {
          OR: [
            { facturaId: input.ventaId },    // legacy: algunas CxC tienen ventaId en facturaId
            ...(facturaIdReal ? [{ facturaId: facturaIdReal }] : []), // correcto: Factura.idFactura
          ],
          tenantId,
        },
        select: { idCC: true, montoDeuda: true, montoPagado: true, estado: true },
      });

      if (cuentaPorCobrar) {
        // Sumar todas las reconciliaciones de esta venta para calcular el total pagado
        const reconciliaciones = await tx.reconciliacionVenta.findMany({
          where: { ventaId: input.ventaId, tenantId },
          select: { monto: true, moneda: true, tasaCambio: true },
        });

        const totalPagado = reconciliaciones.reduce((sum, rec) => {
          const tasa = rec.tasaCambio ? Number(rec.tasaCambio) : 1;
          return sum + Number(rec.monto) * tasa;
        }, 0);

        const montoDeuda = Number(cuentaPorCobrar.montoDeuda);
        const nuevoEstado = totalPagado >= montoDeuda - 0.01
          ? 'PAGADA'
          : totalPagado > 0
            ? 'PARCIAL'
            : 'PENDIENTE';

        if (nuevoEstado !== cuentaPorCobrar.estado) {
          await tx.cuentaPorCobrar.updateMany({
            where: { idCC: cuentaPorCobrar.idCC },
            data: {
              estado: nuevoEstado,
              montoPagado: totalPagado,
            },
          });
        }
      }

      return reconciliacion;
    });

    revalidatePath('/busy/contabilidad/reconciliacion');
    revalidatePath('/busy/contabilidad/cuentas-por-cobrar');
    return result;
  }
));

// ─── Servicios ─────────────────────────────────────────────

export const getServiciosPendientesAction = withAction(async (params: {
  fechaDesde?: string; fechaHasta?: string; page?: number; limit?: number;
} = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const where: any = { tenantId };
  if (params.fechaDesde || params.fechaHasta) {
    where.createdAt = {};
    if (params.fechaDesde) where.createdAt.gte = new Date(params.fechaDesde);
    if (params.fechaHasta) where.createdAt.lte = new Date(params.fechaHasta);
  }
  const page = params.page || 1; const limit = params.limit || 50;
  const [ventaServicios, total] = await Promise.all([
    prisma.ventaServicios.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (page-1)*limit, take: limit,
      include: { cliente: { select: { nombre: true } }, servicio: { select: { nombre: true, descripcion: true, precio: true, moneda: true } } },
    }),
    prisma.ventaServicios.count({
    where
    }),
  ]);
  return {
    ventaServicios: ventaServicios.map(vs => ({
      ...vs,
      servicio: vs.servicio ? { ...vs.servicio, precio: Number(vs.servicio.precio) } : undefined,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total/limit) },
  };
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
  return {
    reconciliaciones: reconciliaciones.map(r => ({
      ...r,
      monto: Number(r.monto),
      tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null,
      montoConvertido: r.montoConvertido ? Number(r.montoConvertido) : null,
    })),
    estadisticas: {},
    pagination: {},
  };
});

export const reconciliarServicioAction = withAction(withPeriodValidation(
  (input) => input.fechaReconciliacion ? new Date(input.fechaReconciliacion) : new Date(),
  async (input: {
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
  }
));

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

  // ── Query PagoSalario (salarios de empleados) ──
  const wherePS: any = { tenantId };
  if (params.soloNoReconciliados) wherePS.ReconciliacionGasto = { none: {} };
  if (params.fechaDesde || params.fechaHasta) {
    wherePS.createdAt = {};
    if (params.fechaDesde) wherePS.createdAt.gte = new Date(params.fechaDesde);
    if (params.fechaHasta) wherePS.createdAt.lte = new Date(params.fechaHasta);
  }

  // ── Query CompraServicio (servicios recibidos de proveedores) ──
  const whereCS: any = { tenantId };
  if (params.fechaDesde || params.fechaHasta) {
    whereCS.fechaServicio = {};
    if (params.fechaDesde) whereCS.fechaServicio.gte = new Date(params.fechaDesde);
    if (params.fechaHasta) whereCS.fechaServicio.lte = new Date(params.fechaHasta);
  }

  // ── Query VentaServicios (costo de servicios vendidos) ──
  const whereVS: any = { tenantId, costo: { gt: 0 } };
  if (params.fechaDesde || params.fechaHasta) {
    whereVS.createdAt = {};
    if (params.fechaDesde) whereVS.createdAt.gte = new Date(params.fechaDesde);
    if (params.fechaHasta) whereVS.createdAt.lte = new Date(params.fechaHasta);
  }

  const page = params.page || 1; const limit = params.limit || 50;

  // Traer todos los tipos y unificarlos
  const [gastosDE, gastosCompra, pagosSalario, comprasServicio, ventasServicio, reconciliadosServicioIds, reconciliadosVentaServicioIds] = await Promise.all([
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
    prisma.pagosalario.findMany({
      where: wherePS, orderBy: { createdAt: 'desc' },
      include: {
        ReconciliacionGasto: { select: { reconciliacionId: true } },
        empleado: { select: { nombre: true, apellido: true, cargo: true } },
      },
    }),
    prisma.compraServicio.findMany({
      where: whereCS, orderBy: { fechaServicio: 'desc' },
      include: {
        servicio: { select: { nombre: true } },
        proveedor: { select: { nombre: true } },
      },
    }),
    prisma.ventaServicios.findMany({
      where: whereVS, orderBy: { createdAt: 'desc' },
      include: {
        servicio: { select: { nombre: true } },
        cliente: { select: { nombre: true } },
      },
    }),
    params.soloNoReconciliados
      ? prisma.reconciliacionGasto.findMany({
          where: { tenantId, tipoGasto: 'servicio' },
          select: { referenciaId: true },
          distinct: ['referenciaId'],
        }).then(r => r.map(x => x.referenciaId))
      : Promise.resolve([] as string[]),
    params.soloNoReconciliados
      ? prisma.reconciliacionGasto.findMany({
          where: { tenantId, tipoGasto: 'venta_servicio' },
          select: { referenciaId: true },
          distinct: ['referenciaId'],
        }).then(r => r.map(x => x.referenciaId))
      : Promise.resolve([] as string[]),
  ]);

  // Filtrar servicios ya reconciliados si se solicitó
  const comprasServicioFiltradas = params.soloNoReconciliados
    ? comprasServicio.filter((g: any) => !reconciliadosServicioIds.includes(g.compraServicioId))
    : comprasServicio;

  const ventasServicioFiltradas = params.soloNoReconciliados
    ? ventasServicio.filter((g: any) => !reconciliadosVentaServicioIds.includes(g.ventaServicioId))
    : ventasServicio;

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
    ...pagosSalario.map((g: any) => ({
      tipo: 'salario' as const,
      referenciaId: g.pgId,
      descripcion: `Salario de ${g.empleado?.nombre || ''} ${g.empleado?.apellido || ''}`.trim() || `Pago #${g.pgId.slice(0, 8)}`,
      monto: Number(g.salario || 0),
      periodo: g.periodo || undefined,
      detalles: {
        empleado: g.empleado ? {
          nombre: g.empleado.nombre,
          apellido: g.empleado.apellido,
          cargo: g.empleado.cargo,
        } : undefined,
        salarioBases: g.salario || undefined,
        bonificaciones: g.bonificaciones || undefined,
        deducciones: g.deducciones || undefined,
        horasExtras: g.horasExtras || undefined,
      },
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    })),
    ...comprasServicioFiltradas.map((g: any) => ({
      tipo: 'servicio' as const,
      referenciaId: g.compraServicioId,
      descripcion: `${g.servicio?.nombre || 'Servicio'} - ${g.proveedor?.nombre || 'Sin proveedor'}`,
      monto: Number(g.total || 0),
      periodo: undefined,
      detalles: {
        servicio: g.servicio?.nombre || undefined,
        proveedorNombre: g.proveedor?.nombre || undefined,
        cantidad: g.cantidad || undefined,
        costoUnitario: g.costoUnitario || undefined,
        numeroFactura: g.numeroFactura || undefined,
      },
      createdAt: g.fechaServicio?.toISOString?.() || g.createdAt?.toISOString?.() || new Date().toISOString(),
      updatedAt: g.updatedAt?.toISOString?.() || new Date().toISOString(),
    })),
    ...ventasServicioFiltradas.map((g: any) => ({
      tipo: 'venta_servicio' as const,
      referenciaId: g.ventaServicioId,
      descripcion: `Costo: ${g.servicio?.nombre || 'Servicio'} - ${g.cliente?.nombre || 'Sin cliente'}`,
      monto: Number(g.costo * g.cantidad || 0),
      periodo: g.createdAt?.toISOString?.()?.slice(0, 7) || undefined,
      detalles: {
        servicio: g.servicio?.nombre || undefined,
        clienteNombre: g.cliente?.nombre || undefined,
        cantidad: g.cantidad || undefined,
        costoUnitario: g.costo || undefined,
      },
      createdAt: g.createdAt?.toISOString?.() || new Date().toISOString(),
      updatedAt: g.updatedAt?.toISOString?.() || new Date().toISOString(),
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
  return {
    reconciliaciones: reconciliaciones.map(r => ({
      ...r,
      monto: Number(r.monto),
      tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null,
      montoConvertido: r.montoConvertido ? Number(r.montoConvertido) : null,
    })),
    estadisticas: {},
    pagination: {},
  };
});

export const reconciliarGastoAction = withAction(withPeriodValidation(
  (input) => input.fechaReconciliacion ? new Date(input.fechaReconciliacion) : new Date(),
  async (input: {
    gastoCompraId?: string; pgId?: string; compraServicioId?: string; ventaServicioId?: string;
    cuentaId: string; tipoPagoId: string; monto: number; moneda?: string;
    fechaReconciliacion?: string; descripcion?: string; cuentaPorPagarId?: string;
  }, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);
    const fechaPago = input.fechaReconciliacion ? new Date(input.fechaReconciliacion) : new Date();

    const esSalario = !!input.pgId;
    const esServicio = !!input.compraServicioId;
    const esVentaServicio = !!input.ventaServicioId;
    const referenciaId = input.pgId || input.gastoCompraId || input.compraServicioId || input.ventaServicioId;
    if (!referenciaId) throw new Error('Se requiere gastoCompraId, pgId, compraServicioId o ventaServicioId');

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Crear la reconciliación
      const reconciliacionData: any = {
        tipoGasto: esVentaServicio ? 'venta_servicio' : esServicio ? 'servicio' : esSalario ? 'salario' : 'compra',
        referenciaId,
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
      };

      if (esSalario) {
        reconciliacionData.pgId = input.pgId;
      } else if (esServicio) {
        reconciliacionData.referenciaId = input.compraServicioId;
      } else {
        reconciliacionData.gastoCompraId = input.gastoCompraId;
      }

      const reconciliacion = await tx.reconciliacionGasto.create({ data: reconciliacionData });

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
              tenantId,
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
  }
));
