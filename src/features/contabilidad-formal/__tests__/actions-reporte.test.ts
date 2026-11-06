/**
 * @description Test focal de la Server Action del reporte contable formal.
 *
 * La acción siempre consulta el tenant autenticado, exige la licencia de
 * contabilidad formal y devuelve el reporte tal como lo resuelve el servicio:
 * disponible o no disponible con su causa.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');

const reporteMock = vi.hoisted(() => vi.fn());
const periodosMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/contabilidad-formal/services/formal-financial-report-service', () => ({
	getFormalFinancialReport: reporteMock,
}));

vi.mock('@/features/contabilidad-formal/services/formal-periods-service', () => ({
	listFormalPeriods: periodosMock,
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import {
	getFormalFinancialReportAction,
	listarPeriodosFormalesAction,
} from '@/features/contabilidad-formal/actions-reporte';

const contador: AuthenticatedUser = {
	userId: 'user-1',
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	role: 'user',
	isActive: true,
	name: 'Contador',
	email: 'contabilidad@example.com',
	planFeatures: { 'contabilidad-formal': true },
};

const RESPUESTA_NO_DISPONIBLE = {
	status: 'UNAVAILABLE',
	reason: 'COVERAGE_NOT_CREDIFIED',
	periodoId: 'periodo-1',
	coverage: null,
	problems: [],
};

describe('accion del reporte contable formal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(contador);
		reporteMock.mockResolvedValue(RESPUESTA_NO_DISPONIBLE);
	});

	it('consulta el reporte del tenant autenticado', async () => {
		const resultado = await getFormalFinancialReportAction({ periodoId: 'periodo-1' });

		expect(resultado.success).toBe(true);
		if (!resultado.success) throw new Error('Se esperaba una respuesta exitosa');
		expect(resultado.data).toEqual(RESPUESTA_NO_DISPONIBLE);
		expect(reporteMock).toHaveBeenCalledWith({
			tenantId: 'tenant-1',
			periodoId: 'periodo-1',
			cutoffAt: undefined,
		});
	});

	it('propaga el corte solicitado', async () => {
		await getFormalFinancialReportAction({
			periodoId: 'periodo-1',
			cutoffAt: '2026-12-31T23:59:59.000Z',
		});

		expect(reporteMock).toHaveBeenCalledWith(expect.objectContaining({
			cutoffAt: new Date('2026-12-31T23:59:59.000Z'),
		}));
	});

	it('exige la licencia de contabilidad formal', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...contador,
			planFeatures: { 'contabilidad-formal': false },
		});

		const resultado = await getFormalFinancialReportAction({ periodoId: 'periodo-1' });

		expect(resultado.success).toBe(false);
		if (resultado.success) throw new Error('Se esperaba un rechazo por licencia');
		expect(resultado.error?.code).toBe('FEATURE_NOT_AVAILABLE');
		expect(reporteMock).not.toHaveBeenCalled();
	});

	it('rechaza un payload incompleto', async () => {
		const resultado = await getFormalFinancialReportAction({} as never);

		expect(resultado.success).toBe(false);
		if (resultado.success) throw new Error('Se esperaba un rechazo de validacion');
		expect(resultado.error?.code).toBe('VALIDATION_ERROR');
		expect(reporteMock).not.toHaveBeenCalled();
	});

	it('rechaza un corte con formato invalido', async () => {
		const resultado = await getFormalFinancialReportAction({
			periodoId: 'periodo-1',
			cutoffAt: 'ayer',
		});

		expect(resultado.success).toBe(false);
		if (resultado.success) throw new Error('Se esperaba un rechazo de validacion');
		expect(resultado.error?.code).toBe('VALIDATION_ERROR');
		expect(reporteMock).not.toHaveBeenCalled();
	});

	it('lista los periodos formales del tenant autenticado', async () => {
		periodosMock.mockResolvedValue([{ periodoId: 'periodo-1' }]);

		const resultado = await listarPeriodosFormalesAction();

		expect(resultado.success).toBe(true);
		expect(periodosMock).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
	});

	it('el listado de periodos exige la licencia de contabilidad formal', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...contador,
			planFeatures: { 'contabilidad-formal': false },
		});

		const resultado = await listarPeriodosFormalesAction();

		expect(resultado.success).toBe(false);
		if (resultado.success) throw new Error('Se esperaba un rechazo por licencia');
		expect(resultado.error?.code).toBe('FEATURE_NOT_AVAILABLE');
		expect(periodosMock).not.toHaveBeenCalled();
	});
});
