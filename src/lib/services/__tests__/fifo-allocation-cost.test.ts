import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import { getCostoFifoVentaValorado } from '@/lib/services/fifo-allocation';

function fixture(overrides?: {
  allocations?: unknown[];
  functionalCurrency?: string | null;
}) {
  return {
    tenantAccountingPolicy: {
      findUnique: vi.fn().mockResolvedValue(
        overrides?.functionalCurrency === null
          ? null
          : { functionalCurrencyCode: overrides?.functionalCurrency ?? 'CUP' },
      ),
    },
    purchaseAllocation: {
      findMany: vi.fn().mockResolvedValue(overrides?.allocations ?? []),
    },
  };
}

function purchaseAllocation(input?: {
  currency?: string;
  functionalCurrency?: string | null;
  price?: number;
  quantity?: number;
  total?: number;
  rate?: string;
}) {
  const currency = input?.currency ?? 'CUP';
  const functionalCurrency = input?.functionalCurrency ?? 'CUP';
  const price = input?.price ?? 100;
  const quantity = input?.quantity ?? 2;
  const total = input?.total ?? price * quantity;
  const rate = input?.rate ?? '1';
  const effectiveAt = new Date('2026-09-30T00:00:00Z');
  const evidence = buildAppliedFxEvidence({
    originalAmount: total,
    originalCurrency: currency,
    functionalCurrency,
    exchangeRate: currency === functionalCurrency ? undefined : Number(rate),
    convertedAmount: currency === functionalCurrency ? undefined : total * Number(rate),
    rateEffectiveAt: currency === functionalCurrency ? undefined : effectiveAt,
    source: 'accounting-reconciliation-service',
  });

  return {
    tenantId: 'tenant-1',
    cantidad: quantity,
    compraDocumentoItem: {
      precioUnitario: price,
      compraDocumento: {
        compraDocumentoId: 'compra-1',
        tenantId: 'tenant-1',
        total,
        moneda: currency,
        tasaCambio: currency === functionalCurrency ? null : new Prisma.Decimal(rate),
        montoConvertido: currency === functionalCurrency
          ? new Prisma.Decimal(total)
          : new Prisma.Decimal(total).mul(rate),
        functionalCurrency: input?.functionalCurrency === null ? null : functionalCurrency,
        rateEffectiveAt: currency === functionalCurrency ? null : effectiveAt,
        fxProvenanceKind: evidence.fxProvenanceKind,
        fxProvenanceSource: evidence.fxProvenanceSource,
        fxCatalogRateId: evidence.fxCatalogRateId,
        fxEvidenceFingerprint: evidence.fxEvidenceFingerprint,
        fxEvidenceVersion: evidence.fxEvidenceVersion,
      },
    },
  };
}

describe('getCostoFifoVentaValorado', () => {
  it('suma los costos de compras en moneda funcional sin conversión', async () => {
    const tx = fixture({
      allocations: [
        purchaseAllocation({ price: 100, quantity: 2 }),
        purchaseAllocation({ price: 50, quantity: 3, total: 150 }),
      ],
    });

    const result = await getCostoFifoVentaValorado(tx as never, 'tenant-1', 'venta-1');

    expect(result?.monedaFuncional).toBe('CUP');
    expect(result?.montoFuncional.eq(new Prisma.Decimal('350'))).toBe(true);
    expect(tx.purchaseAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1', ventaItem: { ventaId: 'venta-1' } } }),
    );
  });

  it('convierte costo FIFO de compra extranjera con la tasa y evidencia persistidas', async () => {
    const tx = fixture({
      allocations: [purchaseAllocation({
        currency: 'USD', functionalCurrency: 'CUP', price: 100, quantity: 2,
        total: 300, rate: '24',
      })],
    });

    const result = await getCostoFifoVentaValorado(tx as never, 'tenant-1', 'venta-1');

    expect(result?.monedaFuncional).toBe('CUP');
    expect(result?.montoFuncional.eq(new Prisma.Decimal('4800'))).toBe(true);
  });

  it('agrega asignaciones de varias compras usando la tasa de cada snapshot', async () => {
    const tx = fixture({
      allocations: [
        purchaseAllocation({
          currency: 'USD', functionalCurrency: 'CUP', price: 10, quantity: 1,
          total: 100, rate: '24',
        }),
        purchaseAllocation({
          currency: 'EUR', functionalCurrency: 'CUP', price: 2, quantity: 2,
          total: 200, rate: '30',
        }),
      ],
    });

    const result = await getCostoFifoVentaValorado(tx as never, 'tenant-1', 'venta-1');

    expect(result?.montoFuncional.eq(new Prisma.Decimal('360'))).toBe(true);
  });

  it('rechaza costo extranjero sin snapshot FX completo', async () => {
    const allocation = purchaseAllocation({
      currency: 'USD', functionalCurrency: 'CUP', price: 100, quantity: 2,
      total: 200, rate: '24',
    });
    allocation.compraDocumentoItem.compraDocumento.fxEvidenceFingerprint = null;
    const tx = fixture({ allocations: [allocation] });

    await expect(getCostoFifoVentaValorado(tx as never, 'tenant-1', 'venta-1'))
      .rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
  });

  it('no infiere la moneda funcional ausente de una compra extranjera', async () => {
    const tx = fixture({
      allocations: [purchaseAllocation({
        currency: 'USD', functionalCurrency: null, price: 100, quantity: 2,
        total: 200, rate: '24',
      })],
    });

    await expect(getCostoFifoVentaValorado(tx as never, 'tenant-1', 'venta-1'))
      .rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
  });

  it('rechaza snapshot de compra con otro fingerprint', async () => {
    const allocation = purchaseAllocation({
      currency: 'USD', functionalCurrency: 'CUP', price: 100, quantity: 2,
      total: 200, rate: '24',
    });
    allocation.compraDocumentoItem.compraDocumento.fxEvidenceFingerprint = 'otro';
    const tx = fixture({ allocations: [allocation] });

    await expect(getCostoFifoVentaValorado(tx as never, 'tenant-1', 'venta-1'))
      .rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
  });

  it('rechaza costo funcional que excede cuatro decimales sin cuantizarlo', async () => {
    const tx = fixture({
      allocations: [purchaseAllocation({
        currency: 'USD', functionalCurrency: 'CUP', price: 1, quantity: 1,
        total: 1, rate: '0.12345',
      })],
    });

    await expect(getCostoFifoVentaValorado(tx as never, 'tenant-1', 'venta-1'))
      .rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
  });

  it('omite el costo si no hay asignaciones y no requiere política', async () => {
    const tx = fixture({ functionalCurrency: null });

    await expect(getCostoFifoVentaValorado(tx as never, 'tenant-1', 'venta-1'))
      .resolves.toBeNull();
    expect(tx.tenantAccountingPolicy.findUnique).not.toHaveBeenCalled();
  });
});
