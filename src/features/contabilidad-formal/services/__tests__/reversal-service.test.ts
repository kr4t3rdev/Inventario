/**
 * @description Test focal del servicio de reversa formal (S6).
 *
 * Cubre el asiento inverso inmutable, el enlace entre ambos asientos, la
 * idempotencia y el comportamiento fail-closed ante un enlace inconsistente.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../posting-engine', () => ({
	insertarAsientoConNumeracion: vi.fn(),
}));
vi.mock('../../lib/modo-tenant', () => ({
	resolverModoTenant: vi.fn(),
}));
vi.mock('@/lib/services/periodo-contable-guard', () => ({
	PeriodoGuard: { assertWritable: vi.fn() },
}));
vi.mock('@/lib/services/periodo-contable-service', () => ({
	PeriodoContableService: { resolverPeriodoActivo: vi.fn() },
}));

import { Prisma } from '@/generated/prisma';
import { PeriodoContableService } from '@/lib/services/periodo-contable-service';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';
import { insertarAsientoConNumeracion } from '../posting-engine';
import { resolverModoTenant } from '../../lib/modo-tenant';
import { reverseFormalEntries } from '../reversal-service';
import type { PostingTx } from '../posting-engine';

describe('reversal service', () => {
	const contexto = { tenantId: 'tenant-1', userId: 'user-1' };
	const decimal = (valor: string) => new Prisma.Decimal(valor);

	const lineas = [
		{
			orden: 1,
			cuentaId: 'cuenta-cxc',
			debe: decimal('1000'),
			haber: decimal('0'),
			monedaOriginal: 'CUP',
			montoOriginal: decimal('1000'),
			tasaCambio: null,
			fxEvidenceFingerprint: null,
			referencia: null,
		},
		{
			orden: 2,
			cuentaId: 'cuenta-ventas',
			debe: decimal('0'),
			haber: decimal('1000'),
			monedaOriginal: 'CUP',
			montoOriginal: decimal('1000'),
			tasaCambio: null,
			fxEvidenceFingerprint: null,
			referencia: null,
		},
	];

	function crearTxMock(overrides: Record<string, unknown> = {}) {
		return {
			asiento: {
				findMany: vi.fn().mockResolvedValue([{ asientoId: 'asiento-1' }]),
				findFirst: vi.fn().mockResolvedValue({
					asientoId: 'asiento-1',
					tenantId: 'tenant-1',
					diarioId: 'diario-1',
					numero: 7,
					estado: 'CONTABILIZADO',
					revertidoPorId: null,
					lineas,
				}),
				findUnique: vi.fn().mockResolvedValue(null),
				updateMany: vi.fn().mockResolvedValue({ count: 1 }),
			},
			$queryRaw: vi.fn().mockResolvedValue([]),
			...overrides,
		};
	}

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(resolverModoTenant).mockResolvedValue('enforce');
		vi.mocked(PeriodoGuard.assertWritable).mockResolvedValue({
			permitido: true,
		} as never);
		vi.mocked(PeriodoContableService.resolverPeriodoActivo).mockResolvedValue({
			periodo: { periodoId: 'periodo-1' },
			esWritable: true,
		} as never);
		vi.mocked(insertarAsientoConNumeracion).mockResolvedValue({
			asientoId: 'asiento-reverso-1',
			duplicado: false,
		} as never);
	});

	it('no invierte nada mientras la capa formal esta apagada', async () => {
		vi.mocked(resolverModoTenant).mockResolvedValue('off');
		const tx = crearTxMock();

		await expect(
			reverseFormalEntries(tx as unknown as PostingTx, contexto, [
				{ tipo: 'factura', id: 'factura-1' },
			]),
		).resolves.toEqual([]);

		expect(tx.asiento.findMany).not.toHaveBeenCalled();
		expect(insertarAsientoConNumeracion).not.toHaveBeenCalled();
	});

	it('no hace nada sin origenes que revertir', async () => {
		const tx = crearTxMock();

		await expect(
			reverseFormalEntries(tx as unknown as PostingTx, contexto, []),
		).resolves.toEqual([]);

		expect(tx.asiento.findMany).not.toHaveBeenCalled();
	});

	it('crea el asiento inverso con las lineas invertidas y enlaza el original', async () => {
		const tx = crearTxMock();

		const reversos = await reverseFormalEntries(tx as unknown as PostingTx, contexto, [
			{ tipo: 'factura', id: 'factura-1' },
		]);

		expect(reversos).toEqual(['asiento-reverso-1']);
		expect(insertarAsientoConNumeracion).toHaveBeenCalledWith(
			tx,
			contexto,
			expect.objectContaining({
				diarioId: 'diario-1',
				periodoId: 'periodo-1',
				origenTipo: 'REVERSO_ASIENTO',
				origenId: 'asiento-1',
				lineas: [
					expect.objectContaining({ orden: 1, cuentaId: 'cuenta-cxc', debe: decimal('0'), haber: decimal('1000') }),
					expect.objectContaining({ orden: 2, cuentaId: 'cuenta-ventas', debe: decimal('1000'), haber: decimal('0') }),
				],
			}),
		);
		expect(tx.asiento.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ asientoId: 'asiento-1', estado: 'CONTABILIZADO' }),
				data: { estado: 'ANULADO', revertidoPorId: 'asiento-reverso-1' },
			}),
		);
	});

	it('es idempotente: un reverso ya contabilizado no se duplica', async () => {
		const tx = crearTxMock();
		tx.asiento.findFirst.mockResolvedValue({
			asientoId: 'asiento-1',
			tenantId: 'tenant-1',
			diarioId: 'diario-1',
			numero: 7,
			estado: 'ANULADO',
			revertidoPorId: 'asiento-reverso-1',
			lineas,
		});
		tx.asiento.findUnique.mockResolvedValue({
			asientoId: 'asiento-reverso-1',
			estado: 'CONTABILIZADO',
		});

		const reversos = await reverseFormalEntries(tx as unknown as PostingTx, contexto, [
			{ tipo: 'factura', id: 'factura-1' },
		]);

		expect(reversos).toEqual(['asiento-reverso-1']);
		expect(insertarAsientoConNumeracion).not.toHaveBeenCalled();
		expect(tx.asiento.updateMany).not.toHaveBeenCalled();
	});

	it('falla cuando el enlace de reversion no es consistente', async () => {
		const tx = crearTxMock();
		tx.asiento.findFirst.mockResolvedValue({
			asientoId: 'asiento-1',
			tenantId: 'tenant-1',
			diarioId: 'diario-1',
			numero: 7,
			estado: 'ANULADO',
			revertidoPorId: 'asiento-reverso-1',
			lineas,
		});
		tx.asiento.findUnique.mockResolvedValue({
			asientoId: 'asiento-reverso-1',
			estado: 'ANULADO',
		});

		await expect(
			reverseFormalEntries(tx as unknown as PostingTx, contexto, [
				{ tipo: 'factura', id: 'factura-1' },
			]),
		).rejects.toMatchObject({ code: 'ASIENTO_REVERSO_INCONSISTENTE' });
	});

	it('falla cuando el periodo contable esta cerrado', async () => {
		const tx = crearTxMock();
		vi.mocked(PeriodoGuard.assertWritable).mockResolvedValue({
			permitido: false,
			error: 'El período está cerrado',
			codigo: 'PERIODO_CERRADO',
		} as never);

		await expect(
			reverseFormalEntries(tx as unknown as PostingTx, contexto, [
				{ tipo: 'factura', id: 'factura-1' },
			]),
		).rejects.toMatchObject({ code: 'PERIODO_CERRADO' });

		expect(insertarAsientoConNumeracion).not.toHaveBeenCalled();
	});

	it('falla si el asiento origen esta descuadrado', async () => {
		const tx = crearTxMock();
		tx.asiento.findFirst.mockResolvedValue({
			asientoId: 'asiento-1',
			tenantId: 'tenant-1',
			diarioId: 'diario-1',
			numero: 7,
			estado: 'CONTABILIZADO',
			revertidoPorId: null,
			lineas: [lineas[0]],
		});

		await expect(
			reverseFormalEntries(tx as unknown as PostingTx, contexto, [
				{ tipo: 'factura', id: 'factura-1' },
			]),
		).rejects.toMatchObject({ code: 'ASIENTO_ORIGEN_INVALIDO' });
	});
});
