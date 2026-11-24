export interface FacturasVencidasTotals {
  dias30: number;
  dias60: number;
  dias90: number;
  dias120: number;
  diasPlus120: number;
  total: number;
}

export type FacturasVencidasTotalsRow = [
  string,
  string,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  string,
];

/**
 * @description Construye la fila de totales siguiendo las columnas del reporte CSV.
 * @param {FacturasVencidasTotals} totals - Saldos acumulados por antigüedad.
 * @returns {FacturasVencidasTotalsRow} Fila con diez celdas alineadas al encabezado.
 */
export function buildFacturasVencidasTotalsRow(
  totals: FacturasVencidasTotals,
): FacturasVencidasTotalsRow {
  return [
    'TOTALES',
    '',
    '',
    totals.dias30,
    totals.dias60,
    totals.dias90,
    totals.dias120,
    totals.diasPlus120,
    totals.total,
    '',
  ];
}
