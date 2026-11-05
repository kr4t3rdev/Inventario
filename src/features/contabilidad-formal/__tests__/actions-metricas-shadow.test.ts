/**
 * @description Test focal de la accion de metricas del outbox shadow.
 *
 * Las metricas son la evidencia del rollout: solo un actor con la licencia de
 * contabilidad formal y el permiso de auditoria financiera puede verlas, y
 * siempre sobre su propio tenant.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');

const consultarMetricasShadowMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/contabilidad-formal/services/shadow-outbox', () => ({
	consultarMetricasShadow: consultarMetricasShadowMock,
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { getMetricasShadowAction } from '@/features/contabilidad-formal/actions-metricas-shadow';

const auditor: AuthenticatedUser = {
	userId: 'user-1',
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	role: 'user',
	isActive: true,
	name: 'Contador',
	email: 'contabilidad@example.com',
	planFeatures: { 'contabilidad-formal': true },
	permissions: new Set(['financiero.auditoria.ver']),
};

describe('getMetricasShadowAction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		consultarMetricasShadowMock.mockResolvedValue([
			{
				tipoEvento: 'VENTA_CREDITO',
				estado: 'CONFIRMADO',
				causa: null,
				cantidad: 3,
				latenciaP95Ms: 12,
			},
		]);
	});

	it('devuelve las metricas del tenant autenticado', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(auditor);

		const resultado = await getMetricasShadowAction();

		expect(resultado.success).toBe(true);
		expect(consultarMetricasShadowMock).toHaveBeenCalledWith(expect.anything(), 'tenant-1');
	});

	it('rechaza a un actor sin el permiso de auditoria financiera', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...auditor,
			permissions: new Set(),
		});

		const resultado = await getMetricasShadowAction();

		expect(resultado.success).toBe(false);
		expect(consultarMetricasShadowMock).not.toHaveBeenCalled();
	});

	it('rechaza a un tenant sin la licencia de contabilidad formal', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...auditor,
			planFeatures: {},
		});

		const resultado = await getMetricasShadowAction();

		expect(resultado.success).toBe(false);
		expect(consultarMetricasShadowMock).not.toHaveBeenCalled();
	});
});
