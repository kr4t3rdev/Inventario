/**
 * @description Helpers de moneda para el módulo de servicios.
 * La fuente de verdad de la moneda de un servicio es el catálogo
 * (`Servicios.moneda`); las ventas persisten su propio snapshot.
 */
import { formatCurrency } from '@/lib/utils';

const MONEDA_DEFAULT = 'CUP';

interface ServicioConMoneda {
  servicioId: string;
  moneda?: string | null;
}

/**
 * @description Resuelve la moneda del servicio seleccionado en un formulario.
 * @param {ServicioConMoneda[]} servicios - Catálogo disponible.
 * @param {string | undefined | null} servicioId - Servicio seleccionado.
 * @returns {string} Moneda del servicio o CUP si no hay selección válida.
 */
export function resolverMonedaServicio(
  servicios: ServicioConMoneda[],
  servicioId?: string | null,
): string {
  if (!servicioId) return MONEDA_DEFAULT;
  const servicio = servicios.find((s) => s.servicioId === servicioId);
  return servicio?.moneda?.trim().toUpperCase() || MONEDA_DEFAULT;
}

/**
 * @description Formatea el total de una venta de servicios.
 * @param {number} total - Monto total de la venta.
 * @param {string | null | undefined} moneda - Snapshot de moneda de la venta.
 * @returns {string} Monto formateado; filas legacy sin snapshot usan CUP.
 */
export function formatearTotalVenta(total: number, moneda?: string | null): string {
  return formatCurrency(total, moneda?.trim().toUpperCase() || MONEDA_DEFAULT);
}
