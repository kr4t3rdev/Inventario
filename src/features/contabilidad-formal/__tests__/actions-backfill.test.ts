/**
 * @description Test focal de las Server Actions del replay contable.
 *
 * El dry-run es lectura gated por licencia y permiso; la aprobacion y la
 * ejecucion exigen un responsable contable y se-supportan siempre en el tenant
 * autenticado, nunca en el que llega por parametro.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');

const planMock = vi.hoisted(() => vi.fn());
const crearPreflightMock = vi.hoisted(() => vi.fn());
const aprobarPreflightMock = vi.hoisted(() => vi.fn());
const ejecutarMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/contabilidad-formal/services/replay-backfill-service', () => ({
	planBackfillContable: planMock,
	crearPreflightBackfill: crearPreflightMock,
	aprobarPreflightBackfill: aprobarPreflightMock,
	ejecutarBackfillAutorizado: ejecutarMock,
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import {
	getPlanBackfillAction,
	crearPreflightBackfillAction,
	aprobarPreflightBackfillAction,
	ejecutarBackfillPeriodoAction,
} from '@/features/contabilidad-formal/actions-backfill';

const manager: AuthenticatedUser = {
	userId: 'user-1',
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	role: 'user',
	isActive: true,
	name: 'Contador',
	email: 'contabilidad@example.com',
	planFeatures: { 'contabilidad-formal': true },
};

describe('actions del replay contable', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(manager);
		planMock.mockResolvedValue({
			periodos: [],
			totalEvaluados: 0,
			yaPosteados: 0,
			sinPeriodo: 0,
			omitidos: [],
		});
		crearPreflightMock.mockResolvedValue({ replayPreflightId: 'preflight-1' });
		aprobarPreflightMock.mockResolvedValue({ replayApprovalId: 'approval-1' });
		ejecutarMock.mockResolvedValue({
			replayRunId: 'run-1',
			status: 'COMPLETED',
			contabilizados: 2,
			yaPosteados: 0,
			omitidos: 0,
		});
	});

	it('el plan es una lectura del tenant autenticado', async () => {
		const resultado = await getPlanBackfillAction();

		expect(resultado.success).toBe(true);
		expect(planMock).toHaveBeenCalledWith('tenant-1');
	});

	it('el plan exige la licencia de contabilidad formal', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...manager,
			planFeatures: { 'contabilidad-formal': false },
		});

		const resultado = await getPlanBackfillAction();

		expect(resultado.success).toBe(false);
		if (resultado.success) throw new Error('Se esperaba un rechazo por licencia');
		expect(resultado.error?.code).toBe('FEATURE_NOT_AVAILABLE');
		expect(planMock).not.toHaveBeenCalled();
	});

	it('el preflight se crea en el tenant autenticado con el solicitante actual', async () => {
		const resultado = await crearPreflightBackfillAction({ periodoId: 'periodo-1' });

		expect(resultado.success).toBe(true);
		expect(crearPreflightMock).toHaveBeenCalledWith('tenant-1', 'periodo-1', 'user-1');
	});

	it('la aprobacion exige un responsable contable', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...manager,
			tenantRole: 'dependiente',
		});

		const resultado = await aprobarPreflightBackfillAction({ replayPreflightId: 'preflight-1' });

		expect(resultado.success).toBe(false);
		if (resultado.success) throw new Error('Se esperaba un rechazo por rol');
		expect(resultado.error?.code).toBe('FORBIDDEN');
		expect(aprobarPreflightMock).not.toHaveBeenCalled();
	});

	it('la aprobacion se registra con el aprobador autenticado', async () => {
		const resultado = await aprobarPreflightBackfillAction({ replayPreflightId: 'preflight-1' });

		expect(resultado.success).toBe(true);
		expect(aprobarPreflightMock).toHaveBeenCalledWith('tenant-1', 'preflight-1', 'user-1');
	});

	it('la ejecucion exige el preflight y la aprobacion persistidos', async () => {
		const resultado = await ejecutarBackfillPeriodoAction({
			replayPreflightId: 'preflight-1',
			replayApprovalId: 'approval-1',
		});

		expect(resultado.success).toBe(true);
		expect(ejecutarMock).toHaveBeenCalledWith({
			tenantId: 'tenant-1',
			replayPreflightId: 'preflight-1',
			replayApprovalId: 'approval-1',
			actorId: 'user-1',
		});
	});

	it('la ejecucion rechaza un payload incompleto', async () => {
		const resultado = await ejecutarBackfillPeriodoAction({
			replayPreflightId: 'preflight-1',
		} as never);

		expect(resultado.success).toBe(false);
		if (resultado.success) throw new Error('Se esperaba un rechazo de validacion');
		expect(resultado.error?.code).toBe('VALIDATION_ERROR');
		expect(ejecutarMock).not.toHaveBeenCalled();
	});
});
