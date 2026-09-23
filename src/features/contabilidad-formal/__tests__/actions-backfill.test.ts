/**
 * @description Contratos de las actions del backfill (CTA-4 T2): el dry-run es
 * lectura gated por feature; la ejecución exige la confirmación 'REPLAY' y un
 * rol con autoridad (admin, manager o contador).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const planMock = vi.hoisted(() => vi.fn());
const ejecutarMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/contabilidad-formal/services/replay-backfill-service', () => ({
	planBackfillContable: planMock,
	ejecutarBackfillPeriodo: ejecutarMock,
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
	});

	it('plan: devuelve el dry-run', async () => {
		const { getPlanBackfillAction } = await import('@/features/contabilidad-formal/actions-backfill');
		const r = await getPlanBackfillAction();
		expect(r.success).toBe(true);
		expect(planMock).toHaveBeenCalledWith('tenant-1');
	});

	it('plan: sin el feature es rechazado', async () => {
		usuarioActual = { ...baseUser, planFeatures: {} };
		const { getPlanBackfillAction } = await import('@/features/contabilidad-formal/actions-backfill');
		const r = await getPlanBackfillAction();
		expect(r.success).toBe(false);
		expect(r.error?.code).toBe('FEATURE_NOT_AVAILABLE');
	});

	it('ejecutar: exige la confirmación REPLAY literal', async () => {
		const { ejecutarBackfillPeriodoAction } = await import('@/features/contabilidad-formal/actions-backfill');
		const r = await ejecutarBackfillPeriodoAction({ periodoId: 'p-1', confirmacion: 'ok' });
		expect(r.success).toBe(false);
		expect(ejecutarMock).not.toHaveBeenCalled();
	});

	it('ejecutar: rol dependiente es rechazado', async () => {
		usuarioActual = { ...baseUser, tenantRole: 'dependiente' };
		const { ejecutarBackfillPeriodoAction } = await import('@/features/contabilidad-formal/actions-backfill');
		const r = await ejecutarBackfillPeriodoAction({ periodoId: 'p-1', confirmacion: 'REPLAY' });
		expect(r.success).toBe(false);
		expect(r.error?.code).toBe('FORBIDDEN');
	});

	it('ejecutar: con confirmación y rol válido llama al servicio', async () => {
		const { ejecutarBackfillPeriodoAction } = await import('@/features/contabilidad-formal/actions-backfill');
		const r = await ejecutarBackfillPeriodoAction({ periodoId: 'p-1', confirmacion: 'REPLAY' });
		expect(r.success).toBe(true);
		expect(ejecutarMock).toHaveBeenCalledWith('tenant-1', 'p-1', 'u1');
		expect(r.data).toEqual({ contabilizados: 2, yaPosteados: 0, omitidos: 0 });
	});
});
