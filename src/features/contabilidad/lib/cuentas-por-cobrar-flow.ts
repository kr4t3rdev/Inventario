import type { VentaPendiente } from '@/app/models/model';

import type { CreateCuentaPorCobrarInput } from '../schemas-cuentas';

/**
 * @description Evalúa si una venta pendiente puede crear una CxC manualmente
 * desde reconciliación.
 * @param {VentaPendiente} venta - Venta candidata.
 * @param {boolean} hasCuentasPorCobrarFeature - Flag efectivo del tenant.
 * @param {boolean} hasExistingCuentaPorCobrar - Si ya existe una CxC asociada.
 * @returns {boolean} True cuando la venta puede generar una CxC.
 */
export function canCreateCuentaPorCobrarFromVenta(
  venta: VentaPendiente,
  hasCuentasPorCobrarFeature: boolean,
  hasExistingCuentaPorCobrar: boolean,
): boolean {
  if (!hasCuentasPorCobrarFeature) return false;
  if (hasExistingCuentaPorCobrar) return false;
  if (venta.esCuentaPorCobrar) return false;

  const clienteId = venta.cliente?.clienteId;
  if (!clienteId) return false;

  const saldoPendiente = Number(venta.saldoPendiente ?? venta.total ?? 0);
  return Number.isFinite(saldoPendiente) && saldoPendiente > 0.01;
}

/**
 * @description Construye el payload mínimo para crear una CxC desde una venta
 * pendiente.
 * @param {VentaPendiente} venta - Venta fuente.
 * @returns {CreateCuentaPorCobrarInput} Payload listo para la Server Action.
 */
export function buildCreateCuentaPorCobrarInputFromVenta(
  venta: VentaPendiente,
): CreateCuentaPorCobrarInput {
  return {
    ventaId: venta.ventaId,
    clienteId: venta.cliente?.clienteId ?? '',
    monto: Number(venta.saldoPendiente ?? venta.total ?? 0),
    moneda: venta.moneda === 'USD' ? 'USD' : 'CUP',
    numeroFactura: venta.ordenId,
    fechaVencimiento: null,
  };
}
