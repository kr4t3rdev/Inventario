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

  it('redondea a 4 decimales el prorrateo y el convertido con tasa de 6 decimales', async () => {
    await emitirDevolucionCompra(tx, ctx, {
      devolucionId: 'dc-fx-redondeo',
      fecha: new Date('2026-11-11T12:00:00.000Z'),
      montoTotal: 33,
      montoImputado: 11,
      saldoAFavor: 22,
      moneda: 'USD',
      tasaCambio: 1.123456,
    });

    // 33 * 1.123456 = 37.074048 -> 37.074; prorrateo 37.074 * 11 / 33 = 12.358;
    // residuo 37.074 - 12.358 = 24.716. Sin redondeo el motor lanzaría
    // PRECISION_FUNCIONAL_INVALIDA al validar el evento.
    expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
      tipo: 'DEVOLUCION_COMPRA',
      montoFuncional: 37.074,
      auxiliares: { montoAplicadoCxc: 12.358, montoSaldoFavor: 24.716 },
      tasaCambio: 1.123456,
    }));
  });

  it('redondea a 4 decimales el prorrateo en misma moneda con división no exacta', async () => {
    await emitirDevolucionCompra(tx, ctx, {
      devolucionId: 'dc-prorrateo',
      fecha: new Date('2026-11-11T12:00:00.000Z'),
      montoTotal: 100.05,
      montoImputado: 33.35,
      saldoAFavor: 66.7,
      moneda: 'CUP',
      tasaCambio: 1,
    });

    // 100.05 * 33.35 / 100.05 en float es 33.350000000000001; con Decimal es 33.35.
    expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
      tipo: 'DEVOLUCION_COMPRA',
      montoFuncional: 100.05,
      auxiliares: { montoAplicadoCxc: 33.35, montoSaldoFavor: 66.7 },
    }));
  });
});
