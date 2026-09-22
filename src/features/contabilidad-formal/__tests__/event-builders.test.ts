/**
 * @description Contratos de los builders puros de eventos (CTA-1 T4).
 * Verifican el mapeo payload real → EventoContableInput, incluida la resolución
 * del medio de tesorería por tipo de cuenta.
 */
import { describe, expect, it } from 'vitest';

import {
	buildEventoCobroCxc,
	buildEventoCostoVenta,
	buildEventoDevolucionVenta,
	buildEventoVentaContado,
	buildEventoVentaCredito,
	medioPorTipoCuenta,
} from '@/features/contabilidad-formal/lib/event-builders';

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
	it('ancla el evento a la factura y usa moneda funcional', () => {
		const evento = buildEventoVentaCredito({
			facturaId: 'fac-1',
			monto: 8000,
			referencia: 'FV-000004',
		});
		expect(evento.tipo).toBe('VENTA_CREDITO');
		expect(evento.origen).toEqual({ tipo: 'factura', id: 'fac-1' });
		expect(evento.monto).toBe(8000);
		expect(evento.montoFuncional).toBe(8000);
		expect(evento.moneda).toBe('CUP');
	});
});

describe('buildEventoCostoVenta', () => {
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
});

describe('buildEventoDevolucionVenta', () => {
	it('incluye el costo restaurado cuando existe', () => {
		const evento = buildEventoDevolucionVenta({
			devolucionId: 'dev-1',
			total: 350,
			costoFifoRestaurado: 210,
		});
		expect(evento.tipo).toBe('DEVOLUCION_VENTA');
		expect(evento.montoFuncional).toBe(350);
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
