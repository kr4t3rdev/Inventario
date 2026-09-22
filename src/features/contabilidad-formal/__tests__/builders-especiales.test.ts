/**
 * @description Contratos de los builders de eventos especiales (CTA-1 lote 3):
 * transferencias, ajustes, capital, préstamos, deudas, anticipos, servicios,
 * mermas y producción.
 */
import { describe, expect, it } from 'vitest';

import {
	buildEventoAjusteBancario,
	buildEventoAnticipoAplicado,
	buildEventoAnticipoCreado,
	buildEventoCobroPrestamo,
	buildEventoDeudaRecibida,
	buildEventoInyeccionCapital,
	buildEventoMerma,
	buildEventoPagoDeuda,
	buildEventoPagoDeudaCapital,
	buildEventoPrestamoOtorgado,
	buildEventoProduccionSalida,
	buildEventoServicio,
	buildEventoTransferenciaBancaria,
} from '@/features/contabilidad-formal/lib/event-builders';

describe('builders lote 3', () => {
	it('transferencia bancaria conserva montos por lado', () => {
		const evento = buildEventoTransferenciaBancaria({
			transferenciaId: 'trf-1',
			montoOrigen: 100,
			monedaOrigen: 'USD',
			montoDestino: 4500,
			monedaDestino: 'CUP',
			tasaCambio: 45,
			referencia: 'TRF-000001',
		});
		expect(evento.tipo).toBe('TRANSFERENCIA_BANCARIA');
		expect(evento.monto).toBe(100);
		expect(evento.montoFuncional).toBe(4500);
		expect(evento.origen).toEqual({ tipo: 'transferencia_bancaria', id: 'trf-1' });
	});

	it('ajuste bancario mapea tipo ingreso/egreso a abono/cargo', () => {
		const base = { ajusteId: 'aju-1', valoracion: { monto: 10, moneda: 'CUP' } };
		expect(buildEventoAjusteBancario({ ...base, tipo: 'egreso' }).tipo).toBe(
			'AJUSTE_BANCARIO_CARGO',
		);
		expect(buildEventoAjusteBancario({ ...base, tipo: 'ingreso' }).tipo).toBe(
			'AJUSTE_BANCARIO_ABONO',
		);
	});

	it('inyección de capital y pago de deuda de capital', () => {
		const inyeccion = buildEventoInyeccionCapital({
			inyeccionId: 'inj-1',
			valoracion: { monto: 1000, moneda: 'CUP' },
		});
		expect(inyeccion.tipo).toBe('INYECCION_CAPITAL');
		expect(inyeccion.origen).toEqual({ tipo: 'inyeccion_capital', id: 'inj-1' });

		const pago = buildEventoPagoDeudaCapital({
			pagoDeudaId: 'pd-1',
			valoracion: { monto: 200, moneda: 'CUP' },
		});
		expect(pago.tipo).toBe('PAGO_DEUDA_CAPITAL');
	});

	it('préstamo otorgado y cobro con intereses vía auxiliares', () => {
		const otorgado = buildEventoPrestamoOtorgado({
			prestamoId: 'pre-1',
			valoracion: { monto: 500, moneda: 'CUP' },
		});
		expect(otorgado.tipo).toBe('PRESTAMO_OTORGADO');

		const cobro = buildEventoCobroPrestamo({
			reconciliacionId: 'rec-p-1',
			valoracion: { monto: 600, moneda: 'CUP' },
			intereses: 100,
		});
		expect(cobro.tipo).toBe('COBRO_PRESTAMO');
		expect(cobro.auxiliares?.intereses).toBe(100);

		const cobroSinInteres = buildEventoCobroPrestamo({
			reconciliacionId: 'rec-p-2',
			valoracion: { monto: 100, moneda: 'CUP' },
		});
		expect(cobroSinInteres.auxiliares).toBeUndefined();
	});

	it('deuda recibida y pago de deuda', () => {
		const rec = buildEventoDeudaRecibida({
			deudaId: 'deu-1',
			valoracion: { monto: 800, moneda: 'CUP' },
		});
		expect(rec.tipo).toBe('DEUDA_RECIBIDA');

		const pago = buildEventoPagoDeuda({
			reconciliacionId: 'rec-d-1',
			valoracion: { monto: 800, moneda: 'CUP' },
		});
		expect(pago.tipo).toBe('PAGO_DEUDA');
		expect(pago.origen).toEqual({ tipo: 'reconciliacion_venta', id: 'rec-d-1' });
	});

	it('anticipo creado mapea COBRO→recibido y PAGO→entregado', () => {
		expect(
			buildEventoAnticipoCreado({
				anticipoId: 'ant-1',
				tipo: 'COBRO',
				valoracion: { monto: 100, moneda: 'CUP' },
			}).tipo,
		).toBe('ANTICIPO_CLIENTE_RECIBIDO');
		expect(
			buildEventoAnticipoCreado({
				anticipoId: 'ant-2',
				tipo: 'PAGO',
				valoracion: { monto: 100, moneda: 'CUP' },
			}).tipo,
		).toBe('ANTICIPO_PROVEEDOR_ENTREGADO');
	});

	it('anticipo aplicado mapea CLIENTE/PROVEEDOR', () => {
		expect(
			buildEventoAnticipoAplicado({
				movimientoId: 'mov-1',
				tipo: 'CLIENTE',
				valoracion: { monto: 50, moneda: 'CUP' },
			}).tipo,
		).toBe('ANTICIPO_CLIENTE_APLICADO');
		expect(
			buildEventoAnticipoAplicado({
				movimientoId: 'mov-2',
				tipo: 'PROVEEDOR',
				valoracion: { monto: 50, moneda: 'CUP' },
			}).tipo,
		).toBe('ANTICIPO_PROVEEDOR_APLICADO');
	});

	it('servicio, merma y producción llevan origen correcto y moneda funcional', () => {
		const servicio = buildEventoServicio({
			cobro: false,
			reconciliacionId: 'rec-s-1',
			tesoreria: { monto: 300, moneda: 'CUP', montoFuncional: 300 },
		});
		expect(servicio.tipo).toBe('VENTA_SERVICIO');
		expect(servicio.origen).toEqual({ tipo: 'reconciliacion_servicio', id: 'rec-s-1' });

		const merma = buildEventoMerma({ mermaId: 'mer-1', costo: 42 });
		expect(merma.tipo).toBe('MERMA_INVENTARIO');
		expect(merma.montoFuncional).toBe(42);

		const produccion = buildEventoProduccionSalida({ ordenId: 'op-1', costo: 77 });
		expect(produccion.tipo).toBe('PRODUCCION_SALIDA');
		expect(produccion.auxiliares).toBeUndefined();
	});
});
