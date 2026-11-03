import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../posting-engine', () => ({
	postEvento: vi.fn(),
}));
vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => ({
	exchangeRateProvider: { getRateAsOf: vi.fn() },
}));

import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';
import { postEvento } from '../posting-engine';
import {
	emitirAplicacionAnticipo,
	emitirDevolucionAnticipo,
	emitirReversionAplicacionAnticipo,
} from '../advance-formal-posting-service';
import type { PostingTx } from '../posting-engine';

describe('advance formal posting service', () => {
	const txMock = {
		tenantAccountingPolicy: { findUnique: vi.fn() },
	};
	const tx = txMock as unknown as PostingTx;
	const ctx = { tenantId: 'tenant-1', userId: 'user-1' };
	const fecha = new Date('2026-11-03T10:00:00.000Z');

	beforeEach(() => {
		vi.clearAllMocks();
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
		vi.mocked(postEvento).mockResolvedValue({ estado: 'CONTABILIZADO', asientoId: 'asiento-1' });
	});

	it('emite ANTICIPO_CLIENTE_APLICADO con origen del movimiento', async () => {
		await emitirAplicacionAnticipo(tx, ctx, {
			anticipoMovimientoId: 'mov-1',
			fecha,
			monto: 500,
			moneda: 'CUP',
			montoFuncional: 500,
			monedaFuncional: 'CUP',
			tasaCambio: 1,
			fxEvidenceFingerprint: 'fx-123',
			tipoEvento: 'ANTICIPO_CLIENTE_APLICADO',
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'ANTICIPO_CLIENTE_APLICADO',
			origen: { tipo: 'anticipo_movimiento', id: 'mov-1' },
			monto: 500,
			moneda: 'CUP',
		}));
	});

	it('emite ANTICIPO_PROVEEDOR_APLICADO con origen del movimiento', async () => {
		await emitirAplicacionAnticipo(tx, ctx, {
			anticipoMovimientoId: 'mov-2',
			fecha,
			monto: 1000,
			moneda: 'USD',
			montoFuncional: 1000,
			monedaFuncional: 'USD',
			tasaCambio: 1,
			fxEvidenceFingerprint: 'fx-456',
			tipoEvento: 'ANTICIPO_PROVEEDOR_APLICADO',
			diferenciaFx: 0,
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'ANTICIPO_PROVEEDOR_APLICADO',
			origen: { tipo: 'anticipo_movimiento', id: 'mov-2' },
			monto: 1000,
			moneda: 'USD',
		}));
	});

	it('emite reverso de aplicación de anticipo', async () => {
		await emitirReversionAplicacionAnticipo(tx, ctx, {
			anticipoMovimientoId: 'mov-1',
			fecha,
			monto: 500,
			montoFuncional: 500,
			monedaFuncional: 'CUP',
			tasaCambio: 1,
			fxEvidenceFingerprint: 'fx-123',
			tipoReverso: 'ANTICIPO_CLIENTE_APLICACION_REVERSADA',
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'ANTICIPO_CLIENTE_APLICACION_REVERSADA',
			origen: { tipo: 'anticipo_movimiento', id: 'mov-1' },
			monto: 500,
		}));
	});

	it('emite devolución de fondos a cliente', async () => {
		await emitirDevolucionAnticipo(tx, ctx, {
			anticipoMovimientoId: 'mov-3',
			fecha,
			monto: 250,
			moneda: 'CUP',
			montoFuncional: 250,
			monedaFuncional: 'CUP',
			tasaCambio: 1,
			fxEvidenceFingerprint: null,
			tipoEvento: 'ANTICIPO_CLIENTE_DEVUELTO',
			treasuryAccountType: 'EFECTIVO',
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'ANTICIPO_CLIENTE_DEVUELTO',
			origen: { tipo: 'anticipo_movimiento', id: 'mov-3' },
			monto: 250,
			medioCobro: 'CAJA',
		}));
	});

	it('emite reintegro de fondos a proveedor', async () => {
		await emitirDevolucionAnticipo(tx, ctx, {
			anticipoMovimientoId: 'mov-4',
			fecha,
			monto: 600,
			moneda: 'CUP',
			montoFuncional: 600,
			monedaFuncional: 'CUP',
			tasaCambio: 1,
			fxEvidenceFingerprint: null,
			tipoEvento: 'ANTICIPO_PROVEEDOR_REINTEGRADO',
			treasuryAccountType: 'BANCOS',
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'ANTICIPO_PROVEEDOR_REINTEGRADO',
			origen: { tipo: 'anticipo_movimiento', id: 'mov-4' },
			monto: 600,
		}));
	});

	it('omite devoluciones con monto cero sin romper la operación', async () => {
		const result = await emitirDevolucionAnticipo(tx, ctx, {
			anticipoMovimientoId: 'mov-zero',
			fecha,
			monto: 0,
			moneda: 'CUP',
			montoFuncional: 0,
			monedaFuncional: 'CUP',
			tasaCambio: 1,
			fxEvidenceFingerprint: null,
			tipoEvento: 'ANTICIPO_CLIENTE_DEVUELTO',
			treasuryAccountType: 'EFECTIVO',
		});

		expect(result).toEqual({ estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' });
		expect(postEvento).not.toHaveBeenCalled();
	});

	it('usa la tasa publicada para valorar en moneda funcional distinta', async () => {
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'USD' });
		vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue({
			tasaId: 'rate-1', tasa: 0.04, fechaVigencia: fecha,
		});

		await emitirAplicacionAnticipo(tx, ctx, {
			anticipoMovimientoId: 'mov-5',
			fecha,
			monto: 2500,
			moneda: 'CUP',
			montoFuncional: 100,
			monedaFuncional: 'USD',
			tasaCambio: 0.04,
			fxEvidenceFingerprint: 'fx-789',
			tipoEvento: 'ANTICIPO_CLIENTE_APLICADO',
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'ANTICIPO_CLIENTE_APLICADO',
			monto: 2500,
			moneda: 'CUP',
			montoFuncional: 100,
			tasaCambio: 0.04,
		}));
	});
});