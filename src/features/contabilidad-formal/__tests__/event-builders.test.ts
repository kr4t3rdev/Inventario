/**
 * @description Contratos de los builders puros de eventos (CTA-1 T4).
 * Verifican el mapeo payload real → EventoContableInput, incluida la resolución
 * del medio de tesorería por tipo de cuenta.
 */
import { describe, expect, it } from 'vitest';
import { Prisma } from '@/generated/prisma';

import {
	buildEventoCobroCxc,
	buildEventoCobroPrestamo,
	buildEventoCompraCredito,
	buildEventoCostoVenta,
	buildEventoDevolucionVenta,
	buildEventoVentaContado,
	buildEventoVentaCredito,
	medioPorTipoCuenta,
	resolverTipoEventoEgreso,
} from '@/features/contabilidad-formal/lib/event-builders';

describe('resolverTipoEventoEgreso (fila 24)', () => {
	it('resuelve PAGO_CXP, PAGO_NOMINA, COMPRA_CONTADO y GASTO_CONTADO por referencia', () => {
		expect(resolverTipoEventoEgreso({ cuentaPorPagarId: 'cxp-1' })).toBe('PAGO_CXP');
		expect(resolverTipoEventoEgreso({ pgId: 'pg-1' })).toBe('PAGO_NOMINA');
		expect(resolverTipoEventoEgreso({ gastoCompraId: 'gc-1' })).toBe('COMPRA_CONTADO');
		expect(resolverTipoEventoEgreso({})).toBe('GASTO_CONTADO');
	});

	it('prioriza CxP sobre las demás referencias y acepta nulos', () => {
		expect(resolverTipoEventoEgreso({
			cuentaPorPagarId: 'cxp-1', pgId: 'pg-1', gastoCompraId: 'gc-1',
		})).toBe('PAGO_CXP');
		expect(resolverTipoEventoEgreso({
			cuentaPorPagarId: null, pgId: 'pg-1', gastoCompraId: 'gc-1',
		})).toBe('PAGO_NOMINA');
		expect(resolverTipoEventoEgreso({
			cuentaPorPagarId: null, pgId: null, gastoCompraId: 'gc-1',
		})).toBe('COMPRA_CONTADO');
	});
});

describe('medioPorTipoCuenta', () => {
	it('EFECTIVO mapea a CAJA y el resto a BANCOS', () => {
		expect(medioPorTipoCuenta('EFECTIVO')).toBe('CAJA');
		expect(medioPorTipoCuenta('AHORROS')).toBe('BANCOS');
		expect(medioPorTipoCuenta('CORRIENTE')).toBe('BANCOS');
		expect(medioPorTipoCuenta(null)).toBe('BANCOS');
		expect(medioPorTipoCuenta(undefined)).toBe('BANCOS');
	});
});

describe('buildEventoVentaContado', () => {
	it('preserva Decimal y texto exacto en monto, monto funcional y tasa FX', () => {
		const monto = new Prisma.Decimal('0.123456789123');
		const tasaCambio = new Prisma.Decimal('44.0000000001');
		const montoFuncional = '5.432198765432';
		const evento = buildEventoVentaContado({
			reconciliacionId: 'rec-decimal',
			tesoreria: {
				monto,
				moneda: 'USD',
				montoFuncional,
				tasaCambio,
			},
		});

		expect(evento.monto).toBe(monto);
		expect(evento.montoFuncional).toBe(montoFuncional);
		expect(evento.tasaCambio).toBe(tasaCambio);
	});

	it('construye el evento con la valoración original heredada', () => {
		const evento = buildEventoVentaContado({
			reconciliacionId: 'rec-1',
			descripcion: 'Cobro mostrador',
			tesoreria: {
				monto: 25,
				moneda: 'USD',
				montoFuncional: 1100,
				tasaCambio: 44,
				fxEvidenceFingerprint: 'fp-abc',
				tipoCuenta: 'AHORROS',
				referencia: 'AUTO-123',
			},
		});

		expect(evento.tipo).toBe('VENTA_CONTADO');
		expect(evento.origen).toEqual({ tipo: 'reconciliacion_venta', id: 'rec-1' });
		expect(evento.monto).toBe(25);
		expect(evento.moneda).toBe('USD');
		expect(evento.montoFuncional).toBe(1100);
		expect(evento.tasaCambio).toBe(44);
		expect(evento.fxEvidenceFingerprint).toBe('fp-abc');
		expect(evento.medioCobro).toBe('BANCOS');
		expect(evento.referencia).toBe('AUTO-123');
	});

	it('cuenta de efectivo produce medioCobro CAJA', () => {
		const evento = buildEventoVentaContado({
			reconciliacionId: 'rec-2',
			tesoreria: { monto: 100, moneda: 'CUP', montoFuncional: 100, tipoCuenta: 'EFECTIVO' },
		});
		expect(evento.medioCobro).toBe('CAJA');
		expect(evento.tasaCambio).toBeNull();
	});

	it('usa la moneda funcional de la evidencia FX cuando existe', () => {
		const evento = buildEventoVentaContado({
			reconciliacionId: 'rec-3',
			tesoreria: {
				monto: 25,
				moneda: 'USD',
				montoFuncional: 1100,
				monedaFuncionalCodigo: 'CUP',
			},
		});
		expect(evento.monedaFuncional).toBe('CUP');
	});

	it('cae a CUP cuando no hay evidencia de moneda funcional', () => {
		const evento = buildEventoVentaContado({
			reconciliacionId: 'rec-4',
			tesoreria: { monto: 10, moneda: 'CUP', montoFuncional: 10 },
		});
		expect(evento.monedaFuncional).toBe('CUP');
	});
});

describe('buildEventoCobroCxc', () => {
	it('marca el tipo COBRO_CXC con el mismo anclaje de origen', () => {
		const evento = buildEventoCobroCxc({
			reconciliacionId: 'rec-9',
			tesoreria: { monto: 500, moneda: 'CUP', montoFuncional: 500 },
		});
		expect(evento.tipo).toBe('COBRO_CXC');
		expect(evento.origen).toEqual({ tipo: 'reconciliacion_venta', id: 'rec-9' });
		expect(evento.descripcion).toContain('cuenta por cobrar');
	});
});

describe('buildEventoVentaCredito', () => {
	it('no inventa moneda CUP ni valoración funcional cuando falta evidencia', () => {
		const evento = buildEventoVentaCredito({
			facturaId: 'fac-1',
			monto: 8000,
			referencia: 'FV-000004',
		});
		expect(evento.tipo).toBe('VENTA_CREDITO');
		expect(evento.origen).toEqual({ tipo: 'factura', id: 'fac-1' });
		expect(evento.monto).toBe(8000);
		expect(evento.montoFuncional).toBeNull();
		expect(evento.moneda).toBeNull();
		expect(evento.monedaFuncional).toBeNull();
	});

	it('preserva todos los datos de valoración explícita sin normalizarlos', () => {
		const montoFuncional = new Prisma.Decimal('123.456789');
		const tasaCambio = '44.0000000001';
		const evento = buildEventoVentaCredito({
			facturaId: 'fac-fx',
			monto: new Prisma.Decimal('2.801234'),
			valoracion: {
				moneda: 'USD',
				montoFuncional,
				monedaFuncional: 'CUP',
				tasaCambio,
				fxEvidenceFingerprint: 'fx-fingerprint',
			},
		});

		expect(evento.moneda).toBe('USD');
		expect(evento.montoFuncional).toBe(montoFuncional);
		expect(evento.monedaFuncional).toBe('CUP');
		expect(evento.tasaCambio).toBe(tasaCambio);
		expect(evento.fxEvidenceFingerprint).toBe('fx-fingerprint');
	});
});

describe('buildEventoCompraCredito', () => {
	it('preserva Decimal y texto exacto de la valoración y tasa FX', () => {
		const monto = new Prisma.Decimal('0.123456789123');
		const tasaCambio = '44.0000000001';
		const evento = buildEventoCompraCredito({
			compraId: 'compra-decimal',
			monto,
			montoFuncional: '5.432198765432',
			tasaCambio,
		});

		expect(evento.monto).toBe(monto);
		expect(evento.montoFuncional).toBe('5.432198765432');
		expect(evento.tasaCambio).toBe(tasaCambio);
	});
});

describe('buildEventoCostoVenta', () => {
	it('preserva Decimal en el costo y su auxiliar', () => {
		const costoFifo = new Prisma.Decimal('0.000000000123');
		const evento = buildEventoCostoVenta({ ventaId: 'venta-decimal', costoFifo });

		expect(evento.monto).toBe(costoFifo);
		expect(evento.montoFuncional).toBe(costoFifo);
		expect(evento.auxiliares?.costoFifo).toBe(costoFifo);
	});

	it('lleva el costo FIFO en auxiliares y como monto del evento', () => {
		const evento = buildEventoCostoVenta({
			ventaId: 'venta-1',
			costoFifo: 640,
		});
		expect(evento.tipo).toBe('COSTO_VENTA_DEVENGADO');
		expect(evento.origen).toEqual({ tipo: 'venta_costo', id: 'venta-1' });
		expect(evento.auxiliares?.costoFifo).toBe(640);
		expect(evento.montoFuncional).toBe(640);
	});

	it('usa la moneda funcional explícita para el costo FIFO convertido', () => {
		const evento = buildEventoCostoVenta({
			ventaId: 'venta-funcional-usd',
			costoFifo: new Prisma.Decimal('12.34'),
			monedaFuncional: 'USD',
		});

		expect(evento.moneda).toBe('USD');
		expect(evento.monedaFuncional).toBe('USD');
		expect(evento.montoFuncional?.toString()).toBe('12.34');
	});

	it('construye un evento no valorizado para registrar el error en shadow', () => {
		const evento = buildEventoCostoVenta({
			ventaId: 'venta-sin-fx',
			costoFifo: null,
			monedaFuncional: null,
		});

		expect(evento.moneda).toBeNull();
		expect(evento.monedaFuncional).toBeNull();
		expect(evento.montoFuncional).toBeNull();
		expect(evento.auxiliares).toBeUndefined();
	});
});

describe('buildEventoCobroPrestamo', () => {
	it('preserva Decimal positivo como auxiliar de intereses', () => {
		const intereses = new Prisma.Decimal('0.000000000123');
		const evento = buildEventoCobroPrestamo({
			reconciliacionId: 'rec-interes-decimal',
			valoracion: { monto: 1, moneda: 'CUP' },
			intereses,
		});

		expect(evento.auxiliares?.intereses).toBe(intereses);
	});
});

describe('buildEventoDevolucionVenta', () => {
	it('hereda moneda y valoración FX autoritativas de la venta original', () => {
		const evento = buildEventoDevolucionVenta({
			devolucionId: 'dev-usd',
			total: '1000',
			valoracion: {
				moneda: 'USD',
				montoFuncional: '24000',
				monedaFuncional: 'CUP',
				tasaCambio: '24',
				fxEvidenceFingerprint: 'source-fingerprint',
			},
		});

		expect(evento.monto).toBe('1000');
		expect(evento.moneda).toBe('USD');
		expect(evento.montoFuncional).toBe('24000');
		expect(evento.monedaFuncional).toBe('CUP');
		expect(evento.tasaCambio).toBe('24');
		expect(evento.fxEvidenceFingerprint).toBe('source-fingerprint');
	});

	it('preserva texto decimal del total, FX y costo auxiliar', () => {
		const evento = buildEventoDevolucionVenta({
			devolucionId: 'dev-decimal',
			total: '12.345678901234',
			valoracion: {
				moneda: 'CUP',
				montoFuncional: '12.345678901234',
				monedaFuncional: 'CUP',
				tasaCambio: '1.0000000001',
			},
			costoFifoRestaurado: '0.000000000123',
		});

		expect(evento.monto).toBe('12.345678901234');
		expect(evento.montoFuncional).toBe('12.345678901234');
		expect(evento.tasaCambio).toBe('1.0000000001');
		expect(evento.auxiliares?.costoFifo).toBe('0.000000000123');
	});

	it('incluye el costo restaurado cuando existe', () => {
		const evento = buildEventoDevolucionVenta({
			devolucionId: 'dev-1',
			total: 350,
			costoFifoRestaurado: 210,
		});
		expect(evento.tipo).toBe('DEVOLUCION_VENTA');
		expect(evento.montoFuncional).toBeNull();
		expect(evento.moneda).toBeNull();
		expect(evento.auxiliares?.costoFifo).toBe(210);
	});

	it('omite auxiliares cuando no hay costo restaurado', () => {
		const evento = buildEventoDevolucionVenta({
			devolucionId: 'dev-2',
			total: 100,
		});
		expect(evento.auxiliares).toBeUndefined();
	});
});
