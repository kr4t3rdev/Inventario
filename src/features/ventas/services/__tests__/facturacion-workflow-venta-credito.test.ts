import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';
import type { ExactAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import { ActionError } from '@/lib/server-actions';

const postEventoMock = vi.hoisted(() => vi.fn());
const getRateAsOfExactMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/features/contabilidad/services/accounting-reconciliation-service', () => ({
  buildPersistedAccountingAmount: vi.fn(),
}));
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
  postEvento: postEventoMock,
}));
vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => ({
  exchangeRateProvider: { getRateAsOfExact: getRateAsOfExactMock },
}));

import { applyFacturacionCobroWorkflow } from '@/features/ventas/services/facturacion-workflow';
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';

const originalFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;

/**
 * @description Construye un cliente transaccional falso sin conexión a la base
 * de datos, junto con los parámetros de una facturación a crédito.
 * @param {object} opciones - Moneda y valoración explícitas de la factura.
 * @param {string} [opciones.monedaCuenta] - Moneda de una cuenta irrelevante para crédito.
 * @param {string | null} [opciones.funcional] - Moneda funcional de la política del tenant.
 * @param {string} [opciones.monedaOriginal] - Moneda explícita de la factura.
 * @param {ExactAppliedFxEvidence} [opciones.valoracion] - Evidencia FX del caller.
 * @returns {object} Cliente transaccional y parámetros del workflow.
 */
function fixtureCredito(opciones?: {
  monedaCuenta?: string;
  funcional?: string | null;
  monedaOriginal?: string;
  valoracion?: ExactAppliedFxEvidence;
}) {
  const tx = {
    cuentaPorCobrar: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(({ create }) =>
        Promise.resolve({ id: 'cxc-1', ...create }),
      ),
    },
    factura: { update: vi.fn().mockResolvedValue({}) },
    cuentaBancaria: {
      findFirst: vi.fn().mockResolvedValue({
        cuentaId: 'cuenta-1',
        moneda: opciones?.monedaCuenta ?? 'CUP',
        tipoCuenta: null,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    tipoPago: {
      findMany: vi.fn().mockResolvedValue([
        { tipoId: 'tipo-1', nombre: 'Efectivo', cuentaDefecto: null },
      ]),
    },
    tenantAccountingPolicy: {
      findUnique: vi.fn().mockResolvedValue(
        opciones?.funcional === null
          ? null
          : { functionalCurrencyCode: opciones?.funcional ?? 'CUP' },
      ),
    },
    reconciliacionVenta: {
      create: vi.fn().mockResolvedValue({ reconciliacionId: 'rec-1' }),
    },
  };
  const params = {
    ventaId: 'venta-9',
    facturaId: 'factura-9',
    clienteId: 'cliente-9',
    montoTotal: 900,
    usuarioId: 'usuario-9',
    tenantId: 'tenant-9',
    tipoVencimiento: 'plazo',
    ...(opciones?.monedaOriginal ? { monedaOriginal: opciones.monedaOriginal } : {}),
    ...(opciones?.valoracion ? { valoracion: opciones.valoracion } : {}),
  };
  return { tx, params };
}

describe('writer VENTA_CREDITO con valoración autoritativa (R6.1/R0.5 fila 3)', () => {
  beforeEach(() => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    vi.clearAllMocks();
    postEventoMock.mockResolvedValue({ estado: 'CONTABILIZADO', asientoId: 'asiento-1' });
    getRateAsOfExactMock.mockResolvedValue(null);
  });

  afterEach(() => {
    if (originalFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
    else process.env.CONTABILIDAD_FORMAL_MODE = originalFormalMode;
  });

  it('persista el snapshot de valoración en la CxC y emite el evento valorado (CUP explícito)', async () => {
    const { tx, params } = fixtureCredito();
    await applyFacturacionCobroWorkflow(tx as never, { ...params });

    expect(tx.cuentaPorCobrar.upsert).toHaveBeenCalledOnce();
    const { create, update } = tx.cuentaPorCobrar.upsert.mock.calls[0][0];
    expect(create.monedaOriginal).toBe('CUP');
    expect(create.montoOriginal).toBe('900');
    expect((create.montoDeudaFuncional as Prisma.Decimal).toFixed()).toBe('900');
    expect(create.monedaFuncional).toBe('CUP');
    expect(create.fxEvidenceJson).toMatchObject({
      fxProvenanceKind: 'SAME_CURRENCY',
      originalCurrency: 'CUP',
      functionalCurrency: 'CUP',
      fxEvidenceVersion: 2,
    });
    expect(update.monedaOriginal).toBeUndefined();

    expect(postEventoMock).toHaveBeenCalledOnce();
    const [, , evento] = postEventoMock.mock.calls[0];
    expect(evento).toMatchObject({
      tipo: 'VENTA_CREDITO',
      monto: '900',
      moneda: 'CUP',
      monedaFuncional: 'CUP',
      fxEvidenceFingerprint: expect.any(String),
      origen: { tipo: 'factura', id: 'factura-9' },
    });
    expect((evento.montoFuncional as Prisma.Decimal).toFixed()).toBe('900');
    expect((evento.tasaCambio as Prisma.Decimal).toFixed()).toBe('1');
  });

  it('crédito funcional no requiere banco ni tipo de pago', async () => {
    const { tx, params } = fixtureCredito();
    tx.cuentaBancaria.findFirst.mockResolvedValue(null);
    tx.tipoPago.findMany.mockResolvedValue([]);

    await expect(applyFacturacionCobroWorkflow(tx as never, { ...params }))
      .resolves.toMatchObject({ tipoVencimiento: 'plazo', reconciliacionId: null });

    expect(tx.cuentaBancaria.findFirst).not.toHaveBeenCalled();
    expect(tx.tipoPago.findMany).not.toHaveBeenCalled();
    expect(tx.cuentaPorCobrar.upsert).toHaveBeenCalledOnce();
    expect(tx.cuentaPorCobrar.upsert.mock.calls[0][0].create.monedaOriginal).toBe('CUP');
    expect(postEventoMock).toHaveBeenCalledOnce();
  });

  it('modo off conserva crédito sin política, FX, banco ni tipo de pago', async () => {
    const previousMode = process.env.CONTABILIDAD_FORMAL_MODE;
    process.env.CONTABILIDAD_FORMAL_MODE = 'off';
    try {
      const { tx, params } = fixtureCredito({ funcional: null });
      tx.cuentaBancaria.findFirst.mockResolvedValue(null);
      tx.tipoPago.findMany.mockResolvedValue([]);

      await expect(applyFacturacionCobroWorkflow(tx as never, { ...params }))
        .resolves.toMatchObject({ tipoVencimiento: 'plazo', reconciliacionId: null });

      expect(tx.tenantAccountingPolicy.findUnique).not.toHaveBeenCalled();
      expect(tx.cuentaPorCobrar.upsert).toHaveBeenCalledOnce();
      expect(tx.cuentaPorCobrar.upsert.mock.calls[0][0].create.monedaOriginal).toBeUndefined();
      expect(tx.factura.update).toHaveBeenCalledOnce();
      expect(postEventoMock).toHaveBeenCalledOnce();
      const [, , evento] = postEventoMock.mock.calls[0];
      expect(evento).toMatchObject({
        tipo: 'VENTA_CREDITO',
        moneda: null,
        montoFuncional: null,
        monedaFuncional: null,
      });
    } finally {
      if (previousMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
      else process.env.CONTABILIDAD_FORMAL_MODE = previousMode;
    }
  });

  it('modo off no rechaza una CxC histórica sin snapshot formal', async () => {
    const previousMode = process.env.CONTABILIDAD_FORMAL_MODE;
    process.env.CONTABILIDAD_FORMAL_MODE = 'off';
    try {
      const { tx, params } = fixtureCredito({ funcional: null });
      tx.cuentaBancaria.findFirst.mockResolvedValue(null);
      tx.tipoPago.findMany.mockResolvedValue([]);
      tx.cuentaPorCobrar.upsert.mockResolvedValue({
        monedaOriginal: 'USD',
        montoOriginal: new Prisma.Decimal('900'),
        montoDeudaFuncional: null,
        monedaFuncional: null,
        tasaCambio: null,
        rateEffectiveAt: null,
        fxProvenanceKind: null,
        fxProvenanceSource: null,
        fxCatalogRateId: null,
        fxEvidenceJson: null,
        fxEvidenceFingerprint: null,
        fxEvidenceVersion: null,
      });

      await expect(applyFacturacionCobroWorkflow(tx as never, { ...params }))
        .resolves.toMatchObject({ tipoVencimiento: 'plazo', reconciliacionId: null });

      expect(tx.tenantAccountingPolicy.findUnique).not.toHaveBeenCalled();
      expect(postEventoMock).toHaveBeenCalledOnce();
      const [, , evento] = postEventoMock.mock.calls[0];
      expect(evento).toMatchObject({ moneda: null, montoFuncional: null, monedaFuncional: null });
    } finally {
      if (previousMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
      else process.env.CONTABILIDAD_FORMAL_MODE = previousMode;
    }
  });

  it('factura extranjera (USD) hereda la tasa histórica y el fingerprint del catálogo', async () => {
    const vigencia = new Date('2026-09-30T00:00:00Z');
    const valoracion = buildAppliedFxEvidenceExact({
      originalAmount: '900.0000',
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: '24.0000000000',
      rateEffectiveAt: vigencia,
      source: 'facturacion-venta-credito-cxc',
      fxCatalogRateId: 'tasa-usd',
      fxProvenanceKind: 'CATALOG_RATE',
    });
    const { tx, params } = fixtureCredito({ monedaOriginal: 'USD', valoracion });
    tx.cuentaBancaria.findFirst.mockResolvedValue(null);
    tx.tipoPago.findMany.mockResolvedValue([]);

    await applyFacturacionCobroWorkflow(tx as never, { ...params });

    const { create } = tx.cuentaPorCobrar.upsert.mock.calls[0][0];
    const canonico = buildAppliedFxEvidenceExact({
      originalAmount: '900.0000',
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: '24.0000000000',
      rateEffectiveAt: vigencia,
      source: 'facturacion-venta-credito-cxc',
      fxCatalogRateId: 'tasa-usd',
      fxProvenanceKind: 'CATALOG_RATE',
    });
    expect(create.monedaOriginal).toBe('USD');
    expect(create.montoOriginal).toBe('900');
    expect((create.montoDeudaFuncional as Prisma.Decimal).toFixed()).toBe('21600');
    expect(create.monedaFuncional).toBe('CUP');
    expect((create.tasaCambio as Prisma.Decimal).toFixed()).toBe('24');
    expect(create.rateEffectiveAt).toEqual(vigencia);
    expect(create.fxProvenanceKind).toBe('CATALOG_RATE');
    expect(create.fxProvenanceSource).toBe('facturacion-venta-credito-cxc');
    expect(create.fxCatalogRateId).toBe('tasa-usd');
    expect(create.fxEvidenceFingerprint).toBe(canonico.evidence.fxEvidenceFingerprint);
    expect(create.fxEvidenceVersion).toBe(2);
    expect(create.fxEvidenceJson).toEqual(canonico.evidence);

    const [, , evento] = postEventoMock.mock.calls[0];
    expect(evento).toMatchObject({
      tipo: 'VENTA_CREDITO',
      moneda: 'USD',
      monedaFuncional: 'CUP',
      fxEvidenceFingerprint: canonico.evidence.fxEvidenceFingerprint,
    });
    expect((evento.montoFuncional as Prisma.Decimal).toFixed()).toBe('21600');
    expect((evento.tasaCambio as Prisma.Decimal).toFixed()).toBe('24');
    expect(getRateAsOfExactMock).not.toHaveBeenCalled();
  });

  it('rechaza valoración extranjera si la moneda original no fue explícita', async () => {
    const valoracion = buildAppliedFxEvidenceExact({
      originalAmount: '900.0000',
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: '24.0000000000',
      rateEffectiveAt: new Date('2026-09-30T00:00:00Z'),
      source: 'facturacion-venta-credito-cxc',
      fxCatalogRateId: 'tasa-usd',
      fxProvenanceKind: 'CATALOG_RATE',
    });
    const { tx, params } = fixtureCredito({ valoracion });

    await expect(applyFacturacionCobroWorkflow(tx as never, { ...params }))
      .rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
    expect(tx.cuentaPorCobrar.upsert).not.toHaveBeenCalled();
    expect(postEventoMock).not.toHaveBeenCalled();
  });

  it('sin política funcional rechaza antes de escribir la CxC', async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    const { tx, params } = fixtureCredito({ funcional: null });
    await expect(applyFacturacionCobroWorkflow(tx as never, { ...params }))
      .rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
    expect(tx.cuentaPorCobrar.upsert).not.toHaveBeenCalled();
    expect(tx.factura.update).not.toHaveBeenCalled();
    expect(postEventoMock).not.toHaveBeenCalled();
  });

  it('modo shadow conserva crédito sin política y reporta evento no valorizado', async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'shadow';
    const { tx, params } = fixtureCredito({ funcional: null });

    await expect(applyFacturacionCobroWorkflow(tx as never, { ...params }))
      .resolves.toMatchObject({ tipoVencimiento: 'plazo', reconciliacionId: null });
    expect(tx.cuentaPorCobrar.upsert).toHaveBeenCalledOnce();
    expect(tx.cuentaPorCobrar.upsert.mock.calls[0][0].create.monedaOriginal).toBeUndefined();
    expect(postEventoMock).toHaveBeenCalledOnce();
    const [, , evento] = postEventoMock.mock.calls[0];
    expect(evento).toMatchObject({ moneda: null, montoFuncional: null, monedaFuncional: null });
  });

  it('modo shadow conserva crédito extranjero sin evidencia FX', async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'shadow';
    const { tx, params } = fixtureCredito({ monedaOriginal: 'USD' });
    tx.cuentaBancaria.findFirst.mockResolvedValue(null);
    tx.tipoPago.findMany.mockResolvedValue([]);

    await expect(applyFacturacionCobroWorkflow(tx as never, { ...params }))
      .resolves.toMatchObject({ tipoVencimiento: 'plazo', reconciliacionId: null });
    expect(tx.cuentaPorCobrar.upsert).toHaveBeenCalledOnce();
    expect(tx.cuentaPorCobrar.upsert.mock.calls[0][0].create.monedaOriginal).toBeUndefined();
    expect(postEventoMock).toHaveBeenCalledOnce();
    const [, , evento] = postEventoMock.mock.calls[0];
    expect(evento).toMatchObject({ moneda: null, montoFuncional: null, monedaFuncional: null });
    expect(getRateAsOfExactMock).not.toHaveBeenCalled();
  });

  it('modo shadow no oculta fallo de outbox del motor', async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'shadow';
    const { tx, params } = fixtureCredito({ funcional: null });
    tx.cuentaBancaria.findFirst.mockResolvedValue(null);
    tx.tipoPago.findMany.mockResolvedValue([]);
    postEventoMock.mockRejectedValue(
      new ActionError('No se pudo registrar la evidencia shadow', 'OUTBOX_SHADOW_FALLIDA'),
    );

    await expect(applyFacturacionCobroWorkflow(tx as never, { ...params }))
      .rejects.toMatchObject({ code: 'OUTBOX_SHADOW_FALLIDA' });
    expect(tx.cuentaPorCobrar.upsert).toHaveBeenCalledOnce();
    expect(postEventoMock).toHaveBeenCalledOnce();
  });

  it('enforce rechaza monto nominal inconsistente antes del upsert', async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    const { tx, params } = fixtureCredito();
    tx.cuentaPorCobrar.findUnique.mockResolvedValue({
      montoDeuda: new Prisma.Decimal('901'),
    });

    await expect(applyFacturacionCobroWorkflow(tx as never, { ...params }))
      .rejects.toMatchObject({ code: 'CXC_MONTO_INCONSISTENTE' });
    expect(tx.cuentaPorCobrar.findUnique).toHaveBeenCalledOnce();
    expect(tx.cuentaPorCobrar.upsert).not.toHaveBeenCalled();
    expect(tx.factura.update).not.toHaveBeenCalled();
    expect(postEventoMock).not.toHaveBeenCalled();
  });

  it('shadow conserva una CxC con monto nominal inconsistente', async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'shadow';
    const { tx, params } = fixtureCredito();
    tx.cuentaPorCobrar.findUnique.mockResolvedValue({
      montoDeuda: new Prisma.Decimal('901'),
    });

    await expect(applyFacturacionCobroWorkflow(tx as never, { ...params }))
      .resolves.toMatchObject({ tipoVencimiento: 'plazo', reconciliacionId: null });
    expect(tx.cuentaPorCobrar.findUnique).toHaveBeenCalledOnce();
    expect(tx.cuentaPorCobrar.upsert).toHaveBeenCalledOnce();
    expect(postEventoMock).toHaveBeenCalledOnce();
    const [, , evento] = postEventoMock.mock.calls[0];
    expect(evento).toMatchObject({ moneda: null, montoFuncional: null, monedaFuncional: null });
  });

  it('enforce rechaza una CxC histórica sin snapshot formal antes del posteo', async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    const { tx, params } = fixtureCredito();
    tx.cuentaPorCobrar.upsert.mockResolvedValue({
      monedaOriginal: 'USD',
      montoOriginal: new Prisma.Decimal('900'),
      montoDeudaFuncional: null,
      monedaFuncional: null,
      tasaCambio: null,
      rateEffectiveAt: null,
      fxProvenanceKind: null,
      fxProvenanceSource: null,
      fxCatalogRateId: null,
      fxEvidenceJson: null,
      fxEvidenceFingerprint: null,
      fxEvidenceVersion: null,
    });

    await expect(applyFacturacionCobroWorkflow(tx as never, { ...params }))
      .rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
    expect(tx.cuentaPorCobrar.upsert).toHaveBeenCalledOnce();
    expect(postEventoMock).not.toHaveBeenCalled();
  });

  it('moneda extranjera sin tasa publicada rechaza antes de escribir', async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    const { tx, params } = fixtureCredito({ monedaOriginal: 'USD' });
    tx.cuentaBancaria.findFirst.mockResolvedValue(null);
    tx.tipoPago.findMany.mockResolvedValue([]);
    await expect(applyFacturacionCobroWorkflow(tx as never, { ...params }))
      .rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
    expect(tx.cuentaPorCobrar.upsert).not.toHaveBeenCalled();
    expect(tx.factura.update).not.toHaveBeenCalled();
    expect(postEventoMock).not.toHaveBeenCalled();
    expect(getRateAsOfExactMock).not.toHaveBeenCalled();
  });

  it('tasa no representable en Decimal(20,10) rechaza antes de escribir', async () => {
    const base = buildAppliedFxEvidenceExact({
      originalAmount: '900.0000',
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: '24.0000000000',
      rateEffectiveAt: new Date('2026-09-30T00:00:00Z'),
      source: 'facturacion-venta-credito-cxc',
      fxCatalogRateId: 'tasa-usd',
      fxProvenanceKind: 'CATALOG_RATE',
    });
    const valoracion = {
      ...base,
      tasaCambio: new Prisma.Decimal('24.12345678901'),
    };
    const { tx, params } = fixtureCredito({ monedaOriginal: 'USD', valoracion });
    tx.cuentaBancaria.findFirst.mockResolvedValue(null);
    tx.tipoPago.findMany.mockResolvedValue([]);
    await expect(applyFacturacionCobroWorkflow(tx as never, { ...params }))
      .rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
    expect(tx.cuentaPorCobrar.upsert).not.toHaveBeenCalled();
    expect(postEventoMock).not.toHaveBeenCalled();
    expect(getRateAsOfExactMock).not.toHaveBeenCalled();
  });

  it('reintento del mismo facturaId mantiene el origen único del asiento', async () => {
    const primera = fixtureCredito();
    await applyFacturacionCobroWorkflow(primera.tx as never, { ...primera.params });
    const segunda = fixtureCredito();
    await applyFacturacionCobroWorkflow(segunda.tx as never, { ...segunda.params });

    const [, , eventoUno] = postEventoMock.mock.calls[0];
    const [, , eventoDos] = postEventoMock.mock.calls[1];
    expect(eventoUno.origen).toEqual({ tipo: 'factura', id: 'factura-9' });
    expect(eventoDos.origen).toEqual({ tipo: 'factura', id: 'factura-9' });
    expect(segunda.tx.cuentaPorCobrar.upsert).toHaveBeenCalledOnce();
  });

  it('rechaza una cuenta por defecto de otro tenant en contra_pago', async () => {
    const { tx, params } = fixtureCredito();
    tx.tipoPago.findMany.mockResolvedValue([
      { tipoId: 'tipo-1', nombre: 'Efectivo', cuentaDefecto: 'cuenta-ajena' },
    ]);
    tx.cuentaBancaria.findFirst.mockImplementation(({ where }) => {
      if (where?.cuentaId === 'cuenta-ajena' && !where.tenantId) {
        return Promise.resolve({
          cuentaId: 'cuenta-ajena',
          moneda: 'USD',
          tipoCuenta: null,
        });
      }
      return Promise.resolve(null);
    });

    await expect(applyFacturacionCobroWorkflow(tx as never, {
      ...params,
      tipoVencimiento: 'contra_pago',
    }))
      .rejects.toThrow('No hay cuentas bancarias activas para registrar el cobro');
    expect(tx.cuentaPorCobrar.upsert).not.toHaveBeenCalled();
  });

  it('construye el evento desde la valoración persistida y no desde una tasa re-resuelta', async () => {
    const vigencia = new Date('2026-09-15T00:00:00Z');
    const transitoria = buildAppliedFxEvidenceExact({
      originalAmount: '900.0000',
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: '25.0000000000',
      rateEffectiveAt: new Date('2026-09-30T00:00:00Z'),
      source: 'facturacion-venta-credito-cxc',
      fxCatalogRateId: 'tasa-transitoria',
      fxProvenanceKind: 'CATALOG_RATE',
    });
    const { tx, params } = fixtureCredito({ monedaOriginal: 'USD', valoracion: transitoria });
    tx.cuentaBancaria.findFirst.mockResolvedValue(null);
    tx.tipoPago.findMany.mockResolvedValue([]);
    const persistida = buildAppliedFxEvidenceExact({
      originalAmount: '900.0000',
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: '24.0000000000',
      rateEffectiveAt: vigencia,
      source: 'facturacion-venta-credito-cxc',
      fxCatalogRateId: 'tasa-persistida',
      fxProvenanceKind: 'CATALOG_RATE',
    });
    tx.cuentaPorCobrar.findUnique.mockResolvedValue({
      montoDeuda: new Prisma.Decimal('900'),
    });
    tx.cuentaPorCobrar.upsert.mockResolvedValue({
      monedaOriginal: 'USD',
      montoOriginal: new Prisma.Decimal('900'),
      montoDeudaFuncional: new Prisma.Decimal('21600'),
      monedaFuncional: 'CUP',
      tasaCambio: new Prisma.Decimal('24'),
      rateEffectiveAt: vigencia,
      fxProvenanceKind: 'CATALOG_RATE',
      fxProvenanceSource: 'facturacion-venta-credito-cxc',
      fxCatalogRateId: 'tasa-persistida',
      fxEvidenceJson: persistida.evidence,
      fxEvidenceFingerprint: persistida.evidence.fxEvidenceFingerprint,
      fxEvidenceVersion: 2,
    });
    await applyFacturacionCobroWorkflow(tx as never, { ...params });

    const [, , evento] = postEventoMock.mock.calls[0];
    expect(evento).toMatchObject({
      moneda: 'USD',
      monedaFuncional: 'CUP',
      fxEvidenceFingerprint: persistida.evidence.fxEvidenceFingerprint,
    });
    expect((evento.monto as Prisma.Decimal).toFixed()).toBe('900');
    expect((evento.montoFuncional as Prisma.Decimal).toFixed()).toBe('21600');
    expect((evento.tasaCambio as Prisma.Decimal).toFixed()).toBe('24');
    expect(getRateAsOfExactMock).not.toHaveBeenCalled();
  });

  it('off no-op: el writer completa sin snapshot formal ni dependencia del motor', async () => {
    const previousMode = process.env.CONTABILIDAD_FORMAL_MODE;
    process.env.CONTABILIDAD_FORMAL_MODE = 'off';
    try {
      const { tx, params } = fixtureCredito({ funcional: null });
      tx.cuentaBancaria.findFirst.mockResolvedValue(null);
      tx.tipoPago.findMany.mockResolvedValue([]);
      postEventoMock.mockResolvedValue({ estado: 'OMITIDO', motivo: 'MODO_OFF' });
      await expect(applyFacturacionCobroWorkflow(tx as never, { ...params })).resolves.toBeDefined();
      expect(tx.cuentaPorCobrar.upsert).toHaveBeenCalledOnce();
      expect(tx.cuentaPorCobrar.upsert.mock.calls[0][0].create.monedaOriginal).toBeUndefined();
    } finally {
      if (previousMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
      else process.env.CONTABILIDAD_FORMAL_MODE = previousMode;
    }
  });
});
