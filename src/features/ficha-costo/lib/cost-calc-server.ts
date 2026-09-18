/**
 * @description Helpers de cálculo de costo que dependen de Prisma
 *   (acceden a CompraDocumentoItem, GastoCompra, Receta). Se separan
 *   de `cost-calculator.ts` (que es puro y testeable sin servidor) para
 *   que las Server Actions los puedan importar sin arrastrar dependencias
 *   innecesarias al bundle del cliente.
 */

import { prisma } from '@/lib/prisma'
import { ActionError } from '@/lib/server-actions'
import {
  calcularCPP,
  calcularCostoMateriales,
  normalizarMoneda,
  type CompraInput,
  type IngredienteInput,
} from './cost-calculator'
import { lookupFromCache, precargarTasas } from './exchange-lookup'
import type { FichaCostoCalculado } from '../types'

const VENTANA_MESES = 12

export const FICHA_COSTO_VENTANA_MESES = VENTANA_MESES

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * @description Calcula CPP de un producto en los últimos 12 meses sin
 *   devolver advertencias. Usado para composición y como sub-cálculo
 *   dentro del cálculo de costo simple. Mantiene una firma simple para
 *   que las Server Actions no se acoplen al manejo de advertencias.
 */
export async function calcularCostoSimpleInterno(
  productoId: string,
  tenantId: string,
): Promise<{ cpp: number; advertencias: string[] }> {
  const advertencias: string[] = []
  const hace12Meses = new Date()
  hace12Meses.setMonth(hace12Meses.getMonth() - VENTANA_MESES)

  const compras = await prisma.compraDocumentoItem.findMany({
    where: {
      productoId,
      tenantId,
      compraDocumento: {
        fechaCompra: { gte: hace12Meses },
        deletedAt: null,
      },
    },
    select: {
      compraDocumentoId: true,
      cantidad: true,
      precioUnitario: true,
      compraDocumento: { select: { gastoCompraId: true, fechaCompra: true } },
    },
  })

  if (compras.length === 0) {
    return { cpp: 0, advertencias }
  }

  // Determinar la moneda base del tenant (CUP por defecto).
  const monedaBase = await obtenerMonedaBaseTenant(tenantId)

  // Precargar tasas para todas las monedas distintas a la base que
  // aparezcan en las compras. Como el schema actual no expone `moneda`
  // en CompraDocumento, asumimos CUP por línea y este precargado queda
  // listo para cuando se agregue el campo.
  const monedas = ['USD'] // placeholder: cuando exista el campo, leer de cada línea
  const cache = await precargarTasas(monedas, monedaBase)
  const lookup = lookupFromCache(cache)

  const gastoIds = Array.from(
    new Set(
      compras
        .map((c) => c.compraDocumento?.gastoCompraId)
        .filter((id): id is string => Boolean(id)),
    ),
  )

  const gastos = gastoIds.length
    ? await prisma.gastoCompra.findMany({
        where: { tenantId, gastoCompraId: { in: gastoIds } },
        select: { gastoCompraId: true, total: true, cantidad: true },
      })
    : []

  const gastoPorDoc = new Map<string, { total: number; cantidad: number }>()
  for (const c of compras) {
    const docId = c.compraDocumentoId
    const gastoId = c.compraDocumento?.gastoCompraId
    if (!docId || !gastoId) continue
    if (gastoPorDoc.has(docId)) continue
    const g = gastos.find((x) => x.gastoCompraId === gastoId)
    if (!g || !g.cantidad) continue
    gastoPorDoc.set(docId, { total: g.total, cantidad: g.cantidad })
  }

  const comprasInput: CompraInput[] = compras.map((c) => {
    // Asumimos CUP por línea hasta que el schema agregue `moneda`.
    const monedaLinea = 'CUP'
    const normalizado = normalizarMoneda(
      c.precioUnitario,
      monedaLinea,
      monedaBase,
      lookup,
      c.compraDocumento?.fechaCompra ?? new Date(),
    )
    if (normalizado.nota === 'TASA_APROXIMADA') {
      advertencias.push(
        `Tasa de cambio aproximada aplicada a compra ${c.compraDocumentoId ?? ''}`.trim(),
      )
    }
    if (normalizado.nota === 'SIN_TASA') {
      advertencias.push(
        `Sin tasa de cambio para la compra ${c.compraDocumentoId ?? ''}; se usa el precio original`.trim(),
      )
    }
    const gastoDoc = c.compraDocumentoId ? gastoPorDoc.get(c.compraDocumentoId) : undefined
    const gastoProp = gastoDoc ? (gastoDoc.total * c.cantidad) / gastoDoc.cantidad : 0
    return {
      cantidad: c.cantidad,
      precioUnitario: normalizado.valor ?? c.precioUnitario,
      gastoProporcional: gastoProp,
    }
  })

  return { cpp: calcularCPP(comprasInput), advertencias }
}

export async function obtenerMonedaBaseTenant(tenantId: string): Promise<string> {
  // Por ahora: CUP es la moneda principal histórica del sistema.
  // Cuando el modelo MiEmpresa o Tenant expongan la moneda base, leerla
  // desde ahí. Mantenemos el helper para no acoplar las actions.
  void tenantId
  return 'CUP'
}

export async function calcularCostoSimpleServer(
  productoId: string,
  tenantId: string,
  advertencias: string[],
): Promise<FichaCostoCalculado> {
  const { cpp, advertencias: adv } = await calcularCostoSimpleInterno(productoId, tenantId)
  for (const a of adv) advertencias.push(a)
  if (cpp === 0) {
    advertencias.push('No hay compras registradas en los últimos 12 meses')
  }
  return { valor: cpp, metodo: 'CPP', moneda: 'CUP' }
}

export async function calcularCostoCompuestoServer(
  productoId: string,
  tenantId: string,
  advertencias: string[],
): Promise<FichaCostoCalculado> {
  const receta = await prisma.receta.findFirst({
    where: { productoId, tenantId },
    include: {
      RecetaIngrediente: {
        include: { Producto: { select: { id: true, nombre: true } } },
      },
    },
  })

  if (!receta) {
    advertencias.push('Producto compuesto sin receta definida')
    return { valor: 0, metodo: 'COMPOSICION', moneda: 'CUP' }
  }

  const ingredientesInfo = await Promise.all(
    receta.RecetaIngrediente.map(async (ing) => {
      const cpp = await calcularCostoSimpleServer(ing.productoId, tenantId, advertencias)
      return {
        productoId: ing.productoId,
        cantidad: ing.cantidad,
        desperdicio: ing.desperdicio,
        cppIngrediente: cpp.valor > 0 ? cpp.valor : null,
      } satisfies IngredienteInput
    }),
  )

  const resultado = calcularCostoMateriales(ingredientesInfo)
  if (resultado.ingredientesSinCosto > 0) {
    advertencias.push(`${resultado.ingredientesSinCosto} ingrediente(s) sin costo calculado`)
  }

  return {
    valor: resultado.total,
    metodo: 'COMPOSICION',
    moneda: 'CUP',
  }
}

export function normalizarMontoManual(value: number | undefined): number {
  if (value === undefined || value === null) return 0
  if (!Number.isFinite(value) || value < 0) {
    throw new ActionError('manoObra/indirectos deben ser números >= 0', 'VALIDATION_ERROR')
  }
  return value
}

export { round2 }
