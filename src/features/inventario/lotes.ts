import { ActionError } from '@/lib/server-actions'

export interface CrearLoteDesdeEntradaInput {
  tenantId: string
  productoId: string
  cantidad: number
  codigo?: string
  codigoManual?: string | null
  factura?: string | null
  recepcionId?: string | null
  fechaEntrada?: Date
  linea?: number
  fechaVencimiento?: Date | null
  compraItemId?: string | null
  recepcionItemId?: string | null
}

export interface DeriveLoteCodigoInput {
  factura?: string | null
  recepcionId?: string | null
  fecha: Date
  linea: number
  codigoManual?: string | null
}

/**
 * @description Genera un código de lote estable desde entrada manual, factura o recepción.
 * @param {DeriveLoteCodigoInput} input - Origen y fecha de la entrada.
 * @returns {string} Código único dentro de las líneas de esa entrada.
 */
export function deriveLoteCodigo(input: DeriveLoteCodigoInput): string {
  const codigoManual = input.codigoManual?.trim()
  if (codigoManual) return codigoManual

  if (!Number.isInteger(input.linea) || input.linea < 0 || !Number.isFinite(input.fecha.getTime())) {
    throw new ActionError('Se requiere un origen válido para identificar el lote', 'LOTE_ORIGEN_REQUERIDO')
  }

  const fecha = input.fecha.toISOString().slice(0, 10).replaceAll('-', '')
  const factura = input.factura?.trim()
  if (factura) return `F-${factura}-${fecha}-L${input.linea}`

  const recepcionId = input.recepcionId?.trim()
  if (recepcionId) return `R-${recepcionId}-${fecha}-L${input.linea}`

  throw new ActionError('Se requiere un origen válido para identificar el lote', 'LOTE_ORIGEN_REQUERIDO')
}

/**
 * @description Registra un lote con la cantidad inicial íntegra de una entrada de inventario.
 * @param {any} tx - Cliente transaccional Prisma.
 * @param {CrearLoteDesdeEntradaInput} input - Producto, cantidad, código y trazabilidad.
 * @returns {Promise<unknown>} Lote creado.
 */
export async function crearLoteDesdeEntrada(
  tx: any,
  input: CrearLoteDesdeEntradaInput,
): Promise<unknown> {
  if (!Number.isSafeInteger(input.cantidad) || input.cantidad <= 0) {
    throw new ActionError('La cantidad del lote debe ser un entero mayor que cero', 'LOTE_CANTIDAD_INVALIDA')
  }
  if (!input.tenantId.trim() || !input.productoId.trim()) {
    throw new ActionError('El tenant y el producto del lote son obligatorios', 'LOTE_ENTIDAD_REQUERIDA')
  }
  if (input.fechaVencimiento && !Number.isFinite(input.fechaVencimiento.getTime())) {
    throw new ActionError('La fecha de vencimiento del lote no es válida', 'LOTE_FECHA_INVALIDA')
  }
  const codigo = input.codigo?.trim() || deriveLoteCodigo({
    factura: input.factura,
    recepcionId: input.recepcionId,
    fecha: input.fechaEntrada ?? new Date(Number.NaN),
    linea: input.linea ?? -1,
    codigoManual: input.codigoManual,
  })
  if (!codigo) {
    throw new ActionError('El código del lote es obligatorio', 'LOTE_CODIGO_REQUERIDO')
  }

  return tx.lote.create({
    data: {
      tenantId: input.tenantId,
      productoId: input.productoId,
      codigo,
      cantidadInicial: input.cantidad,
      cantidadDisponible: input.cantidad,
      fechaVencimiento: input.fechaVencimiento ?? null,
      compraItemId: input.compraItemId ?? null,
      recepcionItemId: input.recepcionItemId ?? null,
    },
  })
}
