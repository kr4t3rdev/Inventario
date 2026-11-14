/**
 * @description Server Actions para consultas de analytics de clientes.
 *
 * Proporciona acceso a datos de RFM, CLV, churn, basket analysis
 * y cohortes. Todas las queries usan withAction para auth.
 *
 * @module features/cliente-analytics/actions
 */
'use server';

import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { ejecutarJobAnalyticsNocturno } from './jobs/analytics-nightly-job';

/**
 * @description Obtiene los analytics de un cliente específico.
 * @param {string} clienteId - ID del cliente.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object | null>} Datos analytics del cliente.
 */
export const getClienteAnalyticsAction = withAction(
  async (clienteId: string, user: AuthenticatedUser) => {
    requireFeature(user, 'cliente-analytics', 'consultar analytics de cliente');
    const tenantId = requireTenant(user);
    return prisma.clienteAnalytics.findFirst({
      where: { tenantId, clienteId },
    });
  },
);

/**
 * @description Obtiene la distribución de clientes por segmento RFM.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Distribución por segmento.
 */
export const getSegmentoDistribucionAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requireFeature(user, 'cliente-analytics', 'consultar distribución RFM');
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
 * @description Obtiene los top N clientes por CLV.
 * @param {object} input - Parámetros de consulta.
 * @param {number} [input.topN=10] - Cantidad de clientes.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Top clientes con CLV.
 */
export const getTopClientesCLVAction = withAction(
  async (input: { topN?: number } = {}, user: AuthenticatedUser) => {
    requireFeature(user, 'cliente-analytics', 'consultar top clientes CLV');
    const tenantId = requireTenant(user);
    const topN = input.topN ?? 10;
    return prisma.clienteAnalytics.findMany({
      where: { tenantId, clv: { not: null } },
      orderBy: { clv: 'desc' },
      take: topN,
      include: {
        cliente: {
          select: {
            nombre: true,
            email: true,
            telefono: true,
          },
        },
      },
    });
  },
);

/**
 * @description Obtiene los clientes en riesgo de churn.
 * @param {object} input - Filtros.
 * @param {string} [input.riesgo] - Nivel de riesgo mínimo.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Clientes en riesgo.
 */
export const getClientesChurnRiskAction = withAction(
  async (input: { riesgo?: string } = {}, user: AuthenticatedUser) => {
    requireFeature(user, 'cliente-churn', 'consultar clientes en riesgo de churn');
    const tenantId = requireTenant(user);
    const analytics = await prisma.clienteAnalytics.findMany({
      where: {
        tenantId,
        probabilidadChurn: {
          gte: input.riesgo === 'critico' ? 0.8 : input.riesgo === 'alto' ? 0.5 : 0.25,
        },
      },
      orderBy: { probabilidadChurn: 'desc' },
      take: 100,
      include: {
        cliente: {
          select: {
            nombre: true,
            email: true,
            telefono: true,
          },
        },
      },
    });
    return analytics;
  },
);

/**
 * @description Obtiene los pares de productos más frecuentes (basket analysis).
 * @param {object} input - Filtros.
 * @param {number} [input.topN=20] - Cantidad de pares.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Pares de productos.
 */
export const getBasketAnalysisAction = withAction(
  async (input: { topN?: number } = {}, user: AuthenticatedUser) => {
    requireFeature(user, 'cliente-basket', 'consultar basket analysis');
    const tenantId = requireTenant(user);
    const topN = input.topN ?? 20;
    return prisma.basketAnalysis.findMany({
      where: { tenantId },
      orderBy: { levantamiento: 'desc' },
      take: topN,
    });
  },
);

/**
 * @description Obtiene las cohortes de clientes.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Datos de cohortes.
 */
export const getCohortesAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requireFeature(user, 'cliente-analytics', 'consultar cohortes');
    const tenantId = requireTenant(user);
    return prisma.cohorteAnalytics.findMany({
      where: { tenantId },
      orderBy: { periodo: 'desc' },
    });
  },
);

/**
 * @description Ejecuta manualmente el job nocturno de analytics.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Resumen del job ejecutado.
 */
export const ejecutarJobAnalyticsAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requireFeature(user, 'cliente-analytics', 'ejecutar job de analytics');
    const tenantId = requireTenant(user);
    return ejecutarJobAnalyticsNocturno({ tenantId });
  },
);

/**
 * @description Obtiene KPIs generales de fidelización.
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

    return {
      repeatPurchaseRate: Math.round(repeatPurchaseRate * 10000) / 10000,
      churnRate: Math.round(churnRate * 10000) / 10000,
      redemptionRate: Math.round(redemptionRate * 10000) / 10000,
      breakage,
      clvPromedio: clvAvg._avg.clv ?? null,
      totalClientes,
      clientesConLealtad: await prisma.clienteLealtad.count({ where: { tenantId } }),
    };
  },
);
