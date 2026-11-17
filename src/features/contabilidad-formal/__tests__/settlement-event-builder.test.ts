import { describe, expect, it } from 'vitest';

import {
	buildCobroCxcEvent,
	buildCobroServicioEvent,
	buildPagoCxpEvent,
	buildSettlementEvent,
	derivarMedioCobro,
} from '../lib/settlement-event-builder';

describe('settlement-event-builder', () => {
	const fecha = new Date('2026-11-01T12:00:00.000Z');
	const common = {
		reconciliationId: 'recon-1',
		amount: '125.5000',
		currency: 'USD',
		functionalAmount: '37725.0000',
		functionalCurrency: 'CUP',
		exchangeRate: '300',
		fxEvidenceFingerprint: 'fx-history:2026-11-01:USD-CUP',
		fecha,
		reference: 'op-77',
	} as const;

	it('builds a receivable collection preserving the persisted valuation', () => {
		expect(buildCobroCxcEvent({ ...common, treasuryAccountType: 'CORRIENTE' })).toEqual({
			tipo: 'COBRO_CXC',
			fecha,
			descripcion: 'Cobro de cuenta por cobrar',
			origen: { tipo: 'reconciliacion_venta', id: 'recon-1' },
			monto: '125.5000',
			moneda: 'USD',
			montoFuncional: '37725.0000',
			monedaFuncional: 'CUP',
			tasaCambio: '300',
			fxEvidenceFingerprint: 'fx-history:2026-11-01:USD-CUP',
			medioCobro: 'BANCOS',
			referencia: 'op-77',
			auxiliares: { diferenciaFx: 0 },
		});
	});

	it('builds a payable payment anchored to the expense reconciliation', () => {
		expect(buildPagoCxpEvent({ ...common, treasuryAccountType: 'EFECTIVO' })).toEqual({
			tipo: 'PAGO_CXP',
			fecha,
			descripcion: 'Pago de cuenta por pagar',
			origen: { tipo: 'reconciliacion_gasto', id: 'recon-1' },
			monto: '125.5000',
			moneda: 'USD',
			montoFuncional: '37725.0000',
			monedaFuncional: 'CUP',
			tasaCambio: '300',
			fxEvidenceFingerprint: 'fx-history:2026-11-01:USD-CUP',
			medioCobro: 'CAJA',
			referencia: 'op-77',
			auxiliares: { diferenciaFx: 0 },
		});
	});

	it('builds a service collection anchored to the service reconciliation', () => {
		expect(buildCobroServicioEvent({ ...common, treasuryAccountType: 'EFECTIVO' })).toEqual({
			tipo: 'COBRO_SERVICIO',
			fecha,
			descripcion: 'Cobro de servicio',
			origen: { tipo: 'reconciliacion_servicio', id: 'recon-1' },
			monto: '125.5000',
			moneda: 'USD',
			montoFuncional: '37725.0000',
			monedaFuncional: 'CUP',
			tasaCambio: '300',
			fxEvidenceFingerprint: 'fx-history:2026-11-01:USD-CUP',
			medioCobro: 'CAJA',
			referencia: 'op-77',
			auxiliares: { diferenciaFx: 0 },
		});
	});

	it('omits the treasury role when the treasury account type is unknown', () => {
		expect(buildCobroCxcEvent({ ...common }).medioCobro).toBeUndefined();
		expect(buildCobroCxcEvent({ ...common, treasuryAccountType: null }).medioCobro).toBeUndefined();
	});

	it('maps the treasury account type to the formal cash role', () => {
		expect(derivarMedioCobro('EFECTIVO')).toBe('CAJA');
		expect(derivarMedioCobro('CORRIENTE')).toBe('BANCOS');
		expect(derivarMedioCobro('AHORRO')).toBe('BANCOS');
		expect(derivarMedioCobro(null)).toBe('BANCOS');
	});

	it('keeps a null functional amount so the engine can fail closed', () => {
		const evento = buildCobroCxcEvent({
			...common,
			functionalAmount: null,
			exchangeRate: null,
			fxEvidenceFingerprint: null,
		});
		expect(evento.montoFuncional).toBeNull();
		expect(evento.tasaCambio).toBeNull();
		expect(evento.fxEvidenceFingerprint).toBeNull();
	});

	it('preserva la diferencia de cambio y origen propio de un cobro externo', () => {
		const input = { ...common, valorContableAplicado: '37705.0000' };
		const evento = buildSettlementEvent(input, 'COBRO_CXC', 'cobro_cxc_externo');
		expect(evento.origen).toEqual({ tipo: 'cobro_cxc_externo', id: 'recon-1' });
		expect(evento.auxiliares).toEqual({ diferenciaFx: '20' });
	});

	it('exige diferencia explícita y conserva diferencias negativas en cobros externos', () => {
		expect(() => buildSettlementEvent(common, 'COBRO_CXC', 'cobro_cxc_externo')).toThrow(
			'El cobro externo requiere importes funcionales verificables',
		);
		expect(buildSettlementEvent({ ...common, valorContableAplicado: '37745' }, 'COBRO_CXC', 'cobro_cxc_externo').auxiliares)
			.toEqual({ diferenciaFx: '-20' });
	});

	it('rechaza usar origen de cobro externo en otra familia de eventos', () => {
		expect(() => buildSettlementEvent({ ...common, valorContableAplicado: '37725' }, 'PAGO_CXP', 'cobro_cxc_externo'))
			.toThrow('El origen externo solo corresponde a cobros de CxC');
	});

	it('deriva la diferencia externa de los importes funcionales recibidos y aplicados', () => {
		const input = { ...common, valorContableAplicado: '37705.0000' };
		const evento = buildSettlementEvent(input, 'COBRO_CXC', 'cobro_cxc_externo');
		expect(evento.auxiliares).toEqual({ diferenciaFx: '20' });
	});

	it('calcula exactamente la diferencia sin redondear valores grandes', () => {
		const evento = buildSettlementEvent({ ...common, functionalAmount: '9999999999999999.9999',
			valorContableAplicado: '9999999999999999.9998' }, 'COBRO_CXC', 'cobro_cxc_externo');
		expect(evento.auxiliares).toEqual({ diferenciaFx: '0.0001' });
	});

	it.each(['', '-1', '0.00001', 'NaN', '10000000000000000', '1e3'])(
		'rechaza el valor contable no verificable %s', (valorContableAplicado) => {
			expect(() => buildSettlementEvent({ ...common, valorContableAplicado }, 'COBRO_CXC', 'cobro_cxc_externo')).toThrow();
		},
	);

	it('rechaza importes funcionales cero o expresados como número flotante', () => {
		expect(() => buildSettlementEvent({ ...common, functionalAmount: '0', valorContableAplicado: '1' }, 'COBRO_CXC', 'cobro_cxc_externo')).toThrow();
		expect(() => buildSettlementEvent({ ...common, functionalAmount: 1, valorContableAplicado: '1' }, 'COBRO_CXC', 'cobro_cxc_externo')).toThrow();
	});
});
