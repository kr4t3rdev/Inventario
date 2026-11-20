import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistInitialPayables } from './initial-payables-persistence';

vi.mock('./accounting-tenant-lock-service', () => ({ acquireAccountingTenantLock: vi.fn() }));
const tx = {
  inicializacionContable: { findFirst: vi.fn() },
  tenantAccountingPolicy: { findUnique: vi.fn() },
  moneda: { findMany: vi.fn() },
  vendor: { findMany: vi.fn() },
  cuentaPorPagar: { createMany: vi.fn() },
};
const input = { tenantId: 'tenant-a', inicializacionId: 'init-a', cuentas: [
  { referenciaFila: 'fila-1', proveedorId: 'vendor-a', moneda: 'CUP', saldo: '125.25' },
] };
beforeEach(() => {
  vi.clearAllMocks();
  tx.inicializacionContable.findFirst.mockResolvedValue({ inicializacionId: 'init-a' });
  tx.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
  tx.moneda.findMany.mockResolvedValue([{ codigo: 'CUP' }]);
  tx.vendor.findMany.mockResolvedValue([{ vendorId: 'vendor-a' }]);
  tx.cuentaPorPagar.createMany.mockResolvedValue({ count: 1 });
});

describe('persistencia de CxP iniciales externas', () => {
  it('guarda deuda funcional sin factura ni compra', async () => {
    await expect(persistInitialPayables(tx as never, input)).resolves.toMatchObject({
      count: 1, totalFuncional: '125.25',
      filas: [{ referenciaFila: 'fila-1', moneda: 'CUP', montoOriginal: '125.25', montoFuncional: '125.25' }],
    });
    expect(tx.cuentaPorPagar.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({
      tenantId: 'tenant-a', inicializacionId: 'init-a', referenciaInicial: 'fila-1',
      proveedorId: 'vendor-a', tipo: 'inicial_externa', numeroFactura: null,
      gastoCompraId: null, gastosDEId: null, montoDeuda: '125.25', saldoPendiente: '125.25',
      montoDeudaFuncional: '125.25', montoPagado: '0', montoPagadoFuncional: '0',
      moneda: 'CUP', monedaOriginal: 'CUP', monedaFuncional: 'CUP',
      tasaCambio: '1', rateEffectiveAt: null, fxProvenanceKind: 'SAME_CURRENCY',
      fxProvenanceSource: 'INICIALIZACION_CONTABLE', fxEvidenceVersion: 1,
      fxEvidenceFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
    })] });
  });
  it('rechaza inicialización ajena o inactiva', async () => {
    tx.inicializacionContable.findFirst.mockResolvedValue(null);
    await expect(persistInitialPayables(tx as never, input)).rejects.toThrow();
    expect(tx.cuentaPorPagar.createMany).not.toHaveBeenCalled();
  });
  it('rechaza proveedor ajeno', async () => {
    tx.vendor.findMany.mockResolvedValue([]);
    await expect(persistInitialPayables(tx as never, input)).rejects.toThrow();
    expect(tx.cuentaPorPagar.createMany).not.toHaveBeenCalled();
  });
  it('rechaza moneda extranjera sin evidencia', async () => {
    await expect(persistInitialPayables(tx as never, { ...input, cuentas: [
      { ...input.cuentas[0], moneda: 'USD' },
    ] })).rejects.toThrow();
    expect(tx.cuentaPorPagar.createMany).not.toHaveBeenCalled();
  });
  it('rechaza moneda inactiva y política inexistente', async () => {
    tx.moneda.findMany.mockResolvedValue([]);
    await expect(persistInitialPayables(tx as never, input)).rejects.toThrow();
    tx.tenantAccountingPolicy.findUnique.mockResolvedValue(null);
    await expect(persistInitialPayables(tx as never, input)).rejects.toThrow();
    expect(tx.cuentaPorPagar.createMany).not.toHaveBeenCalled();
  });
  it('rechaza filas duplicadas', async () => {
    await expect(persistInitialPayables(tx as never, { ...input, cuentas: [
      input.cuentas[0], input.cuentas[0],
    ] })).rejects.toThrow();
    expect(tx.cuentaPorPagar.createMany).not.toHaveBeenCalled();
  });
});
