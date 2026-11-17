import { describe, expect, it, vi } from 'vitest';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import { getCostoFifoVentaValorado, restaurarAllocacionesFifo } from '@/lib/services/fifo-allocation';

const fecha = new Date('2026-01-01T00:00:00.000Z');
const evidencia = JSON.stringify({
  ...buildAppliedFxEvidence({
    originalAmount: 10, originalCurrency: 'CUP', functionalCurrency: 'CUP',
    exchangeRate: 1, convertedAmount: 10, rateEffectiveAt: null,
    fxCatalogRateId: null, source: 'fifo-allocation',
  }),
  rawConvertedAmount: 10,
  rawExchangeRate: null,
});

function transaction() {
  const asignacion = {
    id: 'alloc', tenantId: 'tenant', inventarioInicialFuenteId: 'fuente-inicial',
    recepcionItemId: null, purchaseReceiptInvoiceAllocationId: null,
    cantidad: 1, costoUnitarioSnapshot: 10, fifoMonedaOrigen: 'CUP',
    fifoFechaFuente: fecha, fifoMonedaFuncional: 'CUP', fifoCostoFuncional: 10,
    fifoTasaCambio: null, fifoFechaTasa: null, fifoEvidenciaFx: evidencia,
    compraDocumentoItem: null, recepcionItem: null,
  };
  return {
    tenantAccountingPolicy: { findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }) },
    purchaseAllocation: {
      findMany: vi.fn().mockResolvedValue([asignacion]),
      update: vi.fn(), delete: vi.fn(),
    },
  };
}

describe('protección de fuente FIFO inicial todavía no verificable', () => {
  it('no acredita un snapshot aislado como costo de venta o replay', async () => {
    const tx = transaction();
    const result = await getCostoFifoVentaValorado(tx as never, 'tenant', 'venta');
    expect(result?.montoFuncional).toBeNull();
    expect(result?.fuentesSinTasa).toContain('PROCEDENCIA_FIFO_NO_VERIFICABLE');
  });

  it('no altera asignaciones al intentar devolver una fuente inicial sin verificar', async () => {
    const tx = transaction();
    await expect(restaurarAllocacionesFifo(tx as never, {
      tenantId: 'tenant', ventaItemId: 'item', cantidad: 1,
    })).rejects.toThrow('PROCEDENCIA_FIFO_NO_VERIFICABLE');
    expect(tx.purchaseAllocation.delete).not.toHaveBeenCalled();
    expect(tx.purchaseAllocation.update).not.toHaveBeenCalled();
  });
});
