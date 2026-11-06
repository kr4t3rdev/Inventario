import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NextRequest } from 'next/server';

const reporteMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth-middleware', () => ({
	withAuthGet: (handler: Function) => (request: unknown, user: unknown = {}) => handler(request, {}, user),
}));
vi.mock('@/features/contabilidad-formal/services/formal-financial-report-service', () => ({
	getFormalFinancialReport: reporteMock,
}));

const USUARIO = {
	userId: 'contador-1',
	name: 'Contador',
	email: 'contador@example.com',
	role: 'user',
	isActive: true,
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	planFeatures: { 'contabilidad-formal': true },
};

const REPORTE = {
	status: 'AVAILABLE',
	periodoId: 'periodo-1',
	cutoffAt: '2026-01-31T23:59:59.999Z',
	accounts: [
		{ id: 'c1', code: '1.1', name: 'Caja', type: 'ACTIVO', nature: 'DEUDORA', balance: '100' },
	],
	result: { income: '80', costs: '0', expenses: '20', net: '60' },
	coverage: {
		estado: 'CUBIERTA',
		periodoId: 'periodo-1',
		replayRunId: 'run-1',
		fuentesEsperadas: 3,
		fuentesCubiertas: 3,
		motivos: [],
	},
};

describe('GET /api/contabilidad/reporte-formal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		reporteMock.mockResolvedValue(REPORTE);
	});

	it('exporta el reporte disponible en CSV del tenant autenticado', async () => {
		const { GET } = await import('./route');
		const response = await GET(
			new NextRequest('http://localhost/api/contabilidad/reporte-formal?periodoId=periodo-1'),
			USUARIO,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/csv');
		expect(await response.text()).toContain('BALANCE,ACTIVO,1.1,Caja,100');
		expect(reporteMock).toHaveBeenCalledWith({ tenantId: 'tenant-1', periodoId: 'periodo-1' });
	});

	it('responde con la causa cuando el reporte no esta disponible', async () => {
		reporteMock.mockResolvedValue({
			status: 'UNAVAILABLE',
			reason: 'COVERAGE_NOT_CREDIFIED',
			periodoId: 'periodo-1',
			coverage: null,
			problems: [],
		});

		const { GET } = await import('./route');
		const response = await GET(
			new NextRequest('http://localhost/api/contabilidad/reporte-formal?periodoId=periodo-1'),
			USUARIO,
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			status: 'UNAVAILABLE',
			reason: 'COVERAGE_NOT_CREDIFIED',
			periodoId: 'periodo-1',
		});
	});

	it('exige el periodo contable solicitado', async () => {
		const { GET } = await import('./route');
		const response = await GET(new NextRequest('http://localhost/api/contabilidad/reporte-formal'), USUARIO);

		expect(response.status).toBe(400);
		expect(reporteMock).not.toHaveBeenCalled();
	});

	it('rechaza a un usuario sin licencia de contabilidad formal', async () => {
		const { GET } = await import('./route');
		const response = await GET(
			new NextRequest('http://localhost/api/contabilidad/reporte-formal?periodoId=periodo-1'),
			{ ...USUARIO, planFeatures: { 'contabilidad-formal': false } },
		);

		expect(response.status).toBe(403);
		expect(reporteMock).not.toHaveBeenCalled();
	});
});
