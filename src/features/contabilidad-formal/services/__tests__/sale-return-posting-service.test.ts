/**
 * @description Test focal del emisor formal de la devolución de venta.
 *
 * La devolución reparte el importe devuelto entre cuentas por cobrar
 * aplicadas, saldo a favor del cliente y reembolso en efectivo, y repone la
 * mercadería en inventario por su costo FIFO. El emisor consume el desglose
 * que el writer operativo ya resolvió y la valoración que el writer persistió.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const postEvento = vi.hoisted(() => vi.fn().mockResolvedValue({ estado: 'OMITIDO' }));

vi.mock('@/features/contabilidad-formal/services/posting-engine', async () => {
	const real = await vi.importActual<
		typeof import('@/features/contabilidad-formal/services/posting-engine')
	>('@/features/contabilidad-formal/services/posting-engine');
	return { ...real, postEvento };
});

import { emitirDevolucionVenta } from '../sale-return-posting-service';

describe('emisor formal de la devolucion de venta', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		postEvento.mockResolvedValue({ estado: 'OMITIDO' });
	});

	function crearTx(functionalCurrencyCode: string | null = 'CUP') {
		return {
			tenantAccountingPolicy: {
				findUnique: vi.fn().mockResolvedValue(
					functionalCurrencyCode === null
						? null
						: { functionalCurrencyCode },
				),
			},
		};
	}

	it('revierte el ingreso con el desglose de cuentas por cobrar, anticipo y reembolso', async () => {
		const tx = crearTx();

		await emitirDevolucionVenta(tx as never, { tenantId: 'tenant-1', userId: 'user-1' }, {
			devolucionId: 'devolucion-1',
			fecha: new Date('2026-10-05T00:00:00.000Z'),
			monto: 1000,
			moneda: 'CUP',
			montoAplicadoCxc: 600,
			montoSaldoFavor: 250,
			montoReembolsado: 150,
			costoFifo: 400,
			descripcion: 'Devolucion de la venta v-1',
			referencia: 'devolucion-key-1',
		});

		expect(postEvento).toHaveBeenCalledWith(
			tx,
			{ tenantId: 'tenant-1', userId: 'user-1' },
			expect.objectContaining({
				tipo: 'DEVOLUCION_VENTA',
				origen: { tipo: 'devolucion_venta', id: 'devolucion-1' },
				monto: 1000,
				moneda: 'CUP',
				montoFuncional: 1000,
				monedaFuncional: 'CUP',
				referencia: 'devolucion-key-1',
				auxiliares: {
					montoAplicadoCxc: 600,
					montoSaldoFavor: 250,
					montoReembolsado: 150,
					costoFifo: 400,
				},
			}),
		);
	});

	it('omite las salidas que no aplican y conserva el costo FIFO repuesto', async () => {
		const tx = crearTx();

		await emitirDevolucionVenta(tx as never, { tenantId: 'tenant-1', userId: 'user-1' }, {
			devolucionId: 'devolucion-2',
			fecha: new Date('2026-10-05T00:00:00.000Z'),
			monto: 800,
			moneda: 'CUP',
			montoAplicadoCxc: 800,
			montoSaldoFavor: 0,
			montoReembolsado: 0,
			costoFifo: 320,
		});

		const evento = postEvento.mock.calls[0][2];
		expect(evento.auxiliares).toEqual({
			montoAplicadoCxc: 800,
			montoSaldoFavor: 0,
			montoReembolsado: 0,
			costoFifo: 320,
		});
	});

	it('convierte las tres salidas con la tasa persistida y deja el saldo a favor como residuo', async () => {
		const tx = crearTx('CUP');

		await emitirDevolucionVenta(tx as never, { tenantId: 'tenant-1', userId: 'user-1' }, {
			devolucionId: 'devolucion-3',
			fecha: new Date('2026-10-05T00:00:00.000Z'),
			monto: 100,
			moneda: 'USD',
			montoAplicadoCxc: 60,
			montoSaldoFavor: 25,
			montoReembolsado: 15,
			tasaCambio: 250,
		});

		const evento = postEvento.mock.calls[0][2];
		expect(evento.montoFuncional).toBe(25000);
		expect(evento.tasaCambio).toBe(250);
		expect(evento.fxEvidenceFingerprint).toBeTruthy();
		expect(evento.auxiliares.montoAplicadoCxc).toBe(15000);
		expect(evento.auxiliares.montoReembolsado).toBe(3750);
		// El saldo a favor es el residuo: absorbe el redondeo y cuadra el asiento.
		expect(evento.auxiliares.montoSaldoFavor).toBe(6250);
		expect(
			evento.auxiliares.montoAplicadoCxc +
				evento.auxiliares.montoSaldoFavor +
				evento.auxiliares.montoReembolsado,
		).toBe(evento.montoFuncional);
	});

	it('deja la valoracion funcional nula cuando no hay tasa (falla cerrada)', async () => {
		const tx = crearTx('CUP');

		await emitirDevolucionVenta(tx as never, { tenantId: 'tenant-1', userId: 'user-1' }, {
			devolucionId: 'devolucion-4',
			fecha: new Date('2026-10-05T00:00:00.000Z'),
			monto: 100,
			moneda: 'USD',
			montoAplicadoCxc: 100,
			montoSaldoFavor: 0,
			montoReembolsado: 0,
		});

		const evento = postEvento.mock.calls[0][2];
		expect(evento.montoFuncional).toBeNull();
		expect(evento.auxiliares.montoAplicadoCxc).toBeUndefined();
	});
});
