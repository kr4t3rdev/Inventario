/**
 * @description Rotación de inventario por producto y periodo sobre el kardex.
 * Numerador: unidades salidas del periodo. Denominador: existencias promedio
 * ((saldo inicial + saldo final) / 2). Periodo semiabierto [inicio, fin) en UTC.
 * Con existencias y sin salidas la rotación es 0; sin existencias es `null`.
 */
export interface RotacionProducto {
  productoId: string;
  productoNombre: string;
  unidadesSalidas: number;
  existenciasPromedio: number;
  /** Veces que rotó el stock en el periodo; `null` si no hay existencias. */
  rotacion: number | null;
  sinExistencias: boolean;
}

export type PeriodoRotacion = { inicio: Date; fin: Date };
export type SaldosKardexPeriodo = {
  /** Suma neta de `cantidad` antes del inicio del periodo. */
  inicial: Map<string, number>;
  /** Suma neta de `cantidad` al cierre del periodo. */
  final: Map<string, number>;
  /** Suma de `cantidad` de las salidas del periodo (valores negativos). */
  salidas: Map<string, number>;
};

/**
 * @description Resuelve el periodo semiabierto del reporte en UTC.
 * @param {Date} fechaDesde - Primer día incluido. @param {Date} fechaHasta - Último día incluido.
 * @returns {PeriodoRotacion} Inicio inclusivo y fin exclusivo en UTC.
 */
export function resolverPeriodoRotacion(fechaDesde: Date, fechaHasta: Date): PeriodoRotacion {
  const inicio = new Date(`${fechaDesde.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const fin = new Date(`${fechaHasta.toISOString().slice(0, 10)}T00:00:00.000Z`);
  fin.setUTCDate(fin.getUTCDate() + 1);
  return { inicio, fin };
}

/**
 * @description Calcula la rotación de cada producto a partir de los saldos de kardex.
 * @param {SaldosKardexPeriodo} saldos - Saldos de apertura, cierre y salidas del periodo.
 * @param {Map<string, string>} nombres - Nombre de cada producto por id.
 * @param {PeriodoRotacion} periodo - Periodo ya resuelto (fin exclusivo).
 * @returns {RotacionInventario} Rotación por producto, de mayor a menor.
 */
export function calcularRotacionInventario(
  saldos: SaldosKardexPeriodo,
  nombres: Map<string, string>,
  periodo: PeriodoRotacion,
) {
  const porProducto: RotacionProducto[] = [];
  for (const [productoId, existenciasFinales] of saldos.final) {
    const existenciasIniciales = saldos.inicial.get(productoId) ?? 0;
    const unidadesSalidas = Math.abs(saldos.salidas.get(productoId) ?? 0);
    const existenciasPromedio = (existenciasIniciales + existenciasFinales) / 2;
    if (existenciasPromedio <= 0 && unidadesSalidas === 0) continue;
    porProducto.push({
      productoId, productoNombre: nombres.get(productoId) ?? 'Sin nombre', unidadesSalidas, existenciasPromedio,
      rotacion: existenciasPromedio > 0 ? Math.round((unidadesSalidas / existenciasPromedio) * 100) / 100 : null,
      sinExistencias: existenciasPromedio <= 0,
    });
  }
  porProducto.sort((a, b) => (b.rotacion ?? -1) - (a.rotacion ?? -1) || a.productoNombre.localeCompare(b.productoNombre));
  return {
    periodo: { inicio: periodo.inicio.toISOString(), fin: periodo.fin.toISOString() },
    definicion: 'Salidas del periodo / existencias promedio ((saldo inicial + saldo final) / 2). Periodo [inicio, fin) en UTC. Sin existencias: null.',
    porProducto,
  };
}

export type RotacionInventario = ReturnType<typeof calcularRotacionInventario>;
