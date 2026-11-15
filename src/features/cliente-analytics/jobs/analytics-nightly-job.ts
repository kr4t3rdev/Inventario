/**
 * @description Job nocturno de actualización de analytics.
 *
 * Se ejecuta diariamente (cron) para actualizar RFM, CLV, basket analysis,
 * cohortes y detección de churn sin afectar el rendimiento del checkout.
 *
 * @module features/cliente-analytics/jobs/analytics-nightly-job
 */

import { prisma } from '@/lib/prisma';
import { calcularRFMCompleto, diasDesdeUltimaCompra, cohorteAdquisicion, ticketPromedio, repeatPurchaseRate } from '../services/rfm-calculator';
import { calcularCLV, frecuenciaAnual } from '../services/clv-calculator';
import { predecirChurn } from '../services/churn-predictor';
import { analizarCesta } from '../services/basket-analyzer';
import type { BasketItem } from '../services/basket-analyzer';

/**
 * @description Ejecuta el job nocturno completo de analytics.
 * @param {object} options - Opciones del job.
 * @param {string} [options.tenantId] - Si se proporciona, solo actualiza ese tenant.
 * @returns {Promise<object>} Resumen de lo procesado.
 */
export async function ejecutarJobAnalyticsNocturno(options: { tenantId?: string } = {}): Promise<{
  clientesActualizados: number;
  basketParesActualizados: number;
  errores: string[];
}> {
  const errores: string[] = [];

  try {
    // 1. Actualizar RFM y CLV de todos los clientes activos
    const clientesActualizados = await actualizarRFMClientes(options.tenantId);

    // 2. Ejecutar basket analysis incremental
    const basketParesActualizados = await actualizarBasketAnalysis(options.tenantId);

    // 3. Detectar churn
    await detectarChurnClientes(options.tenantId);

    return { clientesActualizados, basketParesActualizados, errores };
  } catch (error) {
    errores.push(`Error en job nocturno: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { clientesActualizados: 0, basketParesActualizados: 0, errores };
  }
}

/**
 * @description Actualiza los datos RFM y CLV de todos los clientes.
 * @param {string | undefined} tenantId - Tenant específico o todos.
 * @returns {Promise<number>} Cantidad de clientes actualizados.
 */
async function actualizarRFMClientes(tenantId?: string): Promise<number> {
  const where = tenantId ? { tenantId } : {};
  const clientes = await prisma.cliente.findMany({
    where: {
      ...where,
      cantidadCompras: { gte: 1 },
    },
    select: {
      clienteId: true,
      tenantId: true,
      ultimaCompra: true,
      totalComprado: true,
      cantidadCompras: true,
    },
  });

  let count = 0;
  const ahora = new Date();

  for (const cliente of clientes) {
    try {
      const recencia = diasDesdeUltimaCompra(cliente.ultimaCompra, ahora);
      const frecuencia = cliente.cantidadCompras || 0;
      const monetario = cliente.totalComprado || 0;

      const rfm = calcularRFMCompleto({ recencia, frecuencia, monetario });
      const tPromedio = ticketPromedio(monetario, frecuencia);

      // Calcular CLV
      const diasDesdePrimera = cliente.ultimaCompra
        ? Math.max(0, Math.floor((ahora.getTime() - cliente.ultimaCompra.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      const freqAnual = frecuenciaAnual(frecuencia, Math.max(diasDesdePrimera, 1));

      const clvResult = calcularCLV({
        ticketPromedio: tPromedio || 0,
        frecuenciaAnual: freqAnual,
        margenBruto: 0.25, // Default 25%
        vidaEsperadaAnios: 3,
        totalGastado: monetario,
        totalCompras: frecuencia,
        diasDesdePrimeraCompra: Math.max(diasDesdePrimera, 1),
      });

      // Upsert ClienteAnalytics
      await prisma.clienteAnalytics.upsert({
        where: { clienteId: cliente.clienteId },
        create: {
          tenantId: cliente.tenantId,
          clienteId: cliente.clienteId,
          ultimaCompra: cliente.ultimaCompra,
          diasDesdeUltima: recencia,
          totalCompras: frecuencia,
          totalGastado: monetario,
          ticketPromedio: tPromedio,
          segmentoRfm: rfm.segmento,
          scoreLealtad: rfm.scoreLealtad,
          clv: clvResult.clvHistorico / 100, // Convertir a pesos
          clvProyectado: clvResult.clvProyectado / 100,
          repeatPurchaseRate: repeatPurchaseRate(frecuencia),
        },
        update: {
          ultimaCompra: cliente.ultimaCompra,
          diasDesdeUltima: recencia,
          totalCompras: frecuencia,
          totalGastado: monetario,
          ticketPromedio: tPromedio,
          segmentoRfm: rfm.segmento,
          scoreLealtad: rfm.scoreLealtad,
          clv: clvResult.clvHistorico / 100,
          clvProyectado: clvResult.clvProyectado / 100,
          repeatPurchaseRate: repeatPurchaseRate(frecuencia),
        },
      });

      count++;
    } catch (err) {
      errores.push(`Error actualizando RFM para cliente ${cliente.clienteId}: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  return count;
}

// Shared errores array for nested functions
const errores: string[] = [];

/**
 * @description Actualiza el basket analysis con datos recientes.
 * @param {string | undefined} tenantId - Tenant específico o todos.
 * @returns {Promise<number>} Cantidad de pares actualizados.
 */
async function actualizarBasketAnalysis(tenantId?: string): Promise<number> {
  // Obtener items de ventas de los últimos 90 días
  const fechaCorte = new Date();
  fechaCorte.setDate(fechaCorte.getDate() - 90);

  const ventas = await prisma.venta.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      createdAt: { gte: fechaCorte },
      estado: 'COMPLETADA' as any,
    },
    include: {
      items: true,
    },
  });

  const items: BasketItem[] = [];
  for (const venta of ventas) {
    for (const item of venta.items) {
      items.push({
        ventaId: venta.ventaId,
        productoId: item.productoId,
      });
    }
  }

  const resultado = analizarCesta(items, 0.01, 0.1);

  // Upsert pares en BasketAnalysis
  let count = 0;
  for (const par of resultado.pares) {
    try {
      await prisma.basketAnalysis.upsert({
        where: {
          tenantId_productoA_productoB: {
            tenantId: tenantId || '',
            productoA: par.productoA,
            productoB: par.productoB,
          },
        },
        create: {
          tenantId: tenantId || '',
          productoA: par.productoA,
          productoB: par.productoB,
          coocurrencias: par.coocurrencias,
          soporte: par.soporte,
          confianza: par.confianza,
          levantamiento: par.levantamiento,
        },
        update: {
          coocurrencias: par.coocurrencias,
          soporte: par.soporte,
          confianza: par.confianza,
          levantamiento: par.levantamiento,
        },
      });
      count++;
    } catch (err) {
      // Skip if tenantId is empty (no filter)
    }
  }

  return count;
}

/**
 * @description Detecta clientes en riesgo de churn y actualiza sus registros.
 * @param {string | undefined} tenantId - Tenant específico o todos.
 * @returns {Promise<void>}
 */
async function detectarChurnClientes(tenantId?: string): Promise<void> {
  const analyticsList = await prisma.clienteAnalytics.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      totalCompras: { gte: 1 },
    },
  });

  for (const record of analyticsList) {
    try {
      const churnInput = {
        diasDesdeUltimaCompra: record.diasDesdeUltima ?? 9999,
        totalCompras: record.totalCompras,
        totalGastado: record.totalGastado,
        ticketPromedio: record.ticketPromedio,
        comprasUltimos30Dias: 0, // Simplificado; se puede mejorar con query adicional
        comprasUltimos60Dias: 0,
        comprasUltimos90Dias: 0,
        gastoUltimos30Dias: 0,
        gastoUltimos60Dias: 0,
        puntosLealtad: 0,
        tierActual: null,
        cuponesRedimidos: 0,
        misionesCompletadas: 0,
      };

      const churnResult = predecirChurn(churnInput);

      await prisma.clienteAnalytics.update({
        where: { analyticsId: record.analyticsId },
        data: {
          probabilidadChurn: churnResult.probabilidadChurn,
          senalesChurn: churnResult.senales as any,
        },
      });
    } catch (err) {
      // Silenciar errores individuales
    }
  }
}
