/**
 * @description Tipos del contrato de filtros para ReportesAnalyticsPage.
 */
export interface FiltrosGlobalesReporte {
  fechaInicio: string;
  fechaFin: string;
  cuentaId: string;
}

export interface FiltrosLocalesMovimientosReporte {
  busqueda: string;
  tipoMovimiento: string;
  moneda: string;
  page: number;
  limit: number;
}

/**
 * @description Construye los query params para exportación de movimientos, incluyendo filtros globales y locales.
 * @param {'csv' | 'pdf'} formato - Formato de exportación.
 * @param {FiltrosGlobalesReporte} globales - Filtros globales activos.
 * @param {FiltrosLocalesMovimientosReporte} locales - Filtros locales activos de Movimientos.
 * @returns {URLSearchParams} Params listos para enviar al endpoint.
 */
export function buildMovimientosExportParams(
  formato: 'csv' | 'pdf',
  globales: FiltrosGlobalesReporte,
  locales: FiltrosLocalesMovimientosReporte,
): URLSearchParams {
  const params = new URLSearchParams({ formato });
  if (globales.fechaInicio) params.set('fechaInicio', globales.fechaInicio);
  if (globales.fechaFin) params.set('fechaFin', globales.fechaFin);
  if (globales.cuentaId) params.set('cuentaId', globales.cuentaId);
  if (locales.busqueda) params.set('busqueda', locales.busqueda);
  if (locales.tipoMovimiento && locales.tipoMovimiento !== 'all') {
    params.set('tipoMovimiento', locales.tipoMovimiento);
  }
  if (locales.moneda && locales.moneda !== 'all') params.set('moneda', locales.moneda);
  params.set('page', String(locales.page));
  params.set('limit', String(locales.limit));
  return params;
}
