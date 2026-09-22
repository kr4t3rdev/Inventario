/**
 * @description Regresión del parámetro `client` añadido a aprobarPeriodo (CTA-3):
 * la aprobación debe ejecutarse dentro de la transacción suministrada.
 */
import { describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
	periodoContable: { findUnique: vi.fn(), update: vi.fn() },
	auditoriaPeriodo: { create: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

describe('PeriodoContableService.aprobarPeriodo con client', () => {
	it('usa la transacción suministrada en vez del cliente global', async () => {
		const { PeriodoContableService } = await import(
			'@/lib/services/periodo-contable-service'
		);

		prismaMock.periodoContable.findUnique.mockResolvedValue({
			periodoId: 'per-1',
			estado: 'CERRADO',
			cerradoPor: 'user-a',
		});
		prismaMock.periodoContable.update.mockResolvedValue({
			periodoId: 'per-1',
			estado: 'APROBADO',
			aprobadoPor: 'user-b',
		});

		const txFalso = {
			periodoContable: {
				findUnique: vi.fn().mockResolvedValue({
					periodoId: 'per-1',
					estado: 'CERRADO',
					cerradoPor: 'user-a',
				}),
				update: vi.fn().mockResolvedValue({
					periodoId: 'per-1',
					estado: 'APROBADO',
					aprobadoPor: 'user-b',
				}),
			},
		};

		const resultado = await PeriodoContableService.aprobarPeriodo(
			'per-1',
			'user-b',
			txFalso,
		);

		expect(txFalso.periodoContable.findUnique).toHaveBeenCalledWith({
			where: { periodoId: 'per-1' },
		});
		expect(txFalso.periodoContable.update).toHaveBeenCalled();
		expect(prismaMock.periodoContable.update).not.toHaveBeenCalled();
		expect(resultado.estado).toBe('APROBADO');
	});
});
