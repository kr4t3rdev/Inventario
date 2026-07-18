'use server'

import { withAction, ActionError } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import { requireFeature } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { requireFichaCostoFeature } from './lib/require-feature'
import { obtenerMonedaBaseTenant } from './lib/cost-calc-server'
import { lookupFromCache, precargarTasas } from './lib/exchange-lookup'
import { normalizarMoneda } from './lib/cost-calculator'
import {
  calcularInicioVentanaCalendario,
  reconciliarHistorial,
  type ItemCompraMaterializado,
} from './lib/reconciliador-historial'
import { validateInput, paginationShape, dateFiltersShape } from './lib/input-validation'
import { z } from 'zod'
import type {
  HistorialReconciliadoData,
  HistorialReconciliadoItem,
  GetHistorialReconciliadoInput,
} from './types'

const HISTORIAL_DEFAULT_LIMIT = 20
const VENTANA_MESES_CPP = 12

/**
 * @description Devuelve el historial de compras del producto reconciliado
 *   con el cálculo del CPP. Cada item indica si cae dentro de la ventana
 *   de 12 meses y el gasto proporcional prorrateado. Incluye además un
 *   resumen por proveedor (calculado sobre el set completo en ventana)
 *   y el estado del CPP (CALCULADO / CON_ADVERTENCIAS / SIN_DATOS).
 *
 *   Multi-tenant estricto: producto de otro tenant → NOT_FOUND opaco.
 *   Excluye documentos soft-deleted (deletedAt: null) para alinearse
 *   con el cálculo del CPP.
 */
export const getHistorialReconciliadoAction = withAction(
  async (
    input: GetHistorialReconciliadoInput,
    user: AuthenticatedUser,
  ): Promise<HistorialReconciliadoData> => {
    const parsed = validateInput(z.object({ productoId: z.string().min(1) }).extend(paginationShape).extend(dateFiltersShape).extend({ proveedorId: z.string().min(1).optional() }), input)
    const tenantId = requireFichaCostoFeature(user, 'ficha-costo')
    requireFeature(user, 'productos', 'ver el historial de costos')

    // 1. Verificar que el producto pertenece al tenant.
    const producto = await prisma.producto.findFirst({
      where: { id: parsed.productoId, tenantId },
      select: { id: true },
    })
    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    // 2. Calcular paginación.
    const page = parsed.page && parsed.page > 0 ? parsed.page : 1
    const limit =
      parsed.limit && parsed.limit > 0 && parsed.limit <= 100
        ? parsed.limit
        : HISTORIAL_DEFAULT_LIMIT
    const skip = (page - 1) * limit

    // 3. Construir el where con filtros.
    const baseWhere: Record<string, unknown> = {
      productoId: parsed.productoId,
      tenantId,
    }
    const docWhere: Record<string, unknown> = { deletedAt: null }
    if (parsed.fechaDesde) {
      docWhere.fechaCompra = {
        ...((docWhere.fechaCompra as object) ?? {}),
        gte: new Date(parsed.fechaDesde),
      }
    }
    if (parsed.fechaHasta) {
      docWhere.fechaCompra = {
        ...((docWhere.fechaCompra as object) ?? {}),
        lte: new Date(parsed.fechaHasta),
      }
    }
    if (parsed.proveedorId) {
      docWhere.proveedorId = parsed.proveedorId
    }
    if (Object.keys(docWhere).length > 0) {
      baseWhere.compraDocumento = docWhere
    }

    // 4. Query paginada + query completa (para reconciliación) en paralelo.
    const itemsPaginadosRaw = await prisma.compraDocumentoItem.findMany({
      where: baseWhere,
      orderBy: { compraDocumento: { fechaCompra: 'desc' } },
      skip,
      take: limit,
      select: {
        compraDocumentoItemId: true,
        cantidad: true,
        precioUnitario: true,
        totalLinea: true,
        compraDocumento: {
          select: {
            fechaCompra: true,
            numeroFactura: true,
            proveedorId: true,
            compraDocumentoId: true,
            gastoCompraId: true,
            proveedor: { select: { nombre: true } },
          },
        },
      },
    })

    const fechaReferencia = new Date()
    const fechaInicioVentana = calcularInicioVentanaCalendario(
      fechaReferencia,
      VENTANA_MESES_CPP,
    )
    const fechaCompraFiltrada = docWhere.fechaCompra as
      | Record<string, Date>
      | undefined
    const whereVentanaCPP = {
      ...baseWhere,
      compraDocumento: {
        ...docWhere,
        fechaCompra: {
          ...fechaCompraFiltrada,
          gte:
            fechaCompraFiltrada?.gte &&
            fechaCompraFiltrada.gte > fechaInicioVentana
              ? fechaCompraFiltrada.gte
              : fechaInicioVentana,
        },
      },
    }

    const [itemsVentanaRaw, total] = await Promise.all([
      prisma.compraDocumentoItem.findMany({
        where: whereVentanaCPP,
        select: {
          compraDocumentoItemId: true,
          cantidad: true,
          precioUnitario: true,
          compraDocumentoId: true,
          compraDocumento: {
            select: {
              fechaCompra: true,
              numeroFactura: true,
              proveedorId: true,
              gastoCompraId: true,
              proveedor: { select: { nombre: true } },
            },
          },
        },
      }),
      prisma.compraDocumentoItem.count({ where: baseWhere }),
    ])

    // La página puede contener compras fuera de la ventana CPP. Se agregan al
    // set a reconciliar para proyectar sus flags sin alterar el resumen, que el
    // reconciliador calcula exclusivamente con filas dentro de la ventana.
    const itemsPorId = new Map(
      itemsVentanaRaw.map((item) => [item.compraDocumentoItemId, item]),
    )
    for (const item of itemsPaginadosRaw) {
      if (itemsPorId.has(item.compraDocumentoItemId)) continue
      itemsPorId.set(item.compraDocumentoItemId, {
        ...item,
        compraDocumentoId: item.compraDocumento.compraDocumentoId,
      })
    }
    const itemsCompletosRaw = Array.from(itemsPorId.values())
    const itemsVentanaIds = new Set(
      itemsVentanaRaw.map((item) => item.compraDocumentoItemId),
    )

    // 5. Calcular tasaAproximada por item y armar gastosPorDocumento.
    const monedaBase = await obtenerMonedaBaseTenant(tenantId)
    const cache = await precargarTasas(['USD'], monedaBase)
    const lookup = lookupFromCache(cache)

    const advertencias: string[] = []
    const gastosPorDocumento = new Map<
      string,
      { total: number; cantidad: number }
    >()
    const gastoIds = Array.from(
      new Set(
        itemsCompletosRaw
          .map((c) => c.compraDocumento?.gastoCompraId)
          .filter((id): id is string => Boolean(id)),
      ),
    )

    if (gastoIds.length > 0) {
      const gastos = await prisma.gastoCompra.findMany({
        where: { tenantId, gastoCompraId: { in: gastoIds } },
        select: { gastoCompraId: true, total: true, cantidad: true },
      })
      const gastosPorId = new Map(gastos.map((g) => [g.gastoCompraId, g]))
      for (const c of itemsCompletosRaw) {
        const docId = c.compraDocumentoId
        const gastoId = c.compraDocumento?.gastoCompraId
        if (!docId || !gastoId) continue
        if (gastosPorDocumento.has(docId)) continue
        const g = gastosPorId.get(gastoId)
        if (!g || !g.cantidad) continue
        gastosPorDocumento.set(docId, {
          total: g.total,
          cantidad: g.cantidad,
        })
      }
    }

    // 6. Materializar items para el reconciliador.
    const itemsParaReconciliar: ItemCompraMaterializado[] = itemsCompletosRaw.map(
      (c) => {
        const fecha = c.compraDocumento?.fechaCompra ?? new Date()
        const normalizado = normalizarMoneda(
          c.precioUnitario,
          'CUP',
          monedaBase,
          lookup,
          fecha,
        )
        const aportaAlCPP = itemsVentanaIds.has(c.compraDocumentoItemId)
        if (aportaAlCPP && normalizado.nota === 'TASA_APROXIMADA') {
          advertencias.push(
            `Tasa de cambio aproximada aplicada a compra ${c.compraDocumentoId ?? ''}`.trim(),
          )
        }
        if (aportaAlCPP && normalizado.nota === 'SIN_TASA') {
          advertencias.push(
            `Sin tasa de cambio para la compra ${c.compraDocumentoId ?? ''}; se usa el precio original`.trim(),
          )
        }
        return {
          compraDocumentoItemId: c.compraDocumentoItemId,
          productoId: parsed.productoId,
          fecha,
          proveedorId: c.compraDocumento?.proveedorId ?? 'sin-proveedor',
          proveedorNombre: c.compraDocumento?.proveedor?.nombre ?? 'Sin proveedor',
          cantidad: c.cantidad,
          precioUnitario: c.precioUnitario,
          totalLinea: c.cantidad * c.precioUnitario,
          compraDocumentoId: c.compraDocumentoId,
          tasaAproximada: normalizado.nota === 'TASA_APROXIMADA',
        }
      },
    )

    // 7. Llamar al reconciliador puro.
    const resultado = reconciliarHistorial(itemsParaReconciliar, {
      ventanaMeses: VENTANA_MESES_CPP,
      fechaReferencia,
      gastosPorDocumento,
    })
    for (const a of resultado.advertencias) advertencias.push(a)

    // 8. Determinar estado del CPP.
    const itemsEnVentana = resultado.items.filter((it) => it.enVentanaCPP)
    let estadoCPP: HistorialReconciliadoData['estadoCPP']
    if (itemsEnVentana.length === 0) {
      estadoCPP = 'SIN_DATOS'
    } else if (advertencias.length > 0) {
      estadoCPP = 'CON_ADVERTENCIAS'
    } else {
      estadoCPP = 'CALCULADO'
    }

    // 9. Paginar items reconciliados en memoria (los items reconciliados
    //    vienen del set completo, no de la query paginada, así que cortamos
    //    aquí según page/limit).
    const itemsPaginadosIds = new Set(
      itemsPaginadosRaw.map((it) => it.compraDocumentoItemId),
    )
    const itemsPaginadosPorId = new Map(
      itemsPaginadosRaw.map((item) => [item.compraDocumentoItemId, item]),
    )
    const itemsReconciliadosPaginados: HistorialReconciliadoItem[] =
      resultado.items
        .filter((it) => itemsPaginadosIds.has(it.compraDocumentoItemId))
        .map((it) => {
          // Buscar datos del join para los campos de la fila.
          const raw = itemsPaginadosPorId.get(it.compraDocumentoItemId)
          return {
            compraDocumentoItemId: it.compraDocumentoItemId,
            fecha: it.fecha.toISOString(),
            numeroFactura: raw?.compraDocumento.numeroFactura ?? '',
            proveedor: it.proveedorNombre,
            proveedorId: it.proveedorId,
            cantidad: it.cantidad,
            precioUnitario: it.precioUnitario,
            totalLinea: it.totalLinea,
            enVentanaCPP: it.enVentanaCPP,
            gastoProporcional: it.gastoProporcional,
            tasaAproximada: it.tasaAproximada,
          }
        })

    return {
      items: itemsReconciliadosPaginados,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      proveedores: resultado.proveedores,
      estadoCPP,
      advertencias,
    }
  },
)
