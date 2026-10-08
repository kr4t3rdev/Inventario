/**
 * @description Contratos de las actions del backfill (CTA-4 T2): el dry-run es
 * lectura gated por feature; el replay consume preflight y aprobación persistidos.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const planMock = vi.hoisted(() => vi.fn());
const ejecutarMock = vi.hoisted(() => vi.fn());
const crearPreflightMock = vi.hoisted(() => vi.fn());
const aprobarMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/contabilidad-formal/services/replay-backfill-service', () => ({
	planBackfillContable: planMock,
	crearPreflightBackfill: crearPreflightMock,
	aprobarPreflightBackfill: aprobarMock,
	ejecutarBackfillAutorizado: ejecutarMock,
}));

const baseUser = {
	userId: 'u1',
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	role: 'user',
	isActive: true,
	name: 'Contador',
	email: 'c@example.com',
	planFeatures: { 'contabilidad-formal': true },
};
let usuarioActual: typeof baseUser = baseUser;

vi.mock('@/lib/server-actions', () => ({
	ActionError: class ActionError extends Error {
		constructor(message: string, public readonly code: string) {
			super(message);
		}
	},
	withAction:
		(callback: (input: unknown, actor: typeof baseUser) => Promise<unknown>) =>
		(input: unknown) =>
			callback(input, usuarioActual)
				.then((data) => ({ success: true as const, data }))
				.catch((error: { message: string; code?: string; name?: string }) => ({
					success: false as const,
					error: {
						message: error.name === 'ZodError' ? 'Datos inválidos' : error.message,
						code: error.name === 'ZodError' ? 'VALIDATION_ERROR' : error.code,
					},
				})),
}));

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

describe('actions del backfill (CTA-4)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		usuarioActual = baseUser;
		planMock.mockResolvedValue({ periodos: [], totalEvaluados: 0, yaPosteados: 0, sinPeriodo: 0 });
		ejecutarMock.mockResolvedValue({ contabilizados: 2, yaPosteados: 0, omitidos: 0 });
		crearPreflightMock.mockResolvedValue({ replayPreflightId: 'preflight' });
		aprobarMock.mockResolvedValue({ replayApprovalId: 'approval' });
	});

	it('plan: devuelve el dry-run', async () => {
		const { getPlanBackfillAction } = await import('@/features/contabilidad-formal/actions-backfill');
		const r = await getPlanBackfillAction();
		expect(r.success).toBe(true);
		expect(planMock).toHaveBeenCalledWith('tenant-1');
	});

	it('plan: requiere permiso contable y no consulta datos cuando está denegado', async () => {
		usuarioActual = { ...baseUser, tenantRole: 'dependiente' };
		const { getPlanBackfillAction } = await import('@/features/contabilidad-formal/actions-backfill');
		const result = await getPlanBackfillAction();
		expect(result.success).toBe(false);
		if (result.success) expect.unreachable('Se esperaba que la accion fallara');
		expect(result.error?.code).toBe('FORBIDDEN');
		expect(planMock).not.toHaveBeenCalled();
	});

	it('plan: sin el feature es rechazado', async () => {
		usuarioActual = { ...baseUser, planFeatures: { 'contabilidad-formal': false } };
		const { getPlanBackfillAction } = await import('@/features/contabilidad-formal/actions-backfill');
		const r = await getPlanBackfillAction();
		expect(r.success).toBe(false);
		if (r.success) expect.unreachable('Se esperaba que la accion fallara');
		expect(r.error?.code).toBe('FEATURE_NOT_AVAILABLE');
	});

	it('ejecutar: no acepta la confirmación antigua REPLAY', async () => {
		const { ejecutarBackfillPeriodoAction } = await import('@/features/contabilidad-formal/actions-backfill');
		const r = await ejecutarBackfillPeriodoAction(
			{ periodoId: 'p-1', confirmacion: 'REPLAY' } as unknown as Parameters<typeof ejecutarBackfillPeriodoAction>[0],
		);
		expect(r.success).toBe(false);
		expect(ejecutarMock).not.toHaveBeenCalled();
	});

	it('ejecutar: requiere una membresía manager', async () => {
		usuarioActual = { ...baseUser, tenantRole: 'dependiente' };
		const { ejecutarBackfillPeriodoAction } = await import('@/features/contabilidad-formal/actions-backfill');
		const r = await ejecutarBackfillPeriodoAction({ replayPreflightId: 'p-1', replayApprovalId: 'a-1' });
		expect(r.success).toBe(false);
		if (r.success) expect.unreachable('Se esperaba que la accion fallara');
		expect(r.error?.code).toBe('FORBIDDEN');
	});

	it('preflight: persiste el período solicitado', async () => {
		const { crearPreflightBackfillAction } = await import('@/features/contabilidad-formal/actions-backfill');
		const r = await crearPreflightBackfillAction({ periodoId: 'p-1' });
		expect(r.success).toBe(true);
		expect(crearPreflightMock).toHaveBeenCalledWith('tenant-1', 'p-1', 'u1');
	});

	it('approval: solicita aprobación de un preflight bajo la identidad actual', async () => {
		const { aprobarPreflightBackfillAction } = await import('@/features/contabilidad-formal/actions-backfill');
		const r = await aprobarPreflightBackfillAction({ replayPreflightId: 'preflight-1' });
		expect(r.success).toBe(true);
		expect(aprobarMock).toHaveBeenCalledWith('tenant-1', 'preflight-1', 'u1');
	});

	it('ejecutar: rechaza tenant o actor inyectado en el payload', async () => {
		const { ejecutarBackfillPeriodoAction } = await import('@/features/contabilidad-formal/actions-backfill');
		const result = await ejecutarBackfillPeriodoAction({
			replayPreflightId: 'preflight', replayApprovalId: 'approval',
			tenantId: 'other', actorId: 'other',
		} as Parameters<typeof ejecutarBackfillPeriodoAction>[0]);
		expect(result.success).toBe(false);
		if (result.success) expect.unreachable('Se esperaba que la accion fallara');
		expect(result.error?.code).toBe('VALIDATION_ERROR');
		expect(ejecutarMock).not.toHaveBeenCalled();
	});

	it('ejecutar: conserva NO_CONFORME y la identidad del run sin anunciar conformidad', async () => {
		ejecutarMock.mockResolvedValue({
			replayRunId: 'run', status: 'NO_CONFORME', contabilizados: 1, omitidos: 0,
			reconciliation: { status: 'NO_CONFORME', enforceReady: false },
		});
		const { ejecutarBackfillPeriodoAction } = await import('@/features/contabilidad-formal/actions-backfill');
		const result = await ejecutarBackfillPeriodoAction({ replayPreflightId: 'preflight', replayApprovalId: 'approval' });
		expect(result.success).toBe(true)
		if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito')
		expect(result.data).toMatchObject({ replayRunId: 'run', status: 'NO_CONFORME',
			reconciliation: { status: 'NO_CONFORME', enforceReady: false } });
	});

	it('ejecutar: no devuelve éxito cuando falla la ejecución', async () => {
		ejecutarMock.mockRejectedValue(new Error('posting failure'));
		const { ejecutarBackfillPeriodoAction } = await import('@/features/contabilidad-formal/actions-backfill');
		const result = await ejecutarBackfillPeriodoAction({ replayPreflightId: 'preflight', replayApprovalId: 'approval' });
		expect(result.success).toBe(false);
	});

	it('ejecutar: consume solo IDs del preflight y aprobación', async () => {
		const { ejecutarBackfillPeriodoAction } = await import('@/features/contabilidad-formal/actions-backfill');
		const r = await ejecutarBackfillPeriodoAction({ replayPreflightId: 'preflight-1', replayApprovalId: 'approval-1' });
		expect(r.success).toBe(true);
		expect(ejecutarMock).toHaveBeenCalledWith({
			tenantId: 'tenant-1', replayPreflightId: 'preflight-1', replayApprovalId: 'approval-1', actorId: 'u1',
		});
	});
});
