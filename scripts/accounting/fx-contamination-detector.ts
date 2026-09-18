/**
 * @description Detector de reconciliaciones históricas contaminadas por
 * hardcode de moneda (fase MM-4.5).
 *
 * Historia: antes de la corrección multimonreda, las reconciliaciones
 * automáticas por anticipo etiquetaban cualquier anticipo como CUP o USD
 * según el hardcode `'COBRO'?'CUP':'USD'`, mezclando monedas distintas.
 * Ese error contamina reportes históricos.
 *
 * Este módulo **no escribe nada**; solo clasifica filas como:
 * - FX_MISMATCH: fila automática claramente contaminada (prioridad para
 *   backfill manual con tasas de la época).
 * - REVISAR_HUMANO: mismatch pero hubo intervención manual de un operador
 *   (reconciliadoPor distinto de 'system'); puede haber sido intencional.
 */

export interface ReconciliacionSnapshot {
  reconciliacionId: string;
  moneda: string;
  anticipoMoneda: string;
  monto: number;
  tipo: string;
  reconciliadoPor?: string | null;
  tasaCambio?: number | null;
}

export interface ContaminationFinding {
  reconciliacionId: string;
  deteccion: 'FX_MISMATCH' | 'REVISAR_HUMANO';
  monedaFila: string;
  monedaAnticipo: string;
  monto: number;
  tipo: string;
}

export interface ContaminationReport {
  total: number;
  contaminated: ContaminationFinding[];
  clean: ReconciliacionSnapshot[];
}

function normalizarMoneda(codigo: string | null | undefined): string {
  return (codigo ?? '').trim().toUpperCase();
}

/**
 * @description Clasifica snapshots de reconciliación como limpias o sospechosas.
 * @param {ReconciliacionSnapshot[]} snapshots - Filas con moneda persistida y del anticipo.
 * @returns {ContaminationReport} Reporte seguro de corrida; no muta nada.
 */
export function detectContaminatedReconciliaciones(
  snapshots: ReconciliacionSnapshot[],
): ContaminationReport {
  const contaminated: ContaminationFinding[] = [];
  const clean: ReconciliacionSnapshot[] = [];

  for (const row of snapshots) {
    const monedaFila = normalizarMoneda(row.moneda);
    const monedaAnticipo = normalizarMoneda(row.anticipoMoneda);

    if (monedaFila === monedaAnticipo) {
      clean.push(row);
      continue;
    }

    // Una tasa ya persistida y explícita sugiere que la discrepancia fue
    // conocida y tratada con conversión — no es contaminación automática.
    const hayTasaAplicada =
      row.tasaCambio != null && Number.isFinite(row.tasaCambio) && row.tasaCambio !== 1;
    if (hayTasaAplicada) {
      clean.push(row);
      continue;
    }

    contaminated.push({
      reconciliacionId: row.reconciliacionId,
      deteccion:
        row.reconciliadoPor && row.reconciliadoPor !== 'system'
          ? 'REVISAR_HUMANO'
          : 'FX_MISMATCH',
      monedaFila,
      monedaAnticipo,
      monto: row.monto,
      tipo: row.tipo,
    });
  }

  return { total: snapshots.length, contaminated, clean };
}
