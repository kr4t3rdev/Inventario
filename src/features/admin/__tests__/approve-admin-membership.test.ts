/**
 * @description Tests de approveAdminMembership (PE-01): el alias legado
 * `tenantRole: "admin"` se rechaza con el error de rol inválido; solo se
 * aceptan manager/economico/dependiente. prismaPlatform mockeado (contrato
 * de aislamiento de tests vigente).
 * @module src/features/admin/__tests__/approve-admin-membership.test
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const platformMock = vi.hoisted(() => ({
	tenantMembership: {
		findUnique: vi.fn(),
		update: vi.fn(),
	},
	user: { update: vi.fn() },
	empleado: { findFirst: vi.fn(), create: vi.fn() },
}));

vi.mock('@/lib/db/platform-prisma', () => ({
	prismaPlatform: platformMock,
	default: platformMock,
}));

vi.mock('@/lib/services/tenant-scope', () => ({
	hasPermission: vi.fn(() => true),
}));

vi.mock('next/cache', () => ({
	revalidatePath: vi.fn(),
}));

import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { approveAdminMembership } from '../server/admin-global-queries';

/**
 * @description Usuario autenticado manager del tenant aprobador.
 * @returns {AuthenticatedUser} Usuario con permiso de gestión de usuarios.
 */
function buildManager(): AuthenticatedUser {
	return {
		userId: 'manager-1',
		email: 'manager@example.com',
		role: 'regularUser',
		isActive: true,
		tenantId: 'tenant-1',
		tenantRole: 'manager',
		planFeatures: [],
		planName: 'Básico',
		permissions: ['config.usuarios.gestionar'],
	} as AuthenticatedUser;
}

/**
 * @description Membresía pendiente de aprobación (fixture base).
 * @returns {Record<string, unknown>} Membresía inactiva con usuario embebido.
 */
function buildPendingMembership() {
	return {
		membershipId: 'membership-1',
		tenantId: 'tenant-1',
		userId: 'user-new',
		isActive: false,
		user: { userId: 'user-new', name: 'Ana Prueba', email: 'ana@example.com' },
	};
}

describe('approveAdminMembership — roles válidos (PE-01)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rechaza el alias legado "admin" con el error de rol inválido', async () => {
		await expect(
			approveAdminMembership(
				{ membershipId: 'membership-1', tenantRole: 'admin' },
				buildManager(),
			),
		).rejects.toThrow(
			'Rol inválido: admin. Roles válidos: manager, economico, dependiente',
		);
		expect(platformMock.tenantMembership.findUnique).not.toHaveBeenCalled();
	});

	it.each(['manager', 'economico', 'dependiente'])(
		'acepta el rol "%s", activa la membresía y crea el empleado',
		async (tenantRole) => {
			platformMock.tenantMembership.findUnique.mockResolvedValue(
				buildPendingMembership(),
			);
			platformMock.tenantMembership.update.mockResolvedValue({});
			platformMock.user.update.mockResolvedValue({});
			platformMock.empleado.findFirst.mockResolvedValue(null);
			platformMock.empleado.create.mockResolvedValue({});

			const result = await approveAdminMembership(
				{ membershipId: 'membership-1', tenantRole },
				buildManager(),
			);

			expect(result).toEqual({ success: true, empleadoCreado: true });
			expect(platformMock.tenantMembership.update).toHaveBeenCalledWith({
				where: { membershipId: 'membership-1' },
				data: { isActive: true, tenantRole },
			});
		},
	);
});
