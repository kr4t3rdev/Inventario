import type { VentaPendiente } from '@/app/models/model';

import type { CreateCuentaPorCobrarInput } from '../schemas-cuentas';

/**
 * @description Rechaza asociar una venta a un cliente distinto del ya vinculado.
 * @param {string | null | undefined} ventaClienteId - Cliente persistido en la venta.
 * @param {string} cuentaClienteId - Cliente solicitado para la cuenta por cobrar.
 * @returns {void} No devuelve valor cuando la asociación es válida.
 */
export function assertCuentaPorCobrarClienteDeVenta(
  ventaClienteId: string | null | undefined,
  cuentaClienteId: string,
): void {
  if (!ventaClienteId) {
    throw new Error('La venta debe tener un cliente asociado para crear la cuenta por cobrar');
  }
  if (ventaClienteId !== cuentaClienteId) {
    throw new Error('La cuenta por cobrar debe usar el cliente asociado a la venta');
  }
}

/**
 * @description Normaliza la moneda original de una CxC, sin asignar una moneda por defecto.
 * @param {string | null | undefined} currency - Moneda guardada en la CxC.
 * @returns {string | undefined} Código válido en mayúsculas o undefined si no es verificable.
 */
export function getCuentaPorCobrarCurrency(
  currency: string | null | undefined,
): string | undefined {
  const normalized = currency?.trim().toUpperCase();
  return normalized && /^[A-Z]{3}$/.test(normalized) ? normalized : undefined;
}

/**
 * @description Agrupa importes solo cuando cada moneda está explícitamente informada.
 * @param {Array<{ amount: number; currency?: string | null }>} entries - Importes fuente.
 * @returns {{ totalsByCurrency: Record<string, number>; unknownCurrencyCount: number }}
 * Totales separados por moneda y cantidad de filas sin moneda verificable.
 */
export function groupAmountsByCurrency(
  entries: Array<{ amount: number; currency?: string | null }>,
): { totalsByCurrency: Record<string, number>; unknownCurrencyCount: number } {
  return entries.reduce<{ totalsByCurrency: Record<string, number>; unknownCurrencyCount: number }>(
    (summary, entry) => {
      const currency = entry.currency?.trim().toUpperCase();
      if (!currency || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(entry.amount)) {
        return { ...summary, unknownCurrencyCount: summary.unknownCurrencyCount + 1 };
      }

      return {
        ...summary,
        totalsByCurrency: {
          ...summary.totalsByCurrency,
          [currency]: (summary.totalsByCurrency[currency] ?? 0) + entry.amount,
        },
      };
    },
    { totalsByCurrency: {}, unknownCurrencyCount: 0 },
  );
}

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
  const moneda = venta.moneda?.trim();
  if (!moneda || !/^[A-Za-z]{3}$/.test(moneda)) {
    throw new Error('La moneda de la venta no es verificable para crear la cuenta por cobrar');
  }

  return {
    ventaId: venta.ventaId,
    clienteId: venta.cliente?.clienteId ?? '',
    monto: venta.saldoPendiente ?? venta.total ?? 0,
    moneda: moneda.toUpperCase(),
    numeroFactura: venta.ordenId,
    fechaVencimiento: null,
  };
}
