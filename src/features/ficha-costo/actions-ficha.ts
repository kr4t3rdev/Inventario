'use server'

import { withAction, ActionError } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import { requireFeature } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { requireFichaCostoFeature } from './lib/require-feature'
import { calcularMargen, calcularVariacion } from './lib/cost-calculator'
import { calcularCPP } from './lib/cost-calculator'
import {
  calcularCostoCompuestoServer,
  calcularCostoSimpleServer,
} from './lib/cost-calc-server'
import type { FichaCostoData, GetFichaCostoInput } from './types'

function normalizeFichaInput(input: GetFichaCostoInput) {
  if (typeof input === 'string') {
    return { entityId: input, entityType: 'PRODUCTO' as const }
  }

  return input
}

/**
 * @description Devuelve la ficha de costo consolidada del producto dentro
 *   del tenant activo. Para productos simples calcula el Costo Promedio
 *   Ponderado (CPP) a partir de las compras de los últimos 12 meses. Para
 *   productos compuestos devuelve el costo de materiales de la receta
 *   asociada (sin mano de obra ni indirectos, que son inputs manuales en UI).
 */
export const getFichaCostoAction = withAction(
  async (input: GetFichaCostoInput, user: AuthenticatedUser): Promise<FichaCostoData> => {
    const { entityId, entityType } = normalizeFichaInput(input)
    const tenantId = requireFichaCostoFeature(user, 'ficha-costo')
    requireFeature(
      user,
      entityType === 'SERVICIO' ? 'servicios' : 'productos',
      'ver la ficha de costo',
    )

    if (entityType === 'SERVICIO') {
      const servicio = await prisma.servicios.findFirst({
        where: { servicioId: entityId, tenantId },
        select: {
          servicioId: true,
          nombre: true,
          precio: true,
          moneda: true,
        },
      })

      if (!servicio) {
        throw new ActionError('Servicio no encontrado', 'NOT_FOUND')
      }

      const compras = await prisma.compraServicio.findMany({
        where: { servicioId: entityId, tenantId },
        select: {
          compraServicioId: true,
          costoUnitario: true,
          cantidad: true,
          total: true,
          moneda: true,
        },
      })

      const advertencias: string[] = []
      if (compras.length === 0) {
        advertencias.push('No hay compras de servicio registradas para estimar el costo')
        return {
          producto: {
            id: servicio.servicioId,
            entityType: 'SERVICIO',
            nombre: servicio.nombre,
            codigoInterno: null,
            tipo: 'SERVICIO',
            precioCosto: 0,
            precioVenta: servicio.precio,
          },
          costoCalculado: {
            valor: 0,
            metodo: null,
            moneda: servicio.moneda,
          },
          margen: {
            absoluto: null,
            porcentaje: null,
            estado: 'SIN_DATOS',
          },
          variacion: {
            absoluto: null,
            porcentaje: null,
            estado: 'SIN_DATOS',
          },
          merma: {
            cantidad30d: 0,
            porcentajeSobreStock: null,
            desperdicioEsperadoPromedio: null,
          },
          advertencias,
          ultimaActualizacion: new Date().toISOString(),
        }
      }

      const allRowsHaveCurrency = compras.every((compra) => typeof compra.moneda === 'string')
      const allRowsMatchServiceCurrency = compras.every((compra) => compra.moneda === servicio.moneda)

      if (!allRowsHaveCurrency || !allRowsMatchServiceCurrency) {
        advertencias.push(
          'No se puede calcular un costo confiable del servicio porque las compras no tienen moneda histórica consistente',
        )
        return {
          producto: {
            id: servicio.servicioId,
            entityType: 'SERVICIO',
            nombre: servicio.nombre,
            codigoInterno: null,
            tipo: 'SERVICIO',
            precioCosto: 0,
            precioVenta: servicio.precio,
          },
          costoCalculado: {
            valor: 0,
            metodo: null,
            moneda: servicio.moneda,
          },
          margen: {
            absoluto: null,
            porcentaje: null,
            estado: 'SIN_DATOS',
          },
          variacion: {
            absoluto: null,
            porcentaje: null,
            estado: 'SIN_DATOS',
          },
          merma: {
            cantidad30d: 0,
            porcentajeSobreStock: null,
            desperdicioEsperadoPromedio: null,
          },
          advertencias,
          ultimaActualizacion: new Date().toISOString(),
        }
      }

      const costoCalculadoValor = calcularCPP(
        compras.map((compra) => ({
          cantidad: compra.cantidad,
          precioUnitario: compra.costoUnitario,
          gastoProporcional: 0,
        })),
      )
      const margen = calcularMargen(costoCalculadoValor, servicio.precio)

      return {
        producto: {
          id: servicio.servicioId,
          entityType: 'SERVICIO',
          nombre: servicio.nombre,
          codigoInterno: null,
          tipo: 'SERVICIO',
          precioCosto: 0,
          precioVenta: servicio.precio,
        },
        costoCalculado: {
          valor: costoCalculadoValor,
          metodo: 'CPP',
          moneda: servicio.moneda,
        },
        margen: {
          absoluto: margen.absoluto,
          porcentaje: margen.porcentaje,
          estado: margen.estado,
        },
        variacion: {
          absoluto: null,
          porcentaje: null,
          estado: 'SIN_DATOS',
        },
        merma: {
          cantidad30d: 0,
          porcentajeSobreStock: null,
          desperdicioEsperadoPromedio: null,
        },
        advertencias,
        ultimaActualizacion: new Date().toISOString(),
      }
    }

    const producto = await prisma.producto.findFirst({
      where: { id: entityId, tenantId },
      select: {
        id: true,
        nombre: true,
        codigoInterno: true,
        esCompuesto: true,
        precioCosto: true,
        precioVenta: true,
      },
    })

    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    const advertencias: string[] = []
    let costoCalculado: FichaCostoData['costoCalculado']

    if (producto.esCompuesto) {
      costoCalculado = await calcularCostoCompuestoServer(entityId, tenantId, advertencias)
    } else {
      costoCalculado = await calcularCostoSimpleServer(entityId, tenantId, advertencias)
    }

    const margen = calcularMargen(costoCalculado.valor, producto.precioVenta)
    const fichaMargen: FichaCostoData['margen'] = {
      absoluto: margen.absoluto,
      porcentaje: margen.porcentaje,
      estado: margen.estado,
    }

    // Costo estándar = precioCosto cargado en el producto. Variación
    // mide la diferencia entre el CPP real y ese estándar.
    const variacionCalc = calcularVariacion(costoCalculado.valor, producto.precioCosto)
    const fichaVariacion: FichaCostoData['variacion'] = {
      absoluto: variacionCalc.absoluto,
      porcentaje: variacionCalc.porcentaje,
      estado: variacionCalc.estado,
    }

    // Mermas registradas en los últimos 30 días
    const hace30Dias = new Date()
    hace30Dias.setDate(hace30Dias.getDate() - 30)
    const mermasAgg = await prisma.merma.aggregate({
      where: {
        productoId: entityId,
        tenantId,
        createdAt: { gte: hace30Dias },
      },
      _sum: { cantidad: true },
    })
    const cantidadMerma = mermasAgg._sum?.cantidad ?? 0

    // Desperdicio esperado promedio de la receta
    let desperdicioEsperadoPromedio: number | null = null
    if (producto.esCompuesto) {
      const receta = await prisma.receta.findFirst({
        where: { productoId: entityId, tenantId },
        include: { RecetaIngrediente: true },
      })
      if (receta && receta.RecetaIngrediente.length > 0) {
        const suma = receta.RecetaIngrediente.reduce(
          (s, i) => s + (i.desperdicio ?? 0),
          0,
        )
        desperdicioEsperadoPromedio = suma / receta.RecetaIngrediente.length
      }
    }

    const stockActual = await prisma.producto.findFirst({
      where: { id: entityId, tenantId },
      select: { stock: true },
    })
    const porcentajeSobreStock =
      stockActual && stockActual.stock > 0
        ? (cantidadMerma / stockActual.stock) * 100
        : null

    const fichaMerma: FichaCostoData['merma'] = {
      cantidad30d: cantidadMerma,
      porcentajeSobreStock,
      desperdicioEsperadoPromedio,
    }

    // Alerta por margen bajo o pérdida: agregar al listado de advertencias.
    if (margen.estado === 'BAJO') {
      advertencias.push(
        `Margen bajo: ${margen.porcentaje?.toFixed(1)}% — considerar subir precio de venta o reducir costo`,
      )
    } else if (margen.estado === 'PERDIDA') {
      advertencias.push(
        `Margen negativo (${margen.porcentaje?.toFixed(1)}%): se vende a pérdida — revisar urgente`,
      )
    }

    return {
      producto: {
        id: producto.id,
        entityType: 'PRODUCTO',
        nombre: producto.nombre,
        codigoInterno: producto.codigoInterno,
        tipo: producto.esCompuesto ? 'COMPUESTO' : 'SIMPLE',
        precioCosto: producto.precioCosto,
        precioVenta: producto.precioVenta,
      },
      costoCalculado,
      margen: fichaMargen,
      variacion: fichaVariacion,
      merma: fichaMerma,
      advertencias,
      ultimaActualizacion: new Date().toISOString(),
    }
  },
)
