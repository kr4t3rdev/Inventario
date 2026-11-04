/**
 * @description Test focal del asiento de cierre formal del período (CTA-3).
 *
 * Cubre el modo de la capa, la idempotencia, el vaciado de las cuentas de
 * resultado contra la cuenta de resultado del período y el fail-closed cuando
 * falta la evidencia necesaria (rol contable, diario o aprobación).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../posting-engine', () => ({
	insertarAsientoConNumeracion: vi.fn(),
	modoActual: vi.fn(),
}));

import { Prisma } from '@/generated/prisma';
import { insertarAsientoConNumeracion, modoActual } from '../posting-engine';
import { generarAsientoCierre } from '../cierre-formal-service';
import type { CierreTx } from '../cierre-formal-service';

describe('generarAsientoCierre', () => {
	const decimal = (valor: string) => new Prisma.Decimal(valor);
	const params = {
		periodoId: 'periodo-1',
		tenantId: 'tenant-1',
		actorId: 'user-1',
	};

	function crearTxMock(overrides: Record<string, unknown> = {}) {
		return {
			asiento: { findFirst: vi.fn().mockResolvedValue(null) },
			periodoContable: {
				findUnique: vi.fn().mockResolvedValue({
					periodoId: 'periodo-1',
					tenantId: 'tenant-1',
					estado: 'APROBADO',
					fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
					fechaFin: new Date('2026-10-31T00:00:00.000Z'),
				}),
			},
			cuentaRolTenant: {
				findMany: vi.fn().mockResolvedValue([{ cuentaId: 'cuenta-resultado' }]),
			},
			asientoLinea: {
				groupBy: vi.fn().mockResolvedValue([
					{ cuentaId: 'cuenta-ventas', _sum: { debe: decimal('0'), haber: decimal('1000') } },
					{ cuentaId: 'cuenta-costo', _sum: { debe: decimal('400'), haber: decimal('0') } },
				]),
			},
			cuentaContable: {
				findMany: vi.fn().mockResolvedValue([
					{ cuentaContableId: 'cuenta-ventas', tipo: 'INGRESO' },
					{ cuentaContableId: 'cuenta-costo', tipo: 'COSTO' },
				]),
			},
			diario: {
				findFirst: vi.fn().mockResolvedValue({ diarioId: 'diario-ape' }),
			},
			...overrides,
		};
	}

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(modoActual).mockReturnValue('enforce');
		vi.mocked(insertarAsientoConNumeracion).mockResolvedValue({
			asientoId: 'asiento-cierre-1',
			duplicado: false,
		} as never);
	});

	it('no hace nada mientras la capa formal esta apagada', async () => {
		vi.mocked(modoActual).mockReturnValue('off');
		const tx = crearTxMock();

		await expect(
			generarAsientoCierre(tx as unknown as CierreTx, params),
		).resolves.toEqual({ estado: 'OMITIDO', motivo: 'MODO_NO_ENFORCE' });

		expect(tx.asiento.findFirst).not.toHaveBeenCalled();
		expect(insertarAsientoConNumeracion).not.toHaveBeenCalled();
	});

	it('no escribe el asiento en modo observacion', async () => {
		vi.mocked(modoActual).mockReturnValue('shadow');
		const tx = crearTxMock();

		await expect(
			generarAsientoCierre(tx as unknown as CierreTx, params),
		).resolves.toEqual({ estado: 'OMITIDO', motivo: 'MODO_NO_ENFORCE' });

		expect(insertarAsientoConNumeracion).not.toHaveBeenCalled();
	});

	it('es idempotente: un cierre ya generado no se duplica', async () => {
		const tx = crearTxMock();
		tx.asiento.findFirst.mockResolvedValue({ asientoId: 'asiento-cierre-1' });

		await expect(
			generarAsientoCierre(tx as unknown as CierreTx, params),
		).resolves.toEqual({ estado: 'YA_EXISTENTE', asientoId: 'asiento-cierre-1' });

		expect(insertarAsientoConNumeracion).not.toHaveBeenCalled();
	});

	it('vacia las cuentas de resultado contra la cuenta de resultado del periodo', async () => {
		const tx = crearTxMock();

		const resultado = await generarAsientoCierre(tx as unknown as CierreTx, params);

		expect(resultado).toEqual({ estado: 'CONTABILIZADO', asientoId: 'asiento-cierre-1' });
		expect(insertarAsientoConNumeracion).toHaveBeenCalledWith(
			tx,
			{ tenantId: 'tenant-1', userId: 'user-1' },
			expect.objectContaining({
				diarioId: 'diario-ape',
				periodoId: 'periodo-1',
				origenTipo: 'cierre_periodo',
				origenId: 'periodo-1',
				// El cierre se fecha el último día del período cuando se aprueba después.
				fecha: new Date('2026-10-31T00:00:00.000Z'),
				lineas: [
					expect.objectContaining({
						orden: 1,
						cuentaId: 'cuenta-ventas',
						debe: decimal('1000'),
						haber: decimal('0'),
					}),
					expect.objectContaining({
						orden: 2,
						cuentaId: 'cuenta-costo',
						debe: decimal('0'),
						haber: decimal('400'),
					}),
					// Utilidad 600 (1000 - 400) en el haber del resultado del período.
					expect.objectContaining({
						orden: 3,
						cuentaId: 'cuenta-resultado',
						debe: decimal('0'),
						haber: decimal('600'),
					}),
				],
			}),
		);
	});

	it('omite el cierre sin error cuando el periodo no tiene movimientos de resultado', async () => {
		const tx = crearTxMock();
		tx.asientoLinea.groupBy.mockResolvedValue([]);

		await expect(
			generarAsientoCierre(tx as unknown as CierreTx, params),
		).resolves.toEqual({ estado: 'OMITIDO', motivo: 'RESULTADO_CERO_SIN_MOVIMIENTOS' });

		expect(insertarAsientoConNumeracion).not.toHaveBeenCalled();
	});

	it('falla cerrado si el periodo no esta aprobado', async () => {
		const tx = crearTxMock();
		tx.periodoContable.findUnique.mockResolvedValue({
			periodoId: 'periodo-1',
			tenantId: 'tenant-1',
			estado: 'CERRADO',
			fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
			fechaFin: new Date('2026-10-31T00:00:00.000Z'),
		});

		await expect(
			generarAsientoCierre(tx as unknown as CierreTx, params),
		).rejects.toMatchObject({ code: 'TRANSICION_INVALIDA' });

		expect(insertarAsientoConNumeracion).not.toHaveBeenCalled();
	});

	it('falla cerrado si falta el rol contable del resultado del periodo', async () => {
		const tx = crearTxMock();
		tx.cuentaRolTenant.findMany.mockResolvedValue([]);

		await expect(
			generarAsientoCierre(tx as unknown as CierreTx, params),
		).rejects.toMatchObject({ code: 'ROL_CONTABLE_FALTANTE' });

		expect(insertarAsientoConNumeracion).not.toHaveBeenCalled();
	});

	it('falla cerrado si no hay diario de apertura y cierre activo', async () => {
		const tx = crearTxMock();
		tx.diario.findFirst.mockResolvedValue(null);

		await expect(
			generarAsientoCierre(tx as unknown as CierreTx, params),
		).rejects.toMatchObject({ code: 'DIARIO_NO_ENCONTRADO' });

		expect(insertarAsientoConNumeracion).not.toHaveBeenCalled();
	});

	it('no cierra un periodo de otro tenant', async () => {
		const tx = crearTxMock();
		tx.periodoContable.findUnique.mockResolvedValue({
			periodoId: 'periodo-1',
			tenantId: 'tenant-otro',
			estado: 'APROBADO',
			fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
			fechaFin: new Date('2026-10-31T00:00:00.000Z'),
		});

		await expect(
			generarAsientoCierre(tx as unknown as CierreTx, params),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});
});
