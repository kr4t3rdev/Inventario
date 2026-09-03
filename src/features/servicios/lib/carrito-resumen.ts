/**
 * @description Regla de negocio del carrito de servicios: nunca sumar
 * importes de monedas distintas. Este módulo agrupa los ítems por moneda
 * y expone totales, costos y márgenes por moneda para la UI.
 */

export interface ItemCarritoResumen {
  precio: number;
  costo: number;
  cantidad: number;
  moneda?: string;
}

export interface GrupoMoneda {
  moneda: string;
  total: number;
  costoTotal: number;
  margen: number;
  items: number;
}

export interface CarritoResumen {
  grupos: Record<string, GrupoMoneda>;
  monedas: string[];
  esMultiMoneda: boolean;
}

const MONEDA_DEFAULT = 'CUP';

/**
 * @description Resume el carrito agrupando por moneda.
 * @param {ItemCarritoResumen[]} items - Ítems del carrito (con o sin moneda).
 * @returns {CarritoResumen} Totales agrupados; los ítems sin moneda cuentan como CUP.
 */
export function resumirCarritoPorMoneda(items: ItemCarritoResumen[]): CarritoResumen {
  const grupos: Record<string, GrupoMoneda> = {};

  for (const item of items) {
    const moneda = (item.moneda ?? MONEDA_DEFAULT).trim().toUpperCase() || MONEDA_DEFAULT;
    if (!grupos[moneda]) {
      grupos[moneda] = { moneda, total: 0, costoTotal: 0, margen: 0, items: 0 };
    }
    const g = grupos[moneda];
    g.total += item.precio * item.cantidad;
    g.costoTotal += item.costo * item.cantidad;
    g.items += item.cantidad;
  }

  for (const g of Object.values(grupos)) {
    g.margen = g.total - g.costoTotal;
  }

  const monedas = Object.keys(grupos);
  return { grupos, monedas, esMultiMoneda: monedas.length > 1 };
}

/** @description Códigos de moneda ordenados de forma determinista (CUP primero). */
export function monedasOrdenadas(monedas: string[]): string[] {
  return [...monedas].sort((a, b) => (a === MONEDA_DEFAULT ? -1 : b === MONEDA_DEFAULT ? 1 : a.localeCompare(b)));
}
