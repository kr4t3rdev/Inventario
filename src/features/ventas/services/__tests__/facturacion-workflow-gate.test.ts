import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
const { buildPersistedAccountingAmountMock } = vi.hoisted(() => ({
  buildPersistedAccountingAmountMock: vi.fn(),
}));
vi.mock('@/features/contabilidad/services/accounting-reconciliation-service', () => ({
  buildPersistedAccountingAmount: buildPersistedAccountingAmountMock,
}));
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
  postEvento: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/features/contabilidad-formal/lib/event-builders', () => ({
  buildEventoVentaContado: vi.fn(() => ({})),
  buildEventoVentaCredito: vi.fn(() => ({})),
}));

import { applyFacturacionCobroWorkflow } from '@/features/ventas/services/facturacion-workflow';
import { saldoVivoCliente } from '@/features/crm/services/credito-calculo';
import { createVentaSchema } from '@/features/ventas/schemas';

/** @description Construye un cliente transaccional falso sin conexión a la base de datos.
 * @returns {object} Delegados y espías para observar efectos del workflow.
 */
function fixture() {
  const tx = {
    cuentaPorCobrar: {
      upsert: vi.fn().mockImplementation(({ create }) =>
        Promise.resolve({ id: 'cxc', ...create }),
      ),
    },
    factura: { update: vi.fn().mockResolvedValue({}) },
    cuentaBancaria: {
      findFirst: vi.fn().mockResolvedValue({ cuentaId: 'cuenta', moneda: 'CUP', tipoCuenta: null }),
      update: vi.fn().mockResolvedValue({}),
    },
    tipoPago: {
      findMany: vi.fn().mockResolvedValue([{ tipoId: 'tipo', nombre: 'Efectivo', cuentaDefecto: null }]),
    },
    reconciliacionVenta: {
      create: vi.fn().mockResolvedValue({ reconciliacionId: 'rec' }),
    },
    tenantAccountingPolicy: {
      findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
    },
  };
  const params = {
    ventaId: 'venta', facturaId: 'factura', clienteId: 'cliente', montoTotal: 100,
    usuarioId: 'usuario', tenantId: 'tenant',
  };
  return { tx, params };
}

// Estas pruebas ejercitan la lógica del writer con prisma mockeado: el gate
// de la capa formal (licencia/savepoint/outbox) exige PostgreSQL real, así que
// el modo queda fijado a 'off' y la cobertura en shadow/enforce vive en las
// suites __integration__ correspondientes.
const originalMode = process.env.CONTABILIDAD_FORMAL_MODE;
vi.stubEnv('CONTABILIDAD_FORMAL_MODE', 'off');
afterAll(() => {
	if (originalMode === undefined) vi.unstubAllEnvs();
	else vi.stubEnv('CONTABILIDAD_FORMAL_MODE', originalMode);
});

describe('gate 1.2: CxC observable del workflow actual (Prisma mock)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildPersistedAccountingAmountMock.mockImplementation(
      (amount: Prisma.Decimal | number, _currency: string, _rate?: unknown, _at?: Date | null, _catalog?: string | null, functionalCurrency = 'CUP') => ({
        montoConvertido: new Prisma.Decimal(amount),
        tasaCambio: new Prisma.Decimal(1),
        fxEvidence: {
          functionalCurrency,
          fxProvenanceKind: 'SAME_CURRENCY',
          fxProvenanceSource: 'test',
          fxCatalogRateId: null,
          fxEvidenceFingerprint: 'fp-test',
          fxEvidenceVersion: 2,
        },
      }),
    );
  });

  it.each(['fecha', 'plazo'])(
    'crea CxC por total y sin pago aplicado para vencimiento %s', async (tipoVencimiento) => {
      const { tx, params } = fixture();
      await applyFacturacionCobroWorkflow(tx as never, {
        ...params, tipoVencimiento, fechaVencimiento: '2026-10-10',
      });
      const { create, update } = tx.cuentaPorCobrar.upsert.mock.calls[0][0];
      expect(create).toMatchObject({ montoDeuda: new Prisma.Decimal(100), montoPagado: 0, tenantId: 'tenant' });
      expect(update).toMatchObject({ montoDeuda: new Prisma.Decimal(100) });
      expect(update.montoPagado).toBeUndefined();
      expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled();
    },
  );

  it('contra_pago cobra el total y no crea CxC, aunque se declare MIXTO fuera del workflow', async () => {
    const { tx, params } = fixture();
    await applyFacturacionCobroWorkflow(tx as never, { ...params, tipoVencimiento: 'contra_pago' });
    expect(tx.cuentaPorCobrar.upsert).not.toHaveBeenCalled();
    expect(tx.reconciliacionVenta.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ monto: new Prisma.Decimal(100) }) }),
    );
    // FX-3: snapshot de cuenta nativa persistido junto al cobro.
    const data = tx.reconciliacionVenta.create.mock.calls[0][0].data;
    expect((data.montoCuenta as Prisma.Decimal).toNumber()).toBe(100);
    expect(data.monedaCuenta).toBe('CUP');
  });

  it('saldo vivo no descuenta dos veces pago y excluye anulada/sobrepago', () => {
    expect(saldoVivoCliente([
      { montoDeuda: 100, montoPagado: 40, estado: 'PENDIENTE' },
      { montoDeuda: 50, montoPagado: 0, estado: 'ANULADA' },
      { montoDeuda: 10, montoPagado: 20, estado: 'PENDIENTE' },
    ])).toBe(60);
  });

  it('reintentar vencimiento no debe borrar un pago ya aplicado a la CxC', async () => {
    const { tx, params } = fixture();
    await applyFacturacionCobroWorkflow(tx as never, {
      ...params, tipoVencimiento: 'fecha', fechaVencimiento: '2026-10-10',
    });
    // En un upsert existente con pagos, el update no debe reiniciarlos.
    expect(tx.cuentaPorCobrar.upsert.mock.calls[0][0].update.montoPagado).toBeUndefined();
  });

  it('MIXTO+fecha con porción cobrada hoy: concilia 40 hoy y deja CxC por el remanente 60', async () => {
    const { tx, params } = fixture();
    await applyFacturacionCobroWorkflow(tx as never, {
      ...params, tipoVencimiento: 'fecha', fechaVencimiento: '2026-10-10',
      montoCobradoContado: 40,
    });

    // La porción cobrada hoy se concilia y abona al banco.
    expect(tx.reconciliacionVenta.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ monto: new Prisma.Decimal(40) }) }),
    );
    expect(tx.cuentaBancaria.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ saldo: { increment: 40 } }) }),
    );
    // La CxC queda sólo por la deuda realmente pendiente.
    const { create, update } = tx.cuentaPorCobrar.upsert.mock.calls[0][0];
    expect(create).toMatchObject({ montoDeuda: new Prisma.Decimal(60), montoPagado: 0 });
    expect(update).toMatchObject({ montoDeuda: new Prisma.Decimal(60) });
  });

  it('plazo con porción cobrada hoy también concilia hoy y deja el remanente', async () => {
    const { tx, params } = fixture();
    await applyFacturacionCobroWorkflow(tx as never, {
      ...params, tipoVencimiento: 'plazo',
      montoCobradoContado: 25,
    });
    expect(tx.reconciliacionVenta.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ monto: new Prisma.Decimal(25) }) }),
    );
    expect(tx.cuentaPorCobrar.upsert.mock.calls[0][0].create).toMatchObject({ montoDeuda: new Prisma.Decimal(75) });
  });

  it('porción cobrada que cubre el total se trata como contra_pago: sin CxC y factura PAGADA', async () => {
    const { tx, params } = fixture();
    await applyFacturacionCobroWorkflow(tx as never, {
      ...params, tipoVencimiento: 'fecha', fechaVencimiento: '2026-10-10',
      montoCobradoContado: 100,
    });
    expect(tx.cuentaPorCobrar.upsert).not.toHaveBeenCalled();
    expect(tx.reconciliacionVenta.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ monto: new Prisma.Decimal(100) }) }),
    );
    expect(tx.factura.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'PAGADA' }) }),
    );
  });

  it('montoCobradoContado fuera de rango se clampa al total (nunca negativo ni mayor)', async () => {
    const { tx, params } = fixture();
    await applyFacturacionCobroWorkflow(tx as never, {
      ...params, tipoVencimiento: 'fecha', fechaVencimiento: '2026-10-10',
      montoCobradoContado: 150,
    });
    expect(tx.reconciliacionVenta.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ monto: new Prisma.Decimal(100) }) }),
    );
    expect(tx.cuentaPorCobrar.upsert).not.toHaveBeenCalled();
  });

  it('schema permite MIXTO con crédito y fecha sin acreditar aplicación del efectivo', () => {
    const parsed = createVentaSchema.parse({
      puntoDeVentaId: 'pv', clienteId: 'cliente',
      items: [{ productoId: 'producto', cantidad: 1, precioUnitario: 100 }],
      metodoPago: 'MIXTO', montoEfectivo: 40, montoRecibidoEfectivo: 40,
      montoCredito: 60, tipoVencimiento: 'fecha', fechaVencimiento: '2026-10-10',
    });
    expect(parsed.montoCredito).toBe(60);
    expect(parsed.tipoVencimiento).toBe('fecha');
  });

  it('contra_pago valora con la moneda funcional del tenant (no CUP por defecto)', async () => {
    const { tx, params } = fixture();
    tx.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'USD' });
    tx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cuenta', moneda: 'USD', tipoCuenta: null });
    buildPersistedAccountingAmountMock.mockImplementationOnce(
      (amount: Prisma.Decimal | number, _currency: string, _rate?: number, _at?: Date | null, _catalog?: string | null, functionalCurrency = 'CUP') => ({
        montoConvertido: new Prisma.Decimal(amount),
        tasaCambio: new Prisma.Decimal(1),
        fxEvidence: {
          functionalCurrency,
          fxProvenanceKind: 'SAME_CURRENCY',
          fxProvenanceSource: 'test',
          fxCatalogRateId: null,
          fxEvidenceFingerprint: 'fp-test',
          fxEvidenceVersion: 2,
        },
      }),
    );

    await applyFacturacionCobroWorkflow(tx as never, { ...params, tipoVencimiento: 'contra_pago' });

    expect(buildPersistedAccountingAmountMock).toHaveBeenCalledWith(
      new Prisma.Decimal(100), 'USD', undefined, expect.any(Date), undefined, 'USD',
    );
    expect(tx.reconciliacionVenta.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ functionalCurrency: 'USD', montoConvertido: new Prisma.Decimal(100) }),
      }),
    );
  });

  it('MIXTO valora la porción contado con la moneda funcional del tenant', async () => {
    const { tx, params } = fixture();
    tx.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'USD' });
    tx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cuenta', moneda: 'USD', tipoCuenta: null });
    buildPersistedAccountingAmountMock.mockImplementationOnce(
      (amount: Prisma.Decimal | number, _currency: string, _rate?: number, _at?: Date | null, _catalog?: string | null, functionalCurrency = 'CUP') => ({
        montoConvertido: new Prisma.Decimal(amount),
        tasaCambio: new Prisma.Decimal(1),
        fxEvidence: {
          functionalCurrency,
          fxProvenanceKind: 'SAME_CURRENCY',
          fxProvenanceSource: 'test',
          fxCatalogRateId: null,
          fxEvidenceFingerprint: 'fp-test',
          fxEvidenceVersion: 2,
        },
      }),
    );

    await applyFacturacionCobroWorkflow(tx as never, {
      ...params, tipoVencimiento: 'fecha', fechaVencimiento: '2026-10-10',
      montoCobradoContado: 40,
    });

    expect(buildPersistedAccountingAmountMock).toHaveBeenCalledWith(
      new Prisma.Decimal(40), 'USD', undefined, expect.any(Date), undefined, 'USD',
    );
    expect(tx.reconciliacionVenta.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ monto: new Prisma.Decimal(40), functionalCurrency: 'USD' }),
      }),
    );
  });

  it('contra_pago falla cerrado sin política contable del tenant', async () => {
    const { tx, params } = fixture();
    tx.tenantAccountingPolicy.findUnique.mockResolvedValue(null);

    await expect(applyFacturacionCobroWorkflow(tx as never, {
      ...params, tipoVencimiento: 'contra_pago',
    })).rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
    expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled();
    expect(tx.cuentaBancaria.update).not.toHaveBeenCalled();
  });

  it('contra_pago falla cerrado si la valoración no trae evidencia funcional', async () => {
    const { tx, params } = fixture();
    tx.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'USD' });
    tx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cuenta', moneda: 'USD', tipoCuenta: null });
    buildPersistedAccountingAmountMock.mockImplementationOnce(() => ({
      montoConvertido: null,
      tasaCambio: null,
      fxEvidence: null,
    }));

    await expect(applyFacturacionCobroWorkflow(tx as never, {
      ...params, tipoVencimiento: 'contra_pago',
    })).rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
    expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled();
    expect(tx.cuentaBancaria.update).not.toHaveBeenCalled();
  });
});
