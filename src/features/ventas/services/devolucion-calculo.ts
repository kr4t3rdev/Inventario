import { ActionError } from '@/lib/server-actions';

/**
 * @description Motor puro de devoluciones de venta (DNC): sin I/O ni Prisma.
 * Todo el dinero en centavos enteros (Int), coherente con el mundo Venta.
 */

interface ItemVentaMin {
  id: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
}

interface DevolucionPreviaMin {
  ventaItemId: string;
  cantidad: number;
}

interface SeleccionItem {
  ventaItemId: string;
  cantidad: number;
}

export interface ItemDevolucionCalculado {
  ventaItemId: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
}

export interface MontosDevolucion {
  items: ItemDevolucionCalculado[];
  subtotal: number;
  descuento: number;
  total: number;
}

export type PreferenciaFinanciera = 'SALDO_FAVOR' | 'REEMBOLSO_EFECTIVO';

export interface TratamientoFinanciero {
  aplicadoCxc: number;
  saldoFavor: number;
  reembolso: number;
}

/**
 * @description Calcula cuánto queda por devolver de cada ítem de la venta.
 * @param {Array} itemsVenta - Ítems vendidos ({ id, cantidad }).
 * @param {Array} devolucionesPrevias - Líneas aplanadas de devoluciones REGISTRADAS.
 * @returns {Map<string, number>} Disponible por ventaItemId (nunca negativo).
 */
export function calcularDisponibles(
  itemsVenta: readonly { id: string; cantidad: number }[],
  devolucionesPrevias: readonly DevolucionPreviaMin[],
): Map<string, number> {
  const yaDevuelto = new Map<string, number>();
  for (const d of devolucionesPrevias) {
    yaDevuelto.set(d.ventaItemId, (yaDevuelto.get(d.ventaItemId) ?? 0) + d.cantidad);
  }
  const disponibles = new Map<string, number>();
  for (const item of itemsVenta) {
    disponibles.set(item.id, Math.max(0, item.cantidad - (yaDevuelto.get(item.id) ?? 0)));
  }
  return disponibles;
}

/**
 * @description Valida la selección y calcula subtotal, prorrateo de descuento
 * (floor, cap por subtotal y por lo que resta del descuento) y total.
 * @param {object} params - Ítems de la venta, descuentos y selección a devolver.
 * @returns {MontosDevolucion} Montos calculados de la devolución.
 * @throws {ActionError} CANTIDAD_EXCEDIDA si supera lo disponible;
 * ITEM_NO_PERTENECE si el ítem no es de la venta; VALIDATION_ERROR si cantidad ≤ 0.
 */
export function calcularMontosDevolucion(params: {
  itemsVenta: readonly ItemVentaMin[];
  descuentoVenta: number;
  descuentoYaDevuelto: number;
  devolucionesPrevias: readonly DevolucionPreviaMin[];
  seleccion: readonly SeleccionItem[];
}): MontosDevolucion {
  const { itemsVenta, descuentoVenta, descuentoYaDevuelto, devolucionesPrevias, seleccion } =
    params;

  const porId = new Map(itemsVenta.map((i) => [i.id, i]));
  const disponibles = calcularDisponibles(
    itemsVenta.map((i) => ({ id: i.id, cantidad: i.cantidad })),
    devolucionesPrevias,
  );

  // Consolidar ítems repetidos en la selección antes de validar.
  const consolidada = new Map<string, number>();
  for (const sel of seleccion) {
    consolidada.set(sel.ventaItemId, (consolidada.get(sel.ventaItemId) ?? 0) + sel.cantidad);
  }

  const items: ItemDevolucionCalculado[] = [];
  for (const [ventaItemId, cantidad] of consolidada) {
    const ventaItem = porId.get(ventaItemId);
    if (!ventaItem) {
      throw new ActionError(
        `El ítem ${ventaItemId} no pertenece a la venta.`,
        'ITEM_NO_PERTENECE',
      );
    }
    if (cantidad <= 0) {
      throw new ActionError('La cantidad a devolver debe ser mayor a 0', 'VALIDATION_ERROR');
    }
    const disponible = disponibles.get(ventaItemId) ?? 0;
    if (cantidad > disponible) {
      throw new ActionError(
        `No se puede devolver ${cantidad}; disponible: ${disponible}.`,
        'CANTIDAD_EXCEDIDA',
      );
    }
    items.push({
      ventaItemId,
      cantidad,
      precioUnitario: ventaItem.precioUnitario,
      total: cantidad * ventaItem.precioUnitario,
    });
  }

  const subtotal = items.reduce((sum, i) => sum + i.total, 0);

  // Prorrateo determinista del descuento global de la venta (ver design.md):
  // floor por ítem, cap por subtotal del ítem y por lo que resta del descuento.
  const bruto = itemsVenta.reduce((sum, i) => sum + i.total, 0);
  let descuentoRestante = Math.max(descuentoVenta - descuentoYaDevuelto, 0);
  let descuento = 0;
  let total = 0;
  for (const item of items) {
    const prorrateo = bruto > 0 ? Math.floor((descuentoVenta * item.total) / bruto) : 0;
    const aplicado = Math.min(prorrateo, descuentoRestante, item.total);
    descuentoRestante -= aplicado;
    descuento += aplicado;
    total += item.total - aplicado;
  }

  return { items, subtotal, descuento, total };
}

/**
 * @description Cascada financiera de la devolución: primero reduce la CxC
 * pendiente de la venta; el excedente va a saldo a favor o a reembolso en
 * efectivo (con permiso y turno abierto).
 * @param {object} params - Total a devolver, saldo CxC, preferencia y contexto.
 * @returns {TratamientoFinanciero} Destino de cada centavo (suma == total).
 * @throws {ActionError} FORBIDDEN sin permiso de reembolso;
 * REEMBOLSO_SIN_TURNO sin turno abierto para reembolsar.
 */
export function resolverTratamientoFinanciero(params: {
  total: number;
  saldoCxc: number;
  preferencia: PreferenciaFinanciera;
  hayTurnoAbierto: boolean;
  puedeReembolsar: boolean;
}): TratamientoFinanciero {
  const { total, saldoCxc, preferencia, hayTurnoAbierto, puedeReembolsar } = params;

  if (preferencia === 'REEMBOLSO_EFECTIVO') {
    if (!puedeReembolsar) {
      throw new ActionError(
        'No tienes permisos para reembolsar en efectivo.',
        'FORBIDDEN',
      );
    }
    if (!hayTurnoAbierto) {
      throw new ActionError(
        'El reembolso en efectivo requiere un turno abierto en el punto de venta. Usa saldo a favor o abre un turno.',
        'REEMBOLSO_SIN_TURNO',
      );
    }
  }

  const aplicadoCxc = Math.min(total, Math.max(saldoCxc, 0));
  const excedente = total - aplicadoCxc;
  const reembolso = preferencia === 'REEMBOLSO_EFECTIVO' ? excedente : 0;
  const saldoFavor = excedente - reembolso;

  return { aplicadoCxc, saldoFavor, reembolso };
}
