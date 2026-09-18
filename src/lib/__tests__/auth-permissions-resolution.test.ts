import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveTenantContext } from '@/lib/auth-middleware';
import { getDefaultPermissionsForRole } from '@/lib/auth/permission-registry';
import { prisma } from '@/lib/prisma';

/**
 * PG-03: resolución de permisos efectivos en el contexto de tenant.
 * Reglas del design: customRole válido → Set exacto del rol; clave
 * inexistente/inactiva/de otro tenant → fallback a defaults del rol fijo
 * (fail-safe, nunca fail-open); sin customRoleId → defaults SIN query extra.
 */

vi.mock('@/lib/prisma', () => ({
	prisma: {
		tenantMembership: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
		},
		tenantLicense: {
			findFirst: vi.fn(),
		},
		tenantRole: {
			findFirst: vi.fn(),
		},
	},
}));

vi.mock('@/lib/db/platform-prisma', async () => {
	const { prisma } = await import('@/lib/prisma');
	return { prismaPlatform: prisma, default: prisma };
});

const baseMembership = {
	membershipId: 'mem-1',
	tenantId: 'tenant-1',
	userId: 'user-1',
	isActive: true,
	createdAt: new Date(),
	updatedAt: new Date(),
};

describe('resolveTenantContext — permisos efectivos (PG-03)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue(null);
	});

	it('sin customRoleId: usa defaults del rol fijo y NO consulta tenant_roles', async () => {
		vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
			...baseMembership,
			tenantRole: 'dependiente',
			customRoleId: null,
		} as never);

		const ctx = await resolveTenantContext('user-1', 'tenant-1');

		expect(ctx?.tenantRole).toBe('dependiente');
		expect(ctx?.permissions).toBeDefined();
		expect([...(ctx?.permissions ?? [])].sort()).toEqual(
			[...getDefaultPermissionsForRole('dependiente')].sort(),
		);
		expect(prisma.tenantRole.findFirst).not.toHaveBeenCalled();
	});

	it('con customRole válido: los permisos efectivos son exactamente los del rol', async () => {
		vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
			...baseMembership,
			tenantRole: 'manager',
			customRoleId: 'role-cajero',
		} as never);
		vi.mocked(prisma.tenantRole.findFirst).mockResolvedValue({
			roleId: 'role-cajero',
			tenantId: 'tenant-1',
			nombre: 'Cajero',
			permissions: ['ventas.venta.registrar', 'ventas.facturas.consultar'],
			isActive: true,
		} as never);

		const ctx = await resolveTenantContext('user-1', 'tenant-1');

		expect(ctx?.tenantRole).toBe('manager'); // el rol fijo queda como metadata
		expect([...(ctx?.permissions ?? [])].sort()).toEqual(
			['ventas.facturas.consultar', 'ventas.venta.registrar'].sort(),
		);
	});

	it('consulta el rol con scope de tenant y isActive (nunca rol ajeno ni inactivo)', async () => {
		vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
			...baseMembership,
			tenantRole: 'manager',
			customRoleId: 'role-cajero',
		} as never);
		vi.mocked(prisma.tenantRole.findFirst).mockResolvedValue(null);

		const ctx = await resolveTenantContext('user-1', 'tenant-1');

		expect(prisma.tenantRole.findFirst).toHaveBeenCalledWith({
			where: { roleId: 'role-cajero', tenantId: 'tenant-1', isActive: true },
		});
		// Rol no encontrado (inexistente/inactivo/ajeno) → fallback a defaults (fail-safe)
		expect([...(ctx?.permissions ?? [])].sort()).toEqual(
			[...getDefaultPermissionsForRole('manager')].sort(),
		);
	});

	it('customRole de OTRO tenant no se aplica (la query con tenantId no lo encuentra)', async () => {
		vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
			...baseMembership,
			tenantRole: 'dependiente',
			customRoleId: 'role-ajeno',
		} as never);
		// La query filtra por tenantId: un rol de otro tenant devuelve null.
		vi.mocked(prisma.tenantRole.findFirst).mockResolvedValue(null);

		const ctx = await resolveTenantContext('user-1', 'tenant-1');

		expect([...(ctx?.permissions ?? [])].sort()).toEqual(
			[...getDefaultPermissionsForRole('dependiente')].sort(),
		);
	});
});
