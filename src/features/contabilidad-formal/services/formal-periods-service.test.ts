import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ periodoContable: { findMany: vi.fn() } }));
vi.mock('@/lib/prisma', () => ({ prisma: db }));

import { listFormalPeriods } from './formal-periods-service';

describe('listFormalPeriods', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		db.periodoContable.findMany.mockResolvedValue([
			{
				periodoId: 'periodo-2',
				codigo: 'M-2026-02',
				tipo: 'MENSUAL',
				estado: 'APROBADO',
				fechaInicio: new Date('2026-02-01T00:00:00.000Z'),
				fechaFin: new Date('2026-02-28T23:59:59.999Z'),
				_count: { asientos: 12 },
			},
			{
				periodoId: 'periodo-1',
				codigo: null,
				tipo: 'MENSUAL',
				estado: 'REABIERTO',
				fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
				fechaFin: new Date('2026-01-31T23:59:59.999Z'),
				_count: { asientos: 8 },
			},
		]);
	});

	it('lista solo los periodos con asientos formales del tenant', async () => {
		const periodos = await listFormalPeriods({ tenantId: 'tenant-a' });

		expect(db.periodoContable.findMany).toHaveBeenCalledWith(expect.objectContaining({
			where: { tenantId: 'tenant-a', asientos: { some: {} } },
		}));
		expect(periodos.map((periodo) => periodo.periodoId)).toEqual(['periodo-2', 'periodo-1']);
	});

	it('expone el codigo, el estado y la cantidad de asientos de cada periodo', async () => {
		const periodos = await listFormalPeriods({ tenantId: 'tenant-a' });

		expect(periodos[0]).toEqual({
			periodoId: 'periodo-2',
			codigo: 'M-2026-02',
			tipo: 'MENSUAL',
			estado: 'APROBADO',
			fechaInicio: '2026-02-01T00:00:00.000Z',
			fechaFin: '2026-02-28T23:59:59.999Z',
			asientos: 12,
		});
		expect(periodos[1].codigo).toBeNull();
	});

	it('rechaza un tenant vacio antes de consultar', async () => {
		await expect(listFormalPeriods({ tenantId: '' })).rejects.toThrow();
		expect(db.periodoContable.findMany).not.toHaveBeenCalled();
	});
});
