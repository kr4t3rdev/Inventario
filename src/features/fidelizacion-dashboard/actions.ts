/**
 * @description Server Actions para el dashboard de KPIs de fidelización.
 *
 * Proporciona consultas de métricas clave: CLV, AOV, churn rate,
 * redemption rate, breakage, repeat purchase rate.
 *
 * @module features/fidelizacion-dashboard/actions
 */
'use server';

import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

/**
 * @description Obtiene los KPIs principales de fidelización.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} KPIs de fidelización.
 */
export const getFidelizacionKPIsAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requireFeature(user, 'fidelizacion-dashboard', 'consultar KPIs de fidelización');
    const tenantId = requireTenant(user);

    // Repeat Purchase Rate
    const clientesConMultiplesCompras = await prisma.cliente.count({
      where: { tenantId, cantidadCompras: { gte: 2 } },
    });
    const totalClientes = await prisma.cliente.count({
      where: { tenantId, cantidadCompras: { gte: 1 } },
    });
    const repeatPurchaseRate = totalClientes > 0 ? clientesConMultiplesCompras / totalClientes : 0;

    // Churn Rate
    const clientesInactivos = await prisma.clienteAnalytics.count({
      where: { tenantId, diasDesdeUltima: { gte: 90 } },
    });
    const clientesConAnalytics = await prisma.clienteAnalytics.count({
      where: { tenantId, totalCompras: { gte: 1 } },
    });
    const churnRate = clientesConAnalytics > 0 ? clientesInactivos / clientesConAnalytics : 0;

    // Redemption Rate
    const puntosGanados = await prisma.clienteLealtad.aggregate({
      where: { tenantId },
      _sum: { puntosGanados: true },
    });
    const puntosCanjeados = await prisma.clienteLealtad.aggregate({
      where: { tenantId },
      _sum: { puntosCanjeados: true },
    });
    const redemptionRate = (puntosGanados._sum.puntosGanados || 0) > 0
      ? (puntosCanjeados._sum.puntosCanjeados || 0) / (puntosGanados._sum.puntosGanados || 0)
      : 0;

    // Breakage
    const breakage = (puntosGanados._sum.puntosGanados || 0) - (puntosCanjeados._sum.puntosCanjeados || 0);

    // CLV promedio
    const clvAvg = await prisma.clienteAnalytics.aggregate({
      where: { tenantId, clv: { not: null } },
      _avg: { clv: true },
    });

    // AOV promedio
    const aovAvg = await prisma.clienteAnalytics.aggregate({
      where: { tenantId, ticketPromedio: { not: null } },
      _avg: { ticketPromedio: true },
    });

    return {
      repeatPurchaseRate: Math.round(repeatPurchaseRate * 10000) / 10000,
      churnRate: Math.round(churnRate * 10000) / 10000,
      redemptionRate: Math.round(redemptionRate * 10000) / 10000,
      breakage,
      clvPromedio: clvAvg._avg.clv ?? null,
      aovPromedio: aovAvg._avg.ticketPromedio ?? null,
      totalClientes,
      clientesConLealtad: await prisma.clienteLealtad.count({ where: { tenantId } }),
    };
  },
);

/**
 * @description Obtiene la distribución de clientes por segmento RFM.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Distribución por segmento.
 */
export const getRFMDistribucionAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requireFeature(user, 'fidelizacion-dashboard', 'consultar distribución RFM');
    const tenantId = requireTenant(user);
    const resultados = await prisma.$queryRaw<Array<{ segmento: string; count: number }>>`
      SELECT segmento_rfm as segmento, COUNT(*)::int as count
      FROM cliente_analytics
      WHERE tenant_id = ${tenantId} AND segmento_rfm IS NOT NULL
      GROUP BY segmento_rfm
      ORDER BY count DESC
    `;
    return resultados;
  },
);

/**
 * @description Obtiene la distribución de clientes por tier de lealtad.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Distribución por tier.
 */
export const getTierDistribucionAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requireFeature(user, 'fidelizacion-dashboard', 'consultar distribución de tiers');
    const tenantId = requireTenant(user);
    const resultados = await prisma.$queryRaw<Array<{ tier: string; count: number }>>`
      SELECT tier_actual as tier, COUNT(*)::int as count
      FROM cliente_lealtad
      WHERE tenant_id = ${tenantId} AND tier_actual IS NOT NULL
      GROUP BY tier_actual
      ORDER BY count DESC
    `;
    return resultados;
  },
);

/**
 * @description Obtiene la tendencia de churn de los últimos 6 meses.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Tendencia de churn.
 */
export const getChurnTrendAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requireFeature(user, 'fidelizacion-dashboard', 'consultar tendencia de churn');
    const tenantId = requireTenant(user);
    const resultados = await prisma.$queryRaw<Array<{ mes: string; churnRate: number }>>`
      SELECT
        TO_CHAR(updated_at, 'YYYY-MM') as mes,
        AVG(probabilidad_churn)::float as "churnRate"
      FROM cliente_analytics
      WHERE tenant_id = ${tenantId}
        AND probabilidad_churn IS NOT NULL
        AND updated_at >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(updated_at, 'YYYY-MM')
      ORDER BY mes DESC
    `;
    return resultados;
  },
);

/**
 * @description Obtiene la distribución de CLV de los clientes.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Estadísticas de CLV.
 */
export const getCLVDistribucionAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requireFeature(user, 'fidelizacion-dashboard', 'consultar distribución de CLV');
    const tenantId = requireTenant(user);
    const stats = await prisma.clienteAnalytics.aggregate({
      where: { tenantId, clv: { not: null } },
      _avg: { clv: true },
      _min: { clv: true },
      _max: { clv: true },
      _count: { clv: true },
    });
    return {
      promedio: stats._avg.clv ?? null,
      minimo: stats._min.clv ?? null,
      maximo: stats._max.clv ?? null,
      totalClientes: stats._count.clv ?? 0,
    };
  },
);

/**
 * @description Obtiene la tasa de redención de puntos por mes.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Tasa de redención mensual.
 */
export const getRedemptionTrendAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requireFeature(user, 'fidelizacion-dashboard', 'consultar tasa de redención');
    const tenantId = requireTenant(user);
    const resultados = await prisma.$queryRaw<Array<{ mes: string; canjeados: number; ganados: number }>>`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') as mes,
        COALESCE(SUM(CASE WHEN puntos < 0 THEN ABS(puntos) ELSE 0 END))::int as canjeados,
        COALESCE(SUM(CASE WHEN puntos > 0 THEN puntos ELSE 0 END))::int as ganados
      FROM historial_puntos
      WHERE tenant_id = ${tenantId}
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY mes DESC
    `;
    return resultados;
  },
);
