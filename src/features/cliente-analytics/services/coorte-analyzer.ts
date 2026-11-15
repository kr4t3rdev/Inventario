/**
 * @description Análisis de cohortes para medir retención y comportamiento
 * de grupos de clientes por periodo de adquisición.
 *
 * @module features/cliente-analytics/services/coorte-analyzer
 */

export interface ClienteCohorte {
  clienteId: string;
  primeraCompra: Date;
  compras: Date[];
  totalGastado: number; // centavos
  canalAdquisicion: string;
}

export interface CohorteResult {
  periodo: string; // "2026-Q1"
  canalAdquisicion: string | null;
  totalClientes: number;
  retencionMes1: number | null; // %
  retencionMes2: number | null; // %
  retencionMes3: number | null; // %
  ltvPromedio: number | null; // centavos
  aovPromedio: number | null; // centavos
  diasHastaSegunda: number | null;
  churnRate: number | null; // %
}

/**
 * @description Analiza las cohortes de clientes por periodo de adquisición.
 * @param {ClienteCohorte[]} clientes - Datos de clientes con historial.
 * @param {Date} fechaReferencia - Fecha de corte para cálculos.
 * @returns {CohorteResult[]} Resultados por cohorte.
 */
export function analizarCohortes(
  clientes: ClienteCohorte[],
  fechaReferencia: Date = new Date()
): CohorteResult[] {
  // Agrupar por cohorte (trimestre) y canal
  const cohortes = new Map<string, ClienteCohorte[]>();
  for (const cliente of clientes) {
    const periodo = cohortePeriodo(cliente.primeraCompra);
    const key = `${periodo}||${cliente.canalAdquisicion || 'TODOS'}`;
    if (!cohortes.has(key)) {
      cohortes.set(key, []);
    }
    cohortes.get(key)!.push(cliente);
  }

  const resultados: CohorteResult[] = [];
  for (const [key, miembros] of cohortes) {
    const [periodo, canal] = key.split('||');
    resultados.push(analizarCohorteIndividual(miembros, periodo, canal, fechaReferencia));
  }

  return resultados;
}

/**
 * @description Analiza una cohorte individual.
 * @param {ClienteCohorte[]} miembros - Miembros de la cohorte.
 * @param {string} periodo - Periodo de la cohorte.
 * @param {string} canal - Canal de adquisición.
 * @param {Date} fechaReferencia - Fecha de corte.
 * @returns {CohorteResult} Métricas de la cohorte.
 */
export function analizarCohorteIndividual(
  miembros: ClienteCohorte[],
  periodo: string,
  canal: string,
  fechaReferencia: Date
): CohorteResult {
  const totalClientes = miembros.length;

  // Calcular retención por mes
  const retencionMes1 = calcularRetencion(miembros, 1, fechaReferencia);
  const retencionMes2 = calcularRetencion(miembros, 2, fechaReferencia);
  const retencionMes3 = calcularRetencion(miembros, 3, fechaReferencia);

  // CLV promedio
  const ltvPromedio = totalClientes > 0
    ? Math.round(miembros.reduce((sum, c) => sum + c.totalGastado, 0) / totalClientes)
    : null;

  // AOV promedio
  const totalCompras = miembros.reduce((sum, c) => sum + c.compras.length, 0);
  const totalGastado = miembros.reduce((sum, c) => sum + c.totalGastado, 0);
  const aovPromedio = totalCompras > 0 ? Math.round(totalGastado / totalCompras) : null;

  // Días hasta segunda compra
  const diasHastaSegunda = calcularDiasHastaSegunda(miembros);

  // Churn rate: clientes sin compra en los últimos 90 días
  const churnRate = calcularChurnRate(miembros, fechaReferencia);

  return {
    periodo,
    canalAdquisicion: canal === 'TODOS' ? null : canal,
    totalClientes,
    retencionMes1,
    retencionMes2,
    retencionMes3,
    ltvPromedio,
    aovPromedio,
    diasHastaSegunda,
    churnRate,
  };
}

/**
 * @description Calcula la retención de una cohorte en un mes dado.
 * @param {ClienteCohorte[]} miembros - Miembros de la cohorte.
 * @param {number} mes - Mes a evaluar (1, 2, 3...).
 * @param {Date} fechaReferencia - Fecha de corte.
 * @returns {number | null} Porcentaje de retención.
 */
export function calcularRetencion(
  miembros: ClienteCohorte[],
  mes: number,
  fechaReferencia: Date
): number | null {
  if (miembros.length === 0) return null;

  const mesStart = new Date(fechaReferencia);
  mesStart.setMonth(mesStart.getMonth() - mes);

  const mesEnd = new Date(fechaReferencia);
  mesEnd.setMonth(mesEnd.getMonth() - (mes - 1));

  let activos = 0;
  for (const miembro of miembros) {
    const comprasEnMes = miembro.compras.some(
      (compra) => compra >= mesStart && compra < mesEnd
    );
    if (comprasEnMes) activos++;
  }

  return Math.round((activos / miembros.length) * 10000) / 100;
}

/**
 * @description Calcula los días promedio hasta la segunda compra.
 * @param {ClienteCohorte[]} miembros - Miembros de la cohorte.
 * @returns {number | null} Días promedio o null.
 */
export function calcularDiasHastaSegunda(miembros: ClienteCohorte[]): number | null {
  const segundasCompras = miembros
    .filter((c) => c.compras.length >= 2)
    .map((c) => {
      const sorted = [...c.compras].sort((a, b) => a.getTime() - b.getTime());
      const diff = sorted[1].getTime() - sorted[0].getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    });

  if (segundasCompras.length === 0) return null;
  return Math.round(segundasCompras.reduce((sum, d) => sum + d, 0) / segundasCompras.length);
}

/**
 * @description Calcula la tasa de churn de una cohorte.
 * @param {ClienteCohorte[]} miembros - Miembros de la cohorte.
 * @param {Date} fechaReferencia - Fecha de corte.
 * @returns {number | null} Porcentaje de churn.
 */
export function calcularChurnRate(miembros: ClienteCohorte[], fechaReferencia: Date): number | null {
  if (miembros.length === 0) return null;

  const dias90 = new Date(fechaReferencia);
  dias90.setDate(dias90.getDate() - 90);

  let inactivos = 0;
  for (const miembro of miembros) {
    const ultimaCompra = miembro.compras.sort(
      (a, b) => b.getTime() - a.getTime()
    )[0];
    if (ultimaCompra < dias90) inactivos++;
  }

  return Math.round((inactivos / miembros.length) * 10000) / 100;
}

/**
 * @description Determina el periodo de cohorte de una fecha.
 * @param {Date} fecha - Fecha de primera compra.
 * @returns {string} Periodo en formato "YYYY-QN".
 */
export function cohortePeriodo(fecha: Date): string {
  const year = fecha.getFullYear();
  const quarter = Math.floor(fecha.getMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}
