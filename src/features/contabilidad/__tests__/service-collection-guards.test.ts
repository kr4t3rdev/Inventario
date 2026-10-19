import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@/generated/prisma';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
import {
  assertServiceCollectionTargets,
  validateServiceCollectionInput,
} from '@/features/contabilidad/services/accounting-reconciliation-service';

const input = { ventaServicioId: 'sale-1', distribuciones: [
  { cuentaId: 'bank-1', tipoPagoId: 'payment-1', monto: 100, moneda: 'CUP' },
] };
const client = {
  ventaServicios: { findFirst: vi.fn() },
  reconciliacionServicio: { findFirst: vi.fn() },
  cuentaBancaria: { count: vi.fn() },
  tipoPago: { count: vi.fn() },
};

describe('service collection security guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.ventaServicios.findFirst.mockResolvedValue({ total: 100, reconciliado: false });
    client.reconciliacionServicio.findFirst.mockResolvedValue(null);
    client.cuentaBancaria.count.mockResolvedValue(1);
    client.tipoPago.count.mockResolvedValue(1);
  });

  it.each([NaN, Infinity, -1, 0])('rejects nonpositive or nonfinite amount %s', (monto) => {
    expect(() => validateServiceCollectionInput({
      ...input, distribuciones: [{ ...input.distribuciones[0], monto }],
    })).toThrow('Datos de cobro de servicio inválidos');
  });

  it.each([
    { ...input, ventaServicioId: ' ' },
    { ...input, distribuciones: [] },
    { ...input, distribuciones: [{ ...input.distribuciones[0], cuentaId: '' }] },
    { ...input, distribuciones: [{ ...input.distribuciones[0], tipoPagoId: '' }] },
    { ...input, fechaReconciliacion: 'not-a-date' },
  ])('rejects malformed identifiers, distributions or date', (invalid) => {
    expect(() => validateServiceCollectionInput(invalid)).toThrow('Datos de cobro de servicio inválidos');
  });

  it('checks each persisted target explicitly within the authenticated tenant', async () => {
    expect(await assertServiceCollectionTargets(
      client as unknown as Prisma.TransactionClient, 'tenant-1', input,
    )).toBe(100);
    expect(client.ventaServicios.findFirst).toHaveBeenCalledWith({
      where: { ventaServicioId: 'sale-1', tenantId: 'tenant-1' },
      select: { total: true, reconciliado: true },
    });
    expect(client.cuentaBancaria.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', cuentaId: { in: ['bank-1'] } },
    });
    expect(client.tipoPago.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', tipoId: { in: ['payment-1'] } },
    });
  });

  it.each(['sale', 'bank', 'payment', 'already-paid', 'existing-receipt'])(
    'fails closed for %s', async (target) => {
      if (target === 'sale') client.ventaServicios.findFirst.mockResolvedValue(null);
      if (target === 'bank') client.cuentaBancaria.count.mockResolvedValue(0);
      if (target === 'payment') client.tipoPago.count.mockResolvedValue(0);
      if (target === 'already-paid') {
        client.ventaServicios.findFirst.mockResolvedValue({ total: 100, reconciliado: true });
      }
      if (target === 'existing-receipt') {
        client.reconciliacionServicio.findFirst.mockResolvedValue({ reconciliacionId: 'receipt-1' });
      }
      await expect(assertServiceCollectionTargets(
        client as unknown as Prisma.TransactionClient, 'tenant-1', input,
      )).rejects.toThrow();
    },
  );
});
