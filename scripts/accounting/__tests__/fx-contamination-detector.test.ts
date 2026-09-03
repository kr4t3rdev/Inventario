import { describe, it, expect } from 'vitest';
import { detectContaminatedReconciliaciones, type ReconciliacionSnapshot } from '../fx-contamination-detector';

/**
 * Filas donde la moneda persistida no coincide con la moneda del anticipo de origen.
 * Criterio: fila de reconciliación de cobro anticipado (tipo COBRO / PAGO),
 * y la moneda distinta no es explicable por una conversión ya persistida
 * (tasaCambio no nula y distinta de 1 en ambas filas).
 */
describe('fx-contamination-detector', () => {
  it('reporta el mismatch de moneda como contaminated (sin tocar la fila)', () => {
    const snapshots: ReconciliacionSnapshot[] = [
      { reconciliacionId: 'r1', moneda: 'CUP', anticipoMoneda: 'USD', monto: 100, tipo: 'COBRO' },
      { reconciliacionId: 'r2', moneda: 'CUP', anticipoMoneda: 'CUP', monto: 200, tipo: 'COBRO' },
      { reconciliacionId: 'r3', moneda: 'USD', anticipoMoneda: 'USD', monto: 300, tipo: 'COBRO' },
    ];

    const result = detectContaminatedReconciliaciones(snapshots);

    expect(result.contaminated).toHaveLength(1);
    expect(result.contaminated[0].reconciliacionId).toBe('r1');
    expect(result.contaminated[0].deteccion).toBe('FX_MISMATCH');
    expect(result.clean).toHaveLength(2);
  });

  it('devuelve vacío para historial limpio', () => {
    const result = detectContaminatedReconciliaciones([]);
    expect(result.contaminated).toHaveLength(0);
    expect(result.clean).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('marca validación humana cuando el pago fue manual', () => {
    const rows: ReconciliacionSnapshot[] = [
      { reconciliacionId: 'r4', moneda: 'CUP', anticipoMoneda: 'USD', monto: 100, tipo: 'COBRO', reconciliadoPor: 'admin-1' },
      { reconciliacionId: 'r5', moneda: 'CUP', anticipoMoneda: 'USD', monto: 100, tipo: 'COBRO', reconciliadoPor: 'system' },
    ];
    const result = detectContaminatedReconciliaciones(rows);
    // Ambas son sospechosas; la manual se clasifica como REVISAR_HUMANO.
    expect(result.contaminated).toHaveLength(2);
    expect(result.contaminated.some((c) => c.reconciliacionId === 'r5' && c.deteccion === 'FX_MISMATCH')).toBe(true);
    expect(result.contaminated.some((c) => c.reconciliacionId === 'r4' && c.deteccion === 'REVISAR_HUMANO')).toBe(true);
  });
});
