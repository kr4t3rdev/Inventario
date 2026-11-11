import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../posting-engine', () => ({ postEvento: vi.fn() }));

import { postEvento } from '../posting-engine';
import { emitirDevolucionCompra } from '../supplier-return-posting-service';
import type { PostingTx } from '../posting-engine';

describe('emitirDevolucionCompra', () => {
  const txMock = { tenantAccountingPolicy: { findUnique: vi.fn() } };
  const tx = txMock as unknown as PostingTx;
  const ctx = { tenantId: 'tenant-1', userId: 'user-1' };

  beforeEach(() => {
    vi.clearAllMocks();
    txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
    vi.mocked(postEvento).mockResolvedValue({ estado: 'OMITIDO', motivo: 'MODO_OFF' });
  });

  it('registra la devolución y separa la imputación a CxP del saldo a favor', async () => {
    const fecha = new Date('2026-11-11T12:00:00.000Z');

    await emitirDevolucionCompra(tx, ctx, {
      devolucionId: 'dc-1',
      fecha,
      montoTotal: 1200,
      montoImputado: 700,
      saldoAFavor: 500,
      moneda: 'CUP',
      tasaCambio: 1,
    });

    expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
      tipo: 'DEVOLUCION_COMPRA',
      origen: { tipo: 'devolucion_compra', id: 'dc-1' },
      fecha,
      monto: 1200,
      moneda: 'CUP',
      montoFuncional: 1200,
      auxiliares: { montoAplicadoCxc: 700, montoSaldoFavor: 500 },
    }));
  });

  it('no finge valoración funcional cuando falta la tasa en moneda extranjera', async () => {
    await emitirDevolucionCompra(tx, ctx, {
      devolucionId: 'dc-usd',
      fecha: new Date('2026-11-11T12:00:00.000Z'),
      montoTotal: 100,
      montoImputado: 100,
      saldoAFavor: 0,
      moneda: 'USD',
    });

    expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
      tipo: 'DEVOLUCION_COMPRA',
      montoFuncional: null,
      monedaFuncional: 'CUP',
    }));
  });

  it('conserva el reparto funcional entre CxP y saldo a favor en moneda extranjera', async () => {
    await emitirDevolucionCompra(tx, ctx, {
      devolucionId: 'dc-fx',
      fecha: new Date('2026-11-11T12:00:00.000Z'),
      montoTotal: 100,
      montoImputado: 50,
      montoImputadoFuncional: 1250,
      saldoAFavor: 50,
      moneda: 'USD',
      tasaCambio: 25,
    });

    expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
      tipo: 'DEVOLUCION_COMPRA',
      montoFuncional: 2500,
      auxiliares: { montoAplicadoCxc: 1250, montoSaldoFavor: 1250 },
      tasaCambio: 25,
    }));
  });
});
