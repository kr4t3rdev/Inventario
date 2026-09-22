/**
 * @description Contratos de los builders y la discriminación de eventos del
 * lote 2 (compras, gastos y nómina) de la capa de contabilidad formal.
 */
import { describe, expect, it } from 'vitest';

import {
	buildEventoCompraCredito,
	buildEventoEgreso,
	buildEventoGastoConAnticipoProveedor,
	resolverTipoEventoEgreso,
} from '@/features/contabilidad-formal/lib/event-builders';

describe('resolverTipoEventoEgreso', () => {
	it('prioriza CxP sobre nómina, compra y gasto genérico', () => {
		expect(
			resolverTipoEventoEgreso({ cuentaPorPagarId: 'cxp-1', pgId: 'pg-1' }),
		).toBe('PAGO_CXP');
		expect(resolverTipoEventoEgreso({ pgId: 'pg-1' })).toBe('PAGO_NOMINA');
		expect(resolverTipoEventoEgreso({ gastoCompraId: 'gc-1' })).toBe('COMPRA_CONTADO');
		expect(resolverTipoEventoEgreso({})).toBe('GASTO_CONTADO');
	});
});

describe('buildEventoEgreso', () => {
	it('ancla el asiento a la reconciliación de gasto con el tipo pedido', () => {
		const evento = buildEventoEgreso({
			tipo: 'PAGO_NOMINA',
			reconciliacionId: 'rec-g-1',
			descripcion: 'Pago salario septiembre',
			tesoreria: {
				monto: 1500,
				moneda: 'CUP',
				montoFuncional: 1500,
				tipoCuenta: 'EFECTIVO',
			},
		});
		expect(evento.tipo).toBe('PAGO_NOMINA');
		expect(evento.origen).toEqual({ tipo: 'reconciliacion_gasto', id: 'rec-g-1' });
		expect(evento.medioCobro).toBe('CAJA');
		expect(evento.montoFuncional).toBe(1500);
	});

	it('respeta la moneda y la valoración funcional', () => {
		const evento = buildEventoEgreso({
			tipo: 'PAGO_CXP',
			reconciliacionId: 'rec-g-2',
			tesoreria: {
				monto: 25,
				moneda: 'USD',
				montoFuncional: 1125,
				monedaFuncionalCodigo: 'CUP',
				tasaCambio: 45,
				fxEvidenceFingerprint: 'fp-9',
				tipoCuenta: 'AHORROS',
			},
		});
		expect(evento.moneda).toBe('USD');
		expect(evento.monedaFuncional).toBe('CUP');
		expect(evento.montoFuncional).toBe(1125);
		expect(evento.medioCobro).toBe('BANCOS');
	});
});

describe('buildEventoCompraCredito', () => {
	it('ancla el evento al documento de compra con el total de la CxP', () => {
		const evento = buildEventoCompraCredito({
			compraId: 'cmp-1',
			monto: 4300,
			moneda: 'CUP',
			descripcion: 'Compra crédito FC-88',
			referencia: 'FC-88',
		});
		expect(evento.tipo).toBe('COMPRA_CREDITO');
		expect(evento.origen).toEqual({ tipo: 'compra_documento', id: 'cmp-1' });
		expect(evento.monto).toBe(4300);
		expect(evento.montoFuncional).toBe(4300);
	});
});

describe('buildEventoGastoConAnticipoProveedor', () => {
	it('no lleva medio de cobro bancario', () => {
		const evento = buildEventoGastoConAnticipoProveedor({
			reconciliacionId: 'rec-ant-1',
			tesoreria: { monto: 600, moneda: 'CUP', montoFuncional: 600 },
		});
		expect(evento.tipo).toBe('GASTO_CON_ANTICIPO_PROVEEDOR');
		expect(evento.medioCobro).toBeUndefined();
		expect(evento.origen).toEqual({ tipo: 'reconciliacion_gasto', id: 'rec-ant-1' });
	});
});
