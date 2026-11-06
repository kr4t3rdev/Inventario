import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	readFinancialLedger: vi.fn(),
}));

vi.mock('./financial-ledger-reader', () => ({ readFinancialLedger: mocks.readFinancialLedger }));

import type { FinancialLedgerLine } from './financial-ledger-balance';
import { readFormalReportData } from './formal-financial-report-data';

const ACUMULADAS: FinancialLedgerLine[] = [
	{
		id: 'cuenta-1', code: '1.1', name: 'Caja', type: 'ACTIVO', nature: 'DEUDORA',
		debit: '100', credit: '0',
	},
];

const DEL_PERIODO: FinancialLedgerLine[] = [
	{
		id: 'cuenta-2', code: '4.1', name: 'Ventas', type: 'INGRESO', nature: 'ACREEDORA',
		debit: '0', credit: '80',
	},
	{
		id: 'cuenta-3', code: '6.1', name: 'Gastos', type: 'GASTO', nature: 'DEUDORA',
		debit: '20', credit: '0',
	},
];

describe('readFormalReportData', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.readFinancialLedger.mockImplementation(
			(params: { excludeClosingEntries?: boolean }) =>
				Promise.resolve(params.excludeClosingEntries ? DEL_PERIODO : ACUMULADAS),
		);
	});

	it('presenta el balance acumulado por cuenta', async () => {
		const datos = await readFormalReportData({
			tenantId: 'tenant-a',
			from: new Date('2026-01-01T00:00:00.000Z'),
			cutoffAt: new Date('2026-12-31T23:59:59.000Z'),
		});

		expect(datos.accounts).toEqual([
			{
				id: 'cuenta-1', code: '1.1', name: 'Caja', type: 'ACTIVO',
				nature: 'DEUDORA', balance: '100',
			},
		]);
	});

	it('presenta el resultado del periodo por tipo contable', async () => {
		const datos = await readFormalReportData({
			tenantId: 'tenant-a',
			from: new Date('2026-01-01T00:00:00.000Z'),
			cutoffAt: new Date('2026-12-31T23:59:59.000Z'),
		});

		expect(datos.result).toEqual({
			income: '80', costs: '0', expenses: '20', net: '60',
		});
	});

	it('acumula sin corte y calcula el resultado sin cierres ni sus reversos', async () => {
		await readFormalReportData({
			tenantId: 'tenant-a',
			from: new Date('2026-01-01T00:00:00.000Z'),
			cutoffAt: new Date('2026-12-31T23:59:59.000Z'),
		});

		expect(mocks.readFinancialLedger).toHaveBeenCalledTimes(2);
		expect(mocks.readFinancialLedger).toHaveBeenCalledWith(expect.objectContaining({
			tenantId: 'tenant-a',
			cutoffAt: new Date('2026-12-31T23:59:59.000Z'),
		}));
		expect(mocks.readFinancialLedger).toHaveBeenCalledWith(expect.objectContaining({
			from: new Date('2026-01-01T00:00:00.000Z'),
			excludeClosingEntries: true,
		}));
	});
});
