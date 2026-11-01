import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ENV_MODO_EMISOR_NO_CASH } from '../services/non-cash-emitter-gate';

const { postEvento } = vi.hoisted(() => ({ postEvento: vi.fn() }));

vi.mock('../services/posting-engine', () => ({
	postEvento,
}));

import { emitirEventoLiquidacion } from '../services/settlement-posting-service';

type PostEventoMock = ReturnType<typeof vi.fn>;

describe('settlement-posting-service', () => {
	const tenantId = 'tenant-1';
	const userId = 'user-1';
	const fecha = new Date('2026-11-01T12:00:00.000Z');

	function crearTx(monedaFuncional: string | null = 'CUP') {
		return {
			tenantAccountingPolicy: {
				findUnique: vi.fn(async () =>
					monedaFuncional == null
						? null
						: { functionalCurrencyCode: monedaFuncional },
				),
			},
		};
	}

	const conciliacion = {
		reconciliacionId: 'recon-1',
		monto: '125.5000',
		moneda: 'USD',
		montoConvertido: '37725.0000',
		functionalCurrency: null,
		tasaCambio: '300',
		fxEvidenceFingerprint: 'fx-history:2026-11-01:USD-CUP',
		fechaReconciliacion: fecha,
	};

	beforeEach(() => {
		postEvento.mockReset();
		(postEvento as PostEventoMock).mockResolvedValue({
			estado: 'CONTABILIZADO',
			asientoId: 'asiento-1',
		});
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('does nothing while the rollout mode is off', async () => {
		vi.stubEnv(ENV_MODO_EMISOR_NO_CASH, 'off');
		const tx = crearTx();

		const resultado = await emitirEventoLiquidacion(tx as never, { tenantId, userId }, {
			tipo: 'COBRO_CXC',
			reconciliacion: conciliacion,
			treasuryAccountType: 'CORRIENTE',
		});

		expect(resultado).toEqual({ estado: 'OMITIDO', motivo: 'EMISOR_NO_CASH_DESACTIVADO' });
		expect(postEvento).not.toHaveBeenCalled();
	});

	it('emits the collection event with the policy functional currency', async () => {
		vi.stubEnv(ENV_MODO_EMISOR_NO_CASH, 'enforce');
		const tx = crearTx('CUP');

		const resultado = await emitirEventoLiquidacion(tx as never, { tenantId, userId }, {
			tipo: 'COBRO_CXC',
			reconciliacion: conciliacion,
			treasuryAccountType: 'CORRIENTE',
			referencia: 'op-77',
		});

		expect(resultado).toEqual({ estado: 'CONTABILIZADO', asientoId: 'asiento-1' });
		expect(tx.tenantAccountingPolicy.findUnique).toHaveBeenCalledWith({
			where: { tenantId },
			select: { functionalCurrencyCode: true },
		});
		expect(postEvento).toHaveBeenCalledTimes(1);
		const [txArg, ctxArg, evento, opciones] = (postEvento as PostEventoMock).mock.calls[0];
		expect(txArg).toBe(tx);
		expect(ctxArg).toEqual({ tenantId, userId });
		expect(evento).toMatchObject({
			tipo: 'COBRO_CXC',
			origen: { tipo: 'reconciliacion_venta', id: 'recon-1' },
			moneda: 'USD',
			monedaFuncional: 'CUP',
			montoFuncional: '37725.0000',
			medioCobro: 'BANCOS',
			referencia: 'op-77',
		});
		expect(opciones).toEqual({ modo: 'enforce' });
	});

	it('emits the payment event anchored to the expense reconciliation', async () => {
		vi.stubEnv(ENV_MODO_EMISOR_NO_CASH, 'shadow');
		const tx = crearTx('CUP');

		await emitirEventoLiquidacion(tx as never, { tenantId, userId }, {
			tipo: 'PAGO_CXP',
			reconciliacion: conciliacion,
			treasuryAccountType: 'EFECTIVO',
		});

		const [, , evento, opciones] = (postEvento as PostEventoMock).mock.calls[0];
		expect(evento).toMatchObject({
			tipo: 'PAGO_CXP',
			origen: { tipo: 'reconciliacion_gasto', id: 'recon-1' },
			medioCobro: 'CAJA',
		});
		expect(opciones).toEqual({ modo: 'shadow' });
	});

	it('uses the reconciliation functional currency when it is persisted', async () => {
		vi.stubEnv(ENV_MODO_EMISOR_NO_CASH, 'enforce');
		const tx = crearTx('CUP');

		await emitirEventoLiquidacion(tx as never, { tenantId, userId }, {
			tipo: 'COBRO_CXC',
			reconciliacion: { ...conciliacion, functionalCurrency: 'USD' },
		});

		expect(tx.tenantAccountingPolicy.findUnique).not.toHaveBeenCalled();
		const [, , evento] = (postEvento as PostEventoMock).mock.calls[0];
		expect(evento).toMatchObject({ monedaFuncional: 'USD' });
	});

	it('falls back to the amount when the currency is the functional one', async () => {
		vi.stubEnv(ENV_MODO_EMISOR_NO_CASH, 'enforce');
		const tx = crearTx('CUP');

		await emitirEventoLiquidacion(tx as never, { tenantId, userId }, {
			tipo: 'COBRO_CXC',
			reconciliacion: {
				...conciliacion,
				moneda: 'CUP',
				montoConvertido: null,
				tasaCambio: null,
				fxEvidenceFingerprint: null,
			},
		});

		const [, , evento] = (postEvento as PostEventoMock).mock.calls[0];
		expect(evento).toMatchObject({
			moneda: 'CUP',
			monedaFuncional: 'CUP',
			montoFuncional: '125.5000',
		});
	});

	it('leaves the functional amount null when a foreign currency was not converted', async () => {
		vi.stubEnv(ENV_MODO_EMISOR_NO_CASH, 'enforce');
		const tx = crearTx('CUP');

		await emitirEventoLiquidacion(tx as never, { tenantId, userId }, {
			tipo: 'COBRO_CXC',
			reconciliacion: { ...conciliacion, montoConvertido: null },
		});

		const [, , evento] = (postEvento as PostEventoMock).mock.calls[0];
		expect(evento).toMatchObject({ moneda: 'USD', montoFuncional: null });
	});
});
