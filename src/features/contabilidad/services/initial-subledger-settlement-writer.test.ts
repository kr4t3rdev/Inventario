import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';

import {
	settleInitialPayable,
	settleInitialReceivable,
} from './initial-subledger-settlement-writer';

vi.mock('@/features/contabilidad-formal/services/settlement-posting-service', () => ({
	emitirEventoLiquidacion: vi.fn(),
}));
import { emitirEventoLiquidacion } from '@/features/contabilidad-formal/services/settlement-posting-service';

const D = (value: string) => new Prisma.Decimal(value);
const fechaEfectiva = new Date('2026-11-15T12:00:00.000Z');
const fechaTasa = new Date('2026-11-10T00:00:00.000Z');

const cxcBase = {
	id: 'cxc-1',
	tenantId: 'tenant-a',
	clienteId: 'cli-1',
	inicializacionId: 'init-1',
	referenciaInicial: 'fila-1',
	monedaOriginal: 'USD',
	monedaFuncional: 'CUP',
	montoDeuda: D('100'),
	montoPagado: D('0'),
	montoDeudaFuncional: D('2400'),
	montoPagadoFuncional: D('0'),
	estado: 'PENDIENTE',
};

const cxpBase = {
	cuentaPorPagarId: 'cxp-1',
	tenantId: 'tenant-a',
	inicializacionId: 'init-1',
	referenciaInicial: 'fila-1',
	monedaOriginal: 'CUP',
	monedaFuncional: 'CUP',
	montoDeuda: D('500'),
	montoPagado: D('0'),
	montoDeudaFuncional: D('500'),
	montoPagadoFuncional: D('0'),
	saldoPendiente: D('500'),
	estado: 'PENDIENTE',
	proveedor: null,
};

const bancoUsd = {
	cuentaId: 'banco-usd',
	tenantId: 'tenant-a',
	moneda: 'USD',
	saldo: 1000,
	isActive: true,
	tipoCuenta: 'CORRIENTE',
};
const bancoCup = { ...bancoUsd, cuentaId: 'banco-cup', moneda: 'CUP' };

const tx = {
	$queryRaw: vi.fn().mockResolvedValue([]),
	cuentaPorCobrar: { findFirst: vi.fn(), updateMany: vi.fn() },
	cuentaPorPagar: { findFirst: vi.fn(), updateMany: vi.fn() },
	cuentaBancaria: { findFirst: vi.fn(), updateMany: vi.fn() },
	tipoPago: { findFirst: vi.fn() },
	tenantAccountingPolicy: { findUnique: vi.fn() },
	tasaCambio: { findFirst: vi.fn() },
	reconciliacionVenta: { findFirst: vi.fn(), create: vi.fn() },
	pagoCuentaPorPagar: { findFirst: vi.fn(), create: vi.fn() },
	deudaCash: { findFirst: vi.fn() },
	prestamoCash: { findFirst: vi.fn(), updateMany: vi.fn() },
};

const cobroInput = {
	tenantId: 'tenant-a',
	cuentaPorCobrarId: 'cxc-1',
	cuentaId: 'banco-usd',
	tipoPagoId: 'tp-1',
	monto: '40',
	fechaEfectiva,
	referencia: 'cobro-1',
	actorId: 'user-1',
};
const pagoInput = {
	tenantId: 'tenant-a',
	cuentaPorPagarId: 'cxp-1',
	cuentaId: 'banco-cup',
	monto: '200',
	fechaEfectiva,
	referencia: 'pago-1',
	actorId: 'user-1',
};

function mockBanco(cuenta: typeof bancoUsd) {
	tx.cuentaBancaria.findFirst.mockImplementation(async ({ where }: any) =>
		where?.cuentaId === cuenta.cuentaId ? cuenta : null,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	tx.$queryRaw.mockResolvedValue([]);
	tx.cuentaPorCobrar.findFirst.mockResolvedValue({ ...cxcBase });
	tx.cuentaPorCobrar.updateMany.mockResolvedValue({ count: 1 });
	tx.cuentaPorPagar.findFirst.mockResolvedValue({ ...cxpBase });
	tx.cuentaPorPagar.updateMany.mockResolvedValue({ count: 1 });
	tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 });
	tx.tipoPago.findFirst.mockResolvedValue({ tipoId: 'tp-1', isActive: true });
	tx.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
	tx.tasaCambio.findFirst.mockResolvedValue({ tasaId: 'tasa-25', tasa: D('25'), fechaVigencia: fechaTasa });
	tx.reconciliacionVenta.findFirst.mockResolvedValue(null);
	tx.reconciliacionVenta.create.mockImplementation(async ({ data }: any) => ({
		reconciliacionId: 'recon-1',
		fechaReconciliacion: fechaEfectiva,
		...data,
	}));
	tx.pagoCuentaPorPagar.findFirst.mockResolvedValue(null);
	tx.deudaCash.findFirst.mockResolvedValue(null);
	tx.prestamoCash.findFirst.mockResolvedValue(null);
	tx.prestamoCash.updateMany.mockResolvedValue({ count: 1 });
	tx.pagoCuentaPorPagar.create.mockImplementation(async ({ data }: any) => ({
		pagoCuentaPorPagarId: 'pago-1',
		...data,
	}));
	vi.mocked(emitirEventoLiquidacion).mockResolvedValue({ estado: 'CONTABILIZADO', asientoId: 'asiento-1' });
	mockBanco(bancoUsd);
});

describe('settleInitialReceivable', () => {
	it('cobra parcial en divisa con tasa del catálogo y diferencia FX', async () => {
		const result = await settleInitialReceivable(tx as never, cobroInput);

		expect(result).toMatchObject({
			reconciliacionId: 'recon-1',
			aplicadoOriginal: '40.0000',
			aplicadoFuncional: '960.0000',
			pagadoFuncional: '1000.0000',
			diferenciaFuncional: '40.0000',
			remanenteOriginal: '60.0000',
			remanenteFuncional: '1440.0000',
			estado: 'PARCIAL',
		});
		expect(tx.tasaCambio.findFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({
				monedaOrigenId: 'USD',
				monedaDestino: 'CUP',
				fechaVigencia: { lte: fechaEfectiva },
			}),
		}));
		expect(tx.cuentaBancaria.updateMany).toHaveBeenCalledWith({
			where: { cuentaId: 'banco-usd', tenantId: 'tenant-a' },
			data: { saldo: { increment: 40 } },
		});
		const createData = tx.reconciliacionVenta.create.mock.calls[0][0].data;
		expect(createData.ventaId).toBeNull();
		expect(createData.cuentaPorCobrarId).toBe('cxc-1');
		expect(String(createData.monto)).toBe('40');
		expect(createData.moneda).toBe('USD');
		expect(String(createData.montoConvertido)).toBe('1000');
		expect(String(createData.tasaCambio)).toBe('25');
		expect(createData.fxCatalogRateId).toBe('tasa-25');
		expect(createData.fxProvenanceKind).toBe('MANUAL_GOVERNED');
		expect(createData.idempotencyKey).toBe('cobro-1');
		expect(createData.reconciliadoPor).toBe('user-1');
		expect(emitirEventoLiquidacion).toHaveBeenCalledWith(
			tx,
			{ tenantId: 'tenant-a', userId: 'user-1' },
			expect.objectContaining({
				tipo: 'COBRO_CXC',
				origenExterno: 'cobro_cxc_externo',
				valorContableAplicado: '960.0000',
				functionalAmount: '1000.0000',
			}),
		);
		const updateData = tx.cuentaPorCobrar.updateMany.mock.calls[0][0].data;
		expect(String(updateData.montoPagado)).toBe('40');
		expect(String(updateData.montoPagadoFuncional)).toBe('960');
		expect(updateData.estado).toBe('PARCIAL');
	});

	it('liquida la CxC cuando el cobro cubre el saldo', async () => {
		const result = await settleInitialReceivable(tx as never, { ...cobroInput, monto: '100' });
		expect(result).toMatchObject({
			aplicadoFuncional: '2400.0000',
			remanenteOriginal: '0.0000',
			remanenteFuncional: '0.0000',
			estado: 'PAGADA',
		});
		expect(tx.cuentaPorCobrar.updateMany.mock.calls[0][0].data.estado).toBe('PAGADA');
	});

	it('cobra en la misma moneda sin consultar el catálogo', async () => {
		tx.cuentaPorCobrar.findFirst.mockResolvedValue({
			...cxcBase,
			monedaOriginal: 'CUP',
			montoDeuda: D('500'),
			montoDeudaFuncional: D('500'),
		});
		mockBanco(bancoCup);
		const result = await settleInitialReceivable(tx as never, { ...cobroInput, cuentaId: 'banco-cup', monto: '200' });
		expect(result).toMatchObject({ aplicadoFuncional: '200.0000', diferenciaFuncional: '0.0000', estado: 'PARCIAL' });
		expect(tx.tasaCambio.findFirst).not.toHaveBeenCalled();
		expect(tx.reconciliacionVenta.create.mock.calls[0][0].data.fxProvenanceKind).toBe('SAME_CURRENCY');
	});

	it('rechaza el cobro que excede el saldo pendiente', async () => {
		await expect(settleInitialReceivable(tx as never, { ...cobroInput, monto: '101' }))
			.rejects.toThrow('INITIAL_SETTLEMENT_EXCEEDS_BALANCE');
		expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled();
	});

	it('rechaza divisa sin tasa vigente a la fecha efectiva', async () => {
		tx.tasaCambio.findFirst.mockResolvedValue(null);
		await expect(settleInitialReceivable(tx as never, cobroInput))
			.rejects.toThrow('INITIAL_SETTLEMENT_FX_REQUIRED');
		expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled();
	});

	it('rechaza la cuenta bancaria en otra moneda que el cobro', async () => {
		mockBanco(bancoCup);
		await expect(settleInitialReceivable(tx as never, { ...cobroInput, cuentaId: 'banco-cup' }))
			.rejects.toThrow('INITIAL_SETTLEMENT_CUENTA_MONEDA_INVALIDA');
		expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled();
	});

	it('rechaza la referencia duplicada', async () => {
		tx.reconciliacionVenta.findFirst.mockResolvedValue({ reconciliacionId: 'recon-0' });
		await expect(settleInitialReceivable(tx as never, cobroInput))
			.rejects.toThrow('INITIAL_SETTLEMENT_DUPLICATE');
		expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled();
	});

	it('rechaza la CxC ya liquidada o ajena', async () => {
		tx.cuentaPorCobrar.findFirst.mockResolvedValue({ ...cxcBase, estado: 'PAGADA' });
		await expect(settleInitialReceivable(tx as never, cobroInput))
			.rejects.toThrow('INITIAL_SETTLEMENT_CUENTA_PAGADA');
		tx.cuentaPorCobrar.findFirst.mockResolvedValue(null);
		await expect(settleInitialReceivable(tx as never, cobroInput))
			.rejects.toThrow('INITIAL_SETTLEMENT_CUENTA_NO_ENCONTRADA');
		expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled();
	});

	it('rechaza la CxC ordinaria (sin inicialización)', async () => {
		tx.cuentaPorCobrar.findFirst.mockResolvedValue({ ...cxcBase, inicializacionId: null });
		await expect(settleInitialReceivable(tx as never, cobroInput))
			.rejects.toThrow('INITIAL_SETTLEMENT_CUENTA_NO_INICIAL');
		expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled();
	});
});

describe('settleInitialPayable', () => {
	it('rechaza pagar una CxP inicial que es una deuda cash', async () => {
		tx.deudaCash.findFirst.mockResolvedValueOnce({ id: 'deuda-1' });

		await expect(settleInitialPayable(tx as never, pagoInput)).rejects.toMatchObject({
			code: 'INITIAL_SETTLEMENT_DEUDA_CASH',
		});
		expect(tx.pagoCuentaPorPagar.create).not.toHaveBeenCalled();
	});

	it('paga parcial en la misma moneda y descuenta el banco', async () => {
		mockBanco(bancoCup);
		const result = await settleInitialPayable(tx as never, pagoInput);

		expect(result).toMatchObject({
			pagoCuentaPorPagarId: 'pago-1',
			aplicadoOriginal: '200.0000',
			aplicadoFuncional: '200.0000',
			pagadoFuncional: '200.0000',
			diferenciaFuncional: '0.0000',
			remanenteOriginal: '300.0000',
			remanenteFuncional: '300.0000',
			estado: 'PARCIAL',
		});
		expect(tx.cuentaBancaria.updateMany).toHaveBeenCalledWith({
			where: { cuentaId: 'banco-cup', tenantId: 'tenant-a' },
			data: { saldo: { decrement: 200 } },
		});
		const createData = tx.pagoCuentaPorPagar.create.mock.calls[0][0].data;
		expect(createData.cuentaPorPagarId).toBe('cxp-1');
		expect(String(createData.monto)).toBe('200');
		expect(createData.moneda).toBe('CUP');
		expect(String(createData.montoFuncional)).toBe('200');
		expect(createData.numeroTransaccion).toBe('pago-1');
		expect(createData.fxProvenanceKind).toBe('SAME_CURRENCY');
		expect(emitirEventoLiquidacion).toHaveBeenCalledWith(
			tx,
			{ tenantId: 'tenant-a', userId: 'user-1' },
			expect.objectContaining({
				tipo: 'PAGO_CXP',
				origenExterno: 'pago_cxp_externo',
				valorContableAplicado: '200.0000',
				functionalAmount: '200.0000',
			}),
		);
		const updateData = tx.cuentaPorPagar.updateMany.mock.calls[0][0].data;
		expect(String(updateData.montoPagado)).toBe('200');
		expect(String(updateData.saldoPendiente)).toBe('300');
		expect(updateData.estado).toBe('PARCIAL');
	});

	it('paga en divisa con diferencia negativa cuando la tasa subió', async () => {
		tx.cuentaPorPagar.findFirst.mockResolvedValue({
			...cxpBase,
			monedaOriginal: 'USD',
			montoDeuda: D('100'),
			montoDeudaFuncional: D('2400'),
			saldoPendiente: D('100'),
		});
		mockBanco(bancoUsd);
		const result = await settleInitialPayable(tx as never, { ...pagoInput, cuentaId: 'banco-usd', monto: '40' });
		expect(result).toMatchObject({
			aplicadoFuncional: '960.0000',
			pagadoFuncional: '1000.0000',
			diferenciaFuncional: '-40.0000',
			remanenteOriginal: '60.0000',
			estado: 'PARCIAL',
		});
		expect(tx.pagoCuentaPorPagar.create.mock.calls[0][0].data.fxCatalogRateId).toBe('tasa-25');
	});

	it('liquida la CxP cuando el pago cubre el saldo', async () => {
		mockBanco(bancoCup);
		const result = await settleInitialPayable(tx as never, { ...pagoInput, monto: '500' });
		expect(result).toMatchObject({ estado: 'PAGADA', remanenteOriginal: '0.0000' });
	});

	it('rechaza el pago sin saldo bancario suficiente', async () => {
		mockBanco({ ...bancoCup, saldo: 100 });
		await expect(settleInitialPayable(tx as never, pagoInput))
			.rejects.toThrow('INITIAL_SETTLEMENT_SALDO_INSUFICIENTE');
		expect(tx.pagoCuentaPorPagar.create).not.toHaveBeenCalled();
	});

	it('rechaza la referencia duplicada para la misma CxP', async () => {
		mockBanco(bancoCup);
		tx.pagoCuentaPorPagar.findFirst.mockResolvedValue({ pagoCuentaPorPagarId: 'pago-0' });
		await expect(settleInitialPayable(tx as never, pagoInput))
			.rejects.toThrow('INITIAL_SETTLEMENT_DUPLICATE');
		expect(tx.pagoCuentaPorPagar.create).not.toHaveBeenCalled();
	});

	it('rechaza el pago que excede el saldo pendiente', async () => {
		mockBanco(bancoCup);
		await expect(settleInitialPayable(tx as never, { ...pagoInput, monto: '501' }))
			.rejects.toThrow('INITIAL_SETTLEMENT_EXCEEDS_BALANCE');
		expect(tx.pagoCuentaPorPagar.create).not.toHaveBeenCalled();
	});
});

describe('settleInitialReceivable actualiza el wrapper PrestamoCash', () => {
	it('decrementa el principal restante en un cobro parcial', async () => {
		tx.prestamoCash.findFirst.mockResolvedValue({ id: 'prest-1' });
		const result = await settleInitialReceivable(tx as never, cobroInput);
		expect(result.aplicadoOriginal).toBe('40.0000');
		expect(tx.prestamoCash.updateMany).toHaveBeenCalledWith({
			where: { id: 'prest-1', tenantId: 'tenant-a' },
			data: { cashInterestPrincipalRemaining: { decrement: 40 } },
		});
	});

	it('marca el wrapper PAGADO cuando el cobro liquida la CxC', async () => {
		tx.prestamoCash.findFirst.mockResolvedValue({ id: 'prest-1' });
		await settleInitialReceivable(tx as never, { ...cobroInput, monto: '100' });
		expect(tx.prestamoCash.updateMany).toHaveBeenCalledWith({
			where: { id: 'prest-1', tenantId: 'tenant-a' },
			data: { cashInterestPrincipalRemaining: { decrement: 100 }, estado: 'PAGADO' },
		});
	});

	it('no toca ningún wrapper cuando la CxC no tiene préstamo', async () => {
		await settleInitialReceivable(tx as never, cobroInput);
		expect(tx.prestamoCash.updateMany).not.toHaveBeenCalled();
	});
});
