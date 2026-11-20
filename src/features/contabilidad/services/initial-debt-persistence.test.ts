import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { persistInitialDebt } from './initial-debt-persistence';

vi.mock('./accounting-tenant-lock-service', () => ({ acquireAccountingTenantLock: vi.fn() }));
const tx = {
  inicializacionContable: { findFirst: vi.fn() },
  vendor: { findFirst: vi.fn() },
  cuentaPorPagar: { create: vi.fn() },
  deudaCash: { create: vi.fn() },
};
const input = {
  tenantId: 'tenant-a', inicializacionId: 'init-a', fechaCorte: '2026-11-01', tasas: { USD: '24' },
  monedaFuncional: 'CUP', numeroCuenta: 'DEU-001', moneda: 'USD', saldoInicial: '100',
  tercero: 'Prestamista QA', proveedorId: 'vendor-a', tasaInteres: '12', tasaInteresMoratorio: '18',
  fechaVencimiento: '2027-06-01', cuentaBancariaId: 'banco-1', inyeccionId: 'iny-1', usuarioId: 'user-1',
};
beforeEach(() => {
  vi.clearAllMocks();
  tx.inicializacionContable.findFirst.mockResolvedValue({ inicializacionId: 'init-a' });
  tx.vendor.findFirst.mockResolvedValue({ vendorId: 'vendor-a' });
  tx.cuentaPorPagar.create.mockResolvedValue({ cuentaPorPagarId: 'cxp-1' });
  tx.deudaCash.create.mockResolvedValue({ id: 'deuda-1' });
});

describe('persistencia de deuda recibida en la inicialización', () => {
  it('crea la CxP y el DeudaCash con valoración a corte y política completa', async () => {
    await expect(persistInitialDebt(tx as never, input)).resolves.toMatchObject({
      cuentaPorPagarId: 'cxp-1', deudaCashId: 'deuda-1', inyeccionId: 'iny-1',
      proveedorId: 'vendor-a', moneda: 'USD', montoOriginal: '100', montoFuncional: '2400',
    });
    expect(tx.cuentaPorPagar.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-a', inicializacionId: 'init-a', referenciaInicial: 'DEUDA:DEU-001',
        referenciaExternaInicial: 'Prestamista QA', proveedorId: 'vendor-a', tipo: 'inicial_externa',
        numeroFactura: null, montoDeuda: '100', saldoPendiente: '100',
        montoDeudaFuncional: '2400', montoPagado: '0', montoPagadoFuncional: '0',
        moneda: 'USD', monedaOriginal: 'USD', monedaFuncional: 'CUP',
        tasaCambio: '24', fxProvenanceKind: 'MANUAL_GOVERNED',
        fxProvenanceSource: 'INICIALIZACION_CONTABLE', fxEvidenceVersion: 1,
        fxEvidenceFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
        estado: 'PENDIENTE',
      }),
      select: { cuentaPorPagarId: true },
    });
    expect(tx.deudaCash.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-a', proveedorId: 'vendor-a', cuentaPorPagarId: 'cxp-1',
        inyeccionId: 'iny-1', montoCapital: '100', moneda: 'USD',
        ordinaryAnnualRate: new Prisma.Decimal(12),
        moratoryAnnualRate: new Prisma.Decimal(18),
        cashInterestPolicyVersion: 1,
        cashInterestGrantDate: new Date('2026-11-01T00:00:00.000Z'),
        cashInterestAccruedThroughDate: new Date('2026-11-01T00:00:00.000Z'),
        cashInterestPrincipalRemaining: new Prisma.Decimal(100),
        estado: 'ACTIVO',
      }),
      select: { id: true },
    });
  });
  it('rechaza inicialización ajena o inactiva', async () => {
    tx.inicializacionContable.findFirst.mockResolvedValue(null);
    await expect(persistInitialDebt(tx as never, input)).rejects.toThrow();
    expect(tx.cuentaPorPagar.create).not.toHaveBeenCalled();
    expect(tx.deudaCash.create).not.toHaveBeenCalled();
  });
  it('rechaza proveedor ajeno', async () => {
    tx.vendor.findFirst.mockResolvedValue(null);
    await expect(persistInitialDebt(tx as never, input)).rejects.toThrow();
    expect(tx.cuentaPorPagar.create).not.toHaveBeenCalled();
    expect(tx.deudaCash.create).not.toHaveBeenCalled();
  });
  it('rechaza divisa sin tasa', async () => {
    await expect(persistInitialDebt(tx as never, { ...input, tasas: {} })).rejects.toThrow();
    expect(tx.cuentaPorPagar.create).not.toHaveBeenCalled();
    expect(tx.deudaCash.create).not.toHaveBeenCalled();
  });
});
