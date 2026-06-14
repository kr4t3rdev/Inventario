import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { requireTenant } from '@/lib/services/tenant-scope';
import { Prisma } from '@/generated/prisma';

function normalizeMontoToCup(monto: number, moneda: string, tasaCambio?: number): number {
  if (moneda === 'CUP') return monto;
  if (typeof tasaCambio === 'number' && Number.isFinite(tasaCambio) && tasaCambio > 0) {
    return monto * tasaCambio;
  }
  return monto;
}

/**
 * @description Shared service for accounting reconciliation flows used by web and mobile adapters.
 */
export const AccountingReconciliationService = {
  async listPendingSales(params: {
    tenantId: string;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    puntoDeVentaId?: string | null;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const whereParts: Prisma.Sql[] = [Prisma.sql`v."tenantId" = ${params.tenantId}`];
    if (params.fechaInicio) {
      whereParts.push(Prisma.sql`v."createdAt" >= ${new Date(params.fechaInicio)}`);
    }
    if (params.fechaFin) {
      const fechaFinDate = new Date(params.fechaFin);
      fechaFinDate.setUTCHours(23, 59, 59, 999);
      whereParts.push(Prisma.sql`v."createdAt" <= ${fechaFinDate}`);
    }
    if (params.puntoDeVentaId) {
      whereParts.push(Prisma.sql`v."puntoDeVentaId" = ${params.puntoDeVentaId}`);
    }

    const whereSql =
      whereParts.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`
        : Prisma.sql``;

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
      GROUP BY v."ventaId", v."total", v."createdAt"
      HAVING (COALESCE(v."total", 0) - COALESCE(SUM(
        CASE
          WHEN rv."moneda" = 'CUP' THEN rv."monto"
          WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0 THEN rv."monto" * rv."tasaCambio"
          ELSE rv."monto"
        END
      ), 0)) > 0.1
      ORDER BY v."createdAt" DESC
      OFFSET ${skip} LIMIT ${limit}
    `);

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
    const ventaIds = pendingRows.map((r) => r.ventaId);

    if (ventaIds.length === 0) {
      return {
        ventas: [],
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    }

    const ventasRaw = await prisma.venta.findMany({
      where: { ventaId: { in: ventaIds } },
      include: {
        cliente: { select: { nombre: true } },
        puntoDeVenta: { select: { nombre: true } },
      },
    });

    const pagosMap = new Map(
      pendingRows.map((r) => [r.ventaId, Number(r.totalPagado || 0)]),
    );
    const ventasMap = new Map(ventasRaw.map((v) => [v.ventaId, v]));

    const ventas = ventaIds
      .map((ventaId) => {
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

    return {
      ventas,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getSalesHistory(params: {
    tenantId: string;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    cuentaId?: string | null;
  }) {
    const where: Record<string, unknown> = { tenantId: params.tenantId };
    if (params.cuentaId) where.cuentaId = params.cuentaId;
    if (params.fechaInicio || params.fechaFin) {
      const fechaReconciliacion: Record<string, Date> = {};
      if (params.fechaInicio) fechaReconciliacion.gte = new Date(params.fechaInicio);
      if (params.fechaFin) fechaReconciliacion.lte = new Date(params.fechaFin);
      where.fechaReconciliacion = fechaReconciliacion;
    }

    const reconciliaciones = await prisma.reconciliacionVenta.findMany({
      where,
      orderBy: { fechaReconciliacion: 'desc' },
      take: 100,
      include: {
        venta: { select: { ventaId: true, total: true } },
        cuentaBancaria: { select: { nombreBanco: true } },
        tipoPago: { select: { nombre: true } },
      },
    });

    const porMoneda = await prisma.reconciliacionVenta.groupBy({
      by: ['moneda'],
      where,
      _sum: { monto: true },
    });
    const porTipoDePago = await prisma.reconciliacionVenta.groupBy({
      by: ['tipoPagoId'],
      where,
      _sum: { monto: true },
    });

    return {
      reconciliaciones: reconciliaciones.map((r) => ({
        ...r,
        monto: Number(r.monto),
        tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null,
        montoConvertido: r.montoConvertido ? Number(r.montoConvertido) : null,
        venta: r.venta ? { ...r.venta, total: Number(r.venta.total) } : undefined,
      })),
      estadisticas: {
        montoTotal: reconciliaciones.reduce((s, r) => s + Number(r.monto), 0),
        montoConvertidoTotal: reconciliaciones.reduce(
          (s, r) => s + Number(r.montoConvertido ?? 0),
          0,
        ),
        porMoneda,
        porTipoDePago,
      },
      pagination: {},
    };
  },

  async reconcileSale({
    input,
    user,
  }: {
    input: {
      ventaId: string;
      cuentaId: string;
      tipoPagoId: string;
      monto: number;
      moneda?: string;
      fechaReconciliacion?: string;
      observaciones?: string;
    };
    user: AuthenticatedUser;
  }) {
    const tenantId = requireTenant(user);

    return prisma.$transaction(async (tx) => {
      await tx.cuentaBancaria.update({
        where: { cuentaId: input.cuentaId },
        data: { saldo: { increment: input.monto } },
      });

      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          ventaId: input.ventaId,
          cuentaId: input.cuentaId,
          tipoPagoId: input.tipoPagoId,
          monto: input.monto,
          moneda: input.moneda || 'CUP',
          fechaReconciliacion: input.fechaReconciliacion
            ? new Date(input.fechaReconciliacion)
            : new Date(),
          observaciones: input.observaciones,
          tenantId,
          reconciliadoPor: user.userId,
        },
      });

      const ventaWithFactura = await tx.venta.findUnique({
        where: { ventaId: input.ventaId },
        select: { factura: { select: { idFactura: true } } },
      });
      const facturaIdReal = ventaWithFactura?.factura?.idFactura;
      const cuentaPorCobrar = await tx.cuentaPorCobrar.findFirst({
        where: {
          OR: [
            { facturaId: input.ventaId },
            ...(facturaIdReal ? [{ facturaId: facturaIdReal }] : []),
          ],
          tenantId,
        },
        select: { idCC: true, montoDeuda: true, montoPagado: true, estado: true },
      });

      if (cuentaPorCobrar) {
        const reconciliaciones = await tx.reconciliacionVenta.findMany({
          where: { ventaId: input.ventaId, tenantId },
          select: { monto: true, moneda: true, tasaCambio: true },
        });

        const totalPagado = reconciliaciones.reduce((sum, rec) => {
          const tasa = rec.tasaCambio ? Number(rec.tasaCambio) : 1;
          return sum + Number(rec.monto) * tasa;
        }, 0);

        const montoDeuda = Number(cuentaPorCobrar.montoDeuda);
        const nuevoEstado =
          totalPagado >= montoDeuda - 0.01
            ? 'PAGADA'
            : totalPagado > 0
              ? 'PARCIAL'
              : 'PENDIENTE';

        if (nuevoEstado !== cuentaPorCobrar.estado) {
          await tx.cuentaPorCobrar.updateMany({
            where: { idCC: cuentaPorCobrar.idCC },
            data: { estado: nuevoEstado, montoPagado: totalPagado },
          });
        }
      }

      return reconciliacion;
    });
  },

  async listPendingServices(params: {
    tenantId: string;
    fechaDesde?: string | null;
    fechaHasta?: string | null;
    page?: number;
    limit?: number;
  }) {
    const where: Record<string, unknown> = {
      tenantId: params.tenantId,
      reconciliado: null,
    };
    if (params.fechaDesde || params.fechaHasta) {
      const createdAt: Record<string, Date> = {};
      if (params.fechaDesde) createdAt.gte = new Date(params.fechaDesde);
      if (params.fechaHasta) createdAt.lte = new Date(params.fechaHasta);
      where.createdAt = createdAt;
    }
    const page = params.page || 1;
    const limit = params.limit || 50;

    const [ventaServicios, total] = await Promise.all([
      prisma.ventaServicios.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          cliente: { select: { nombre: true } },
          servicio: {
            select: { nombre: true, descripcion: true, precio: true, moneda: true },
          },
        },
      }),
      prisma.ventaServicios.count({ where }),
    ]);

    return {
      ventaServicios: ventaServicios.map((vs) => ({
        ...vs,
        servicio: vs.servicio ? { ...vs.servicio, precio: Number(vs.servicio.precio) } : undefined,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getServicesHistory(params: {
    tenantId: string;
    fechaDesde?: string | null;
    fechaHasta?: string | null;
    cuentaId?: string | null;
  }) {
    const where: Record<string, unknown> = { tenantId: params.tenantId };
    if (params.cuentaId) where.cuentaId = params.cuentaId;
    if (params.fechaDesde || params.fechaHasta) {
      const fechaReconciliacion: Record<string, Date> = {};
      if (params.fechaDesde) fechaReconciliacion.gte = new Date(params.fechaDesde);
      if (params.fechaHasta) fechaReconciliacion.lte = new Date(params.fechaHasta);
      where.fechaReconciliacion = fechaReconciliacion;
    }

    const reconciliaciones = await prisma.reconciliacionServicio.findMany({
      where,
      orderBy: { fechaReconciliacion: 'desc' },
      take: 100,
      include: {
        ventasServicio: { select: { ventaServicioId: true } },
        cuentaBancaria: { select: { nombreBanco: true } },
        tipoPago: { select: { nombre: true } },
      },
    });

    return {
      reconciliaciones: reconciliaciones.map((r) => ({
        ...r,
        monto: Number(r.monto),
        tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null,
        montoConvertido: r.montoConvertido ? Number(r.montoConvertido) : null,
      })),
      estadisticas: {},
      pagination: {},
    };
  },

  async reconcileService({
    input,
    user,
  }: {
    input: {
      ventaServicioId: string;
      distribuciones: Array<{
        cuentaId: string;
        tipoPagoId: string;
        monto: number;
        moneda?: string;
        observaciones?: string;
      }>;
      fechaReconciliacion?: string;
    };
    user: AuthenticatedUser;
  }) {
    const tenantId = requireTenant(user);

    if (!input.distribuciones?.length) {
      throw new ActionError('Debe incluir al menos una distribución', 'INVALID_INPUT');
    }

    return prisma.$transaction(async (tx) => {
      const servicio = await tx.ventaServicios.findUnique({
        where: { ventaServicioId: input.ventaServicioId },
        select: { total: true },
      });
      if (!servicio) {
        throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
      }

      const montoTotalDistribuido = input.distribuciones.reduce((sum, d) => sum + d.monto, 0);
      const precioServicio = Number(servicio.total);

      if (Math.abs(montoTotalDistribuido - precioServicio) > 0.01) {
        throw new ActionError(
          `El monto total distribuido (${montoTotalDistribuido.toFixed(2)}) debe ser igual al precio del servicio (${precioServicio.toFixed(2)})`,
          'VALIDATION_ERROR',
        );
      }

      for (const dist of input.distribuciones) {
        await tx.cuentaBancaria.update({
          where: { cuentaId: dist.cuentaId },
          data: { saldo: { increment: dist.monto } },
        });

        await tx.reconciliacionServicio.create({
          data: {
            ventaServicioId: input.ventaServicioId,
            cuentaId: dist.cuentaId,
            tipoPagoId: dist.tipoPagoId,
            monto: dist.monto,
            moneda: dist.moneda || 'CUP',
            fechaReconciliacion: input.fechaReconciliacion
              ? new Date(input.fechaReconciliacion)
              : new Date(),
            observaciones: dist.observaciones,
            tenantId,
            reconciliadoPor: user.userId,
          },
        });
      }

      await tx.ventaServicios.update({
        where: { ventaServicioId: input.ventaServicioId },
        data: { reconciliado: true },
      });

      return { reconciliado: true, distribuciones: input.distribuciones.length };
    });
  },
};
