/**
 * @description Tests de la regla pura de comisiones (CMV-T2).
 */
import { describe, it, expect } from 'vitest';
import {
	calcularComisionReport,
} from '@/features/empleados/services/comision-service';

const ventasBase = [
	{ empleadoId: 'e-1', total: 5000, estado: 'FACTURADA', deletedAt: null },
	{ empleadoId: 'e-1', total: 3000, estado: 'ENTREGADA', deletedAt: null },
	{ empleadoId: 'e-1', total: 1000, estado: 'ANULADA', deletedAt: null }, // no cuenta
	{ empleadoId: 'e-1', total: 2000, estado: 'PEDIDO', deletedAt: null }, // no cuenta
];

describe('regla pura de comisiones (CMV-T2)', () => {
	it('computa ventas elegibles (ENTREGADA/FACTURADA) menos devoluciones', () => {
		const r = calcularComisionReport({
			ventas: ventasBase,
			devoluciones: [
				{ ventaId: 'v-1', ventaTotal: 5000, cantidad: 2, precioUnitario: 2500, total: 5000 },
			],
			empleadoId: 'e-1',
			comisionPct: 10,
		});
		// 5000 (FACTURADA) + 3000 (ENTREGADA) = 8000; menos NC de 5000 → base 3000
		expect(r.ventasElegibles).toBe(3000);
		expect(r.comisionCalculada).toBe(300); // 10% de 3000
		expect(r.baseBruta).toBe(8000);
		expect(r.devolucionesElegibles).toBe(5000);
	});

	it('comisión 0% no genera importe', () => {
		const r = calcularComisionReport({
			ventas: ventasBase,
			devoluciones: [],
			empleadoId: 'e-1',
			comisionPct: 0,
		});
		expect(r.ventasElegibles).toBe(8000);
		expect(r.comisionCalculada).toBe(0);
	});

	it('progreso de meta: porcentaje y estado', () => {
		const r = calcularComisionReport({
			ventas: ventasBase,
			devoluciones: [],
			empleadoId: 'e-1',
		});
		// sin meta → progreso 0
		expect(r.meta).toBeNull();
	});

	it('con meta: progreso 100% cumplido', () => {
		const r = calcularComisionReport({
			ventas: ventasBase,
			devoluciones: [],
			empleadoId: 'e-1',
			metaMensual: 8000,
		});
		expect(r.meta?.progreso).toBe(100);
		expect(r.meta?.cumplida).toBe(true);
	});
});

describe('borde de la regla', () => {
	it('devolución mayor que la venta no baja la comisión por debajo de 0', () => {
		const r = calcularComisionReport({
			ventas: ventasBase.slice(0, 1), // solo FACTURADA 5000
			devoluciones: [{ ventaId: 'v-1', total: 8000, cantidad: 1, precioUnitario: 8000, ventaTotal: 5000 }],
			empleadoId: 'e-1',
			comisionPct: 10,
		});
		expect(r.baseNeta).toBe(0);
		expect(r.devolucionesElegibles).toBe(5000); // se capa al total de la venta
		expect(r.comisionCalculada).toBe(0);
	});
});
