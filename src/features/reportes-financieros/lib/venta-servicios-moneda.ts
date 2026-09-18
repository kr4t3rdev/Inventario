/**
 * @description Agrega los ingresos de servicios separados por moneda para no
 * mezclar importes de monedas distintas (CUP, USD, MLC) en una misma suma.
 */
export interface ServicioConMoneda {
  total?: number | null;
  moneda?: string | null;
}

/**
 * @description Suma el total de una lista de ventas de servicio agrupado por moneda.
 * La moneda se normaliza a mayúsculas; un servicio sin moneda se asume moneda funcional.
 * @param {ServicioConMoneda[]} servicios - Ventas de servicio del período.
 * @param {string} monedaFuncional - Moneda funcional del negocio (por defecto CUP).
 * @returns {Record<string, number>} Total de ingresos por código de moneda.
 */
export function sumarServiciosPorMoneda(
  servicios: ServicioConMoneda[],
  monedaFuncional = 'CUP',
): Record<string, number> {
  const porMoneda: Record<string, number> = {};
  const funcional = monedaFuncional.trim().toUpperCase() || 'CUP';

  for (const servicio of servicios) {
    const moneda = (servicio.moneda?.trim().toUpperCase() || funcional);
    porMoneda[moneda] = (porMoneda[moneda] ?? 0) + Number(servicio.total ?? 0);
  }

  return porMoneda;
}

/**
 * @description Suma de los ingresos de servicios en la moneda funcional del
 * negocio (CUP por defecto), sin mezclar las ventas en USD/MLC. Usarla en
 * totales agregados (KPIs, comparaciones, tendencias) con productos cuyo
 * precio ya va en moneda funcional.
 * @param {ServicioConMoneda[]} servicios - Ventas de servicio del período.
 * @param {string} monedaFuncional - Moneda funcional del negocio (por defecto CUP).
 * @returns {number} Total de ingresos de servicios en moneda funcional.
 */
export function ingresosServiciosFuncional(
  servicios: ServicioConMoneda[],
  monedaFuncional = 'CUP',
): number {
  const porMoneda = sumarServiciosPorMoneda(servicios, monedaFuncional);
  return porMoneda[monedaFuncional.trim().toUpperCase()] ?? 0;
}