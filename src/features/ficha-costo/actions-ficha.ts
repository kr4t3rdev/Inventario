'use server'

import { withAction, ActionError } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import { requireTenant, requireFeature } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { calcularMargen, calcularVariacion } from './lib/cost-calculator'
import {
  calcularCostoCompuestoServer,
  calcularCostoSimpleServer,
} from './lib/cost-calc-server'
import type { FichaCostoData } from './types'

/**
 * @description Devuelve la ficha de costo consolidada del producto dentro
 *   del tenant activo. Para productos simples calcula el Costo Promedio
 *   Ponderado (CPP) a partir de las compras de los últimos 12 meses. Para
 *   productos compuestos devuelve el costo de materiales de la receta
 *   asociada (sin mano de obra ni indirectos, que son inputs manuales en UI).
 */
export const getFichaCostoAction = withAction(
  async (productoId: string, user: AuthenticatedUser): Promise<FichaCostoData> => {
    const tenantId = requireTenant(user)
    requireFeature(user, 'productos', 'ver la ficha de costo')

    const producto = await prisma.producto.findFirst({
      where: { id: productoId, tenantId },
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
      costoCalculado = await calcularCostoCompuestoServer(productoId, tenantId, advertencias)
    } else {
      costoCalculado = await calcularCostoSimpleServer(productoId, tenantId, advertencias)
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
        productoId,
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
        where: { productoId, tenantId },
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
      where: { id: productoId, tenantId },
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
