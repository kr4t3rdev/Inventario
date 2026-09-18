/**
 * @description Reconciliador puro del historial de compras con el cálculo
 *   del CPP. Para cada item, determina si cae dentro de la ventana de meses
 *   y calcula el gasto proporcional prorrateado por documento. Devuelve
 *   además un resumen por proveedor considerando solo los items en ventana.
 *
 *   Función pura: no accede a Prisma, filesystem ni red. Determinista para
 *   mismas entradas y misma `fechaReferencia`. No muta los inputs.
 *
 *   Se usa desde `getHistorialReconciliadoAction` con datos ya materializados
 *   desde Prisma; los tests unitarios la cubren sin servidor.
 */

export interface ItemCompraMaterializado {
  compraDocumentoItemId: string
  productoId: string
  fecha: Date
  proveedorId: string
  proveedorNombre: string
  cantidad: number
  precioUnitario: number
  totalLinea: number
  compraDocumentoId: string
  /**
   * Indica si la conversión de moneda del item fue aproximada (tasa
   * obtenida con desfase mayor a 1 día). Lo calcula la action consultando
   * el helper de normalización; este reconciliador solo lo proyecta.
   */
  tasaAproximada?: boolean
}

export interface ReconciliadorOptions {
  /** Tamaño de la ventana CPP en meses (típicamente 12). */
  ventanaMeses: number
  /**
   * Fecha de referencia para evaluar la ventana. Si no se provee, usa
   * `new Date()`. Se acepta como parámetro para que los tests sean
   * deterministas.
   */
  fechaReferencia?: Date
  /**
   * Mapa de `compraDocumentoId` → gasto y cantidad totales documentales
   * (de `GastoCompra`). La cantidad incluye todos los productos del
   * documento, aunque el historial esté filtrado a uno solo.
   */
  gastosPorDocumento?: Map<string, GastoDocumento>
}

export interface GastoDocumento {
  total: number
  cantidad: number
}

export interface ItemReconciliado extends ItemCompraMaterializado {
  /** True si el item cae dentro de la ventana CPP. */
  enVentanaCPP: boolean
  /**
   * Gasto proporcional del `GastoCompra` asignado a esta línea, prorrateado
   * por cantidad dentro del mismo `compraDocumentoId`.
   */
  gastoProporcional: number
  /** Proyección del flag del input (false si no vino). */
  tasaAproximada: boolean
}

export interface ResumenProveedor {
  proveedorId: string
  proveedorNombre: string
  cantidadTotal: number
  /** Suma de (cantidad × precioUnitario + gastoProporcional) de los items. */
  montoTotal: number
  /** Porcentaje sobre el monto total general (0 si no hay monto). */
  participacionPorcentaje: number
  cantidadItems: number
}

export interface ReconciliadorResult {
  items: ItemReconciliado[]
  proveedores: ResumenProveedor[]
  /** Reservado para warnings futuros (tasa, datos faltantes, etc.). */
  advertencias: string[]
}

/**
 * @description Resta meses calendario conservando la hora y ajustando el día
 *   al último válido del mes destino (por ejemplo, 31 de marzo menos un mes
 *   resulta en 28/29 de febrero).
 * @param {Date} fechaReferencia - Fecha desde la que se calcula el corte.
 * @param {number} ventanaMeses - Cantidad de meses calendario a restar.
 * @returns {Date} Nueva fecha de inicio inclusiva de la ventana.
 */
export function calcularInicioVentanaCalendario(
  fechaReferencia: Date,
  ventanaMeses: number,
): Date {
  const fechaInicio = new Date(fechaReferencia)
  const diaOriginal = fechaInicio.getDate()
  fechaInicio.setDate(1)
  fechaInicio.setMonth(fechaInicio.getMonth() - ventanaMeses)
  const ultimoDiaMesDestino = new Date(
    fechaInicio.getFullYear(),
    fechaInicio.getMonth() + 1,
    0,
  ).getDate()
  fechaInicio.setDate(Math.min(diaOriginal, ultimoDiaMesDestino))
  return fechaInicio
}

/**
 * @description Reconcilia el historial de compras de un producto con el
 *   cálculo del CPP. Ver JSDoc del módulo para detalles.
 */
export function reconciliarHistorial(
  items: ItemCompraMaterializado[],
  options: ReconciliadorOptions,
): ReconciliadorResult {
  const fechaRef = options.fechaReferencia ?? new Date()
  const fechaInicioVentana = calcularInicioVentanaCalendario(
    fechaRef,
    options.ventanaMeses,
  )

  // Precalcular asignaciones documentales una sola vez. El mapa permite que
  // cada línea se procese en O(1), incluso cuando un documento tiene muchas
  // líneas o el historial contiene miles de filas.
  const gastoPorDocumento = options.gastosPorDocumento

  // Marcar enVentanaCPP, calcular gastoProporcional y agrupar en una pasada.
  const reconciliados: ItemReconciliado[] = []
  const grupos = new Map<
    string,
    {
      proveedorId: string
      proveedorNombre: string
      cantidadTotal: number
      montoTotal: number
      cantidadItems: number
    }
  >()

  for (const it of items) {
    const enVentanaCPP = it.fecha >= fechaInicioVentana

    let gastoProporcional = 0
    const gastoDoc = gastoPorDocumento?.get(it.compraDocumentoId)
    if (gastoDoc && gastoDoc.total > 0 && gastoDoc.cantidad > 0) {
      gastoProporcional = (it.cantidad / gastoDoc.cantidad) * gastoDoc.total
    }

    const reconciliado = {
      ...it,
      enVentanaCPP,
      gastoProporcional,
      tasaAproximada: it.tasaAproximada ?? false,
    }
    reconciliados.push(reconciliado)
    if (!enVentanaCPP) continue

    const monto = it.cantidad * it.precioUnitario + gastoProporcional
    const existente = grupos.get(it.proveedorId)
    if (existente) {
      existente.cantidadTotal += it.cantidad
      existente.montoTotal += monto
      existente.cantidadItems += 1
    } else {
      grupos.set(it.proveedorId, {
        proveedorId: it.proveedorId,
        proveedorNombre: it.proveedorNombre,
        cantidadTotal: it.cantidad,
        montoTotal: monto,
        cantidadItems: 1,
      })
    }
  }

  // Calcular participacionPorcentaje sobre el monto total general.
  const montoTotalGeneral = Array.from(grupos.values()).reduce(
    (s, g) => s + g.montoTotal,
    0,
  )

  const proveedores: ResumenProveedor[] = Array.from(grupos.values()).map((g) => ({
    proveedorId: g.proveedorId,
    proveedorNombre: g.proveedorNombre,
    cantidadTotal: g.cantidadTotal,
    montoTotal: g.montoTotal,
    participacionPorcentaje:
      montoTotalGeneral > 0 ? (g.montoTotal / montoTotalGeneral) * 100 : 0,
    cantidadItems: g.cantidadItems,
  }))

  return {
    items: reconciliados,
    proveedores,
    advertencias: [],
  }
}
