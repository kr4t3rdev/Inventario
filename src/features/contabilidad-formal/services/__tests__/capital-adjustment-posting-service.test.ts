/**
 * @description Test focal del emisor formal de ajustes bancarios e inyecciones
 * de capital.
 *
 * Los ajustes y las inyecciones mueven la tesoreria sin liquidar cuentas por
 * cobrar ni pagar: su asiento formal usa las plantillas del plan y consume la
 * valoracion que el writer operativo ya persistio.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const postEvento = vi.hoisted(() => vi.fn().mockResolvedValue({ estado: 'OMITIDO' }));

vi.mock('@/features/contabilidad-formal/services/posting-engine', async () => {
	const real = await vi.importActual<
		typeof import('@/features/contabilidad-formal/services/posting-engine')
	>('@/features/contabilidad-formal/services/posting-engine');
	return { ...real, postEvento };
});

import {
	emitirAjusteBancario,
	emitirInyeccionCapital,
} from '../capital-adjustment-posting-service';

describe('emisores de ajustes bancarios e inyecciones de capital', () => {
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

	it('acredita el ingreso de un ajuste bancario como otros ingresos', async () => {
		const tx = crearTx();

		await emitirAjusteBancario(tx as never, { tenantId: 'tenant-1', userId: 'user-1' }, {
			ajusteId: 'ajuste-1',
			fecha: new Date('2026-10-02T00:00:00.000Z'),
			monto: 100,
			moneda: 'CUP',
			tasaCambio: 1,
			descripcion: 'Ajuste de banco',
			referencia: 'key-1',
			tipo: 'ingreso',
		});

		expect(postEvento).toHaveBeenCalledWith(
			tx,
			{ tenantId: 'tenant-1', userId: 'user-1' },
			expect.objectContaining({
				tipo: 'AJUSTE_BANCARIO_ABONO',
				origen: { tipo: 'ajuste_bancario', id: 'ajuste-1' },
				monto: 100,
				moneda: 'CUP',
				montoFuncional: 100,
				monedaFuncional: 'CUP',
				medioCobro: 'BANCOS',
				referencia: 'key-1',
			}),
		);
	});

	it('debita el egreso de un ajuste bancario como gasto financiero', async () => {
		const tx = crearTx();

		await emitirAjusteBancario(tx as never, { tenantId: 'tenant-1', userId: 'user-1' }, {
			ajusteId: 'ajuste-2',
			fecha: new Date('2026-10-02T00:00:00.000Z'),
			monto: 30,
			moneda: 'CUP',
			tasaCambio: 1,
			descripcion: 'Comision bancaria',
			tipo: 'egreso',
		});

		expect(postEvento).toHaveBeenCalledWith(
			tx,
			expect.anything(),
			expect.objectContaining({
				tipo: 'AJUSTE_BANCARIO_CARGO',
				origen: { tipo: 'ajuste_bancario', id: 'ajuste-2' },
				montoFuncional: 30,
			}),
		);
	});

	it('valora el ajuste en moneda extranjera con la tasa persistida', async () => {
		const tx = crearTx();

		await emitirAjusteBancario(tx as never, { tenantId: 'tenant-1', userId: 'user-1' }, {
			ajusteId: 'ajuste-3',
			fecha: new Date('2026-10-02T00:00:00.000Z'),
			monto: 10,
			moneda: 'USD',
			tasaCambio: 250,
			descripcion: 'Ajuste en dolares',
			tipo: 'ingreso',
		});

		const evento = postEvento.mock.calls[0][2];
		expect(evento.montoFuncional).toBe(2500);
		expect(evento.tasaCambio).toBe(250);
		expect(evento.fxEvidenceFingerprint).toBeTruthy();
	});

	it('deja la valoracion funcional nula cuando no hay tasa (falla cerrada)', async () => {
		const tx = crearTx();

		await emitirAjusteBancario(tx as never, { tenantId: 'tenant-1', userId: 'user-1' }, {
			ajusteId: 'ajuste-4',
			fecha: new Date('2026-10-02T00:00:00.000Z'),
			monto: 10,
			moneda: 'USD',
			descripcion: 'Ajuste sin tasa',
			tipo: 'ingreso',
		});

		const evento = postEvento.mock.calls[0][2];
		expect(evento.montoFuncional).toBeNull();
		expect(evento.fxEvidenceFingerprint).toBeNull();
	});

	it('acredita el capital social en la inyeccion de capital propio', async () => {
		const tx = crearTx();

		await emitirInyeccionCapital(tx as never, { tenantId: 'tenant-1', userId: 'user-1' }, {
			inyeccionId: 'inyeccion-1',
			fecha: new Date('2026-10-03T00:00:00.000Z'),
			monto: 500,
			moneda: 'CUP',
			descripcion: 'Aporte del socio',
			referencia: 'capital-key',
			tipo: 'CAPITAL_SOCIAL',
		});

		expect(postEvento).toHaveBeenCalledWith(
			tx,
			{ tenantId: 'tenant-1', userId: 'user-1' },
			expect.objectContaining({
				tipo: 'INYECCION_CAPITAL',
				origen: { tipo: 'inyeccion_capital', id: 'inyeccion-1' },
				montoFuncional: 500,
				medioCobro: 'BANCOS',
			}),
		);
	});

	it('acredita las deudas recibidas en la inyeccion de deuda externa', async () => {
		const tx = crearTx();

		await emitirInyeccionCapital(tx as never, { tenantId: 'tenant-1', userId: 'user-1' }, {
			inyeccionId: 'inyeccion-2',
			fecha: new Date('2026-10-03T00:00:00.000Z'),
			monto: 800,
			moneda: 'CUP',
			tipo: 'DEUDA_EXTERNA',
		});

		expect(postEvento).toHaveBeenCalledWith(
			tx,
			expect.anything(),
			expect.objectContaining({
				tipo: 'DEUDA_RECIBIDA',
				origen: { tipo: 'inyeccion_capital', id: 'inyeccion-2' },
				descripcion: 'Recepcion de deuda externa',
			}),
		);
	});
});
