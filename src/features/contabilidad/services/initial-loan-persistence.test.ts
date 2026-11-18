import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { persistInitialLoan } from './initial-loan-persistence';

vi.mock('./accounting-tenant-lock-service', () => ({ acquireAccountingTenantLock: vi.fn() }));
const tx = {
  inicializacionContable: { findFirst: vi.fn() },
  cuentaPorCobrar: { findFirst: vi.fn() },
  prestamoCash: { findFirst: vi.fn(), create: vi.fn() },
};
const input = {
  tenantId: 'tenant-a', inicializacionId: 'init-a', fechaCorte: '2026-11-01', tasas: { USD: '24' },
  monedaFuncional: 'CUP', cuentaPorCobrarId: 'cxc-1', referenciaFila: 'PREST-001',
  clienteId: 'cli-1', moneda: 'USD', saldo: '100', tasaInteres: '12', tasaInteresMoratorio: '18',
  fechaVencimiento: '2027-06-01', usuarioId: 'user-1',
};
beforeEach(() => {
  vi.clearAllMocks();
  tx.inicializacionContable.findFirst.mockResolvedValue({ inicializacionId: 'init-a' });
  tx.cuentaPorCobrar.findFirst.mockResolvedValue({
    id: 'cxc-1', clienteId: 'cli-1', monedaOriginal: 'USD',
    montoDeuda: new Prisma.Decimal(100), montoDeudaFuncional: new Prisma.Decimal(2400),
  });
  tx.prestamoCash.findFirst.mockResolvedValue(null);
  tx.prestamoCash.create.mockResolvedValue({ id: 'prest-1' });
});

describe('persistencia de préstamo otorgado en la inicialización', () => {
  it('crea el PrestamoCash con valoración a corte y política completa', async () => {
    await expect(persistInitialLoan(tx as never, input)).resolves.toMatchObject({
      cuentaPorCobrarId: 'cxc-1', prestamoCashId: 'prest-1', clienteId: 'cli-1',
      moneda: 'USD', montoOriginal: '100', montoFuncional: '2400',
    });
    expect(tx.prestamoCash.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-a', clienteId: 'cli-1', cuentaPorCobrarId: 'cxc-1',
        montoCapital: '100', moneda: 'USD',
        tasaInteres: new Prisma.Decimal(12),
        fechaOtorgamiento: new Date('2026-11-01T00:00:00.000Z'),
        fechaVencimiento: new Date('2027-06-01T00:00:00.000Z'),
        tasaCambioAlCrear: new Prisma.Decimal(24),
        cuentaBancariaId: null,
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

  it('rechaza la CxC que no existe o no coincide con la fila', async () => {
    tx.cuentaPorCobrar.findFirst.mockResolvedValue(null);
    await expect(persistInitialLoan(tx as never, input)).rejects.toMatchObject({ code: 'INITIALIZATION_INCOMPLETE' });
    tx.cuentaPorCobrar.findFirst.mockResolvedValue({
      id: 'cxc-1', clienteId: 'otro-cliente', monedaOriginal: 'USD',
      montoDeuda: new Prisma.Decimal(100), montoDeudaFuncional: new Prisma.Decimal(2400),
    });
    await expect(persistInitialLoan(tx as never, input)).rejects.toMatchObject({ code: 'INITIALIZATION_INCOMPLETE' });
    expect(tx.prestamoCash.create).not.toHaveBeenCalled();
  });

  it('rechaza el wrapper duplicado para la misma CxC', async () => {
    tx.prestamoCash.findFirst.mockResolvedValue({ id: 'prest-1' });
    await expect(persistInitialLoan(tx as never, input)).rejects.toMatchObject({ code: 'INITIALIZATION_INCOMPLETE' });
    expect(tx.prestamoCash.create).not.toHaveBeenCalled();
  });

  it('rechaza la divisa sin tasa declarada', async () => {
    await expect(persistInitialLoan(tx as never, { ...input, tasas: {} })).rejects.toMatchObject({ code: 'INITIALIZATION_FX_REQUIRED' });
    expect(tx.prestamoCash.create).not.toHaveBeenCalled();
  });
});
