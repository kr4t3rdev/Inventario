import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/prisma';

/**
 * Tests de modelo PG-02 (integración, base de datos real).
 * Corren solo con `pnpm test:integration` (DATABASE_URL_TEST).
 * Cubren: alta de rol, unicidad (tenantId, nombre), RESTRICT con miembros
 * asignados y cascada al borrar el tenant.
 */

describe('TenantRole + Membership.customRoleId', { timeout: 30_000 }, () => {
	const createdTenantIds: string[] = [];
	const createdUserIds: string[] = [];

	const createTenant = async (suffix: string) => {
		const tenant = await prisma.tenant.create({
			data: { nombre: `Tenant PG02 ${suffix} ${Date.now()}`, slug: `pg02-${suffix}-${Date.now()}` },
		});
		createdTenantIds.push(tenant.tenantId);
		return tenant;
	};

	const createUser = async (suffix: string) => {
		const user = await prisma.user.create({
			data: {
				name: `Usuario PG02 ${suffix}`,
				email: `pg02-${suffix}-${Date.now()}@test.invalid`,
				password: 'hashed-password-de-prueba',
			},
		});
		createdUserIds.push(user.userId);
		return user;
	};

	afterEach(async () => {
		// Borrar tenants primero: cascade limpia roles y membresías.
		for (const tenantId of createdTenantIds.splice(0)) {
			await prisma.tenant.delete({ where: { tenantId } });
		}
		for (const userId of createdUserIds.splice(0)) {
			await prisma.user.delete({ where: { userId } });
		}
	});

	it('crea un rol con permisos JSON y los lee de vuelta', async () => {
		const tenant = await createTenant('crear');
		const role = await prisma.tenantRole.create({
			data: {
				tenantId: tenant.tenantId,
				nombre: 'Cajero',
				permissions: ['ventas.venta.registrar', 'ventas.facturas.consultar'],
			},
		});

		const leido = await prisma.tenantRole.findUnique({ where: { roleId: role.roleId } });
		expect(leido?.nombre).toBe('Cajero');
		expect(leido?.permissions).toEqual(['ventas.venta.registrar', 'ventas.facturas.consultar']);
		expect(leido?.isActive).toBe(true);
	});

	it('rechaza nombre duplicado en el mismo tenant y lo permite en otro tenant', async () => {
		const tenantA = await createTenant('a');
		const tenantB = await createTenant('b');

		await prisma.tenantRole.create({
			data: { tenantId: tenantA.tenantId, nombre: 'Supervisor', permissions: [] },
		});

		await expect(
			prisma.tenantRole.create({
				data: { tenantId: tenantA.tenantId, nombre: 'Supervisor', permissions: [] },
			}),
		).rejects.toThrow();

		const enOtroTenant = await prisma.tenantRole.create({
			data: { tenantId: tenantB.tenantId, nombre: 'Supervisor', permissions: [] },
		});
		expect(enOtroTenant.tenantId).toBe(tenantB.tenantId);
	});

	it('bloquea borrar un rol con miembros asignados (Restrict) y permite tras reasignar', async () => {
		const tenant = await createTenant('restrict');
		const user = await createUser('restrict');
		const role = await prisma.tenantRole.create({
			data: { tenantId: tenant.tenantId, nombre: 'Vendedor', permissions: [] },
		});
		const membership = await prisma.tenantMembership.create({
			data: {
				tenantId: tenant.tenantId,
				userId: user.userId,
				tenantRole: 'dependiente',
				customRoleId: role.roleId,
			},
		});

		await expect(
			prisma.tenantRole.delete({ where: { roleId: role.roleId } }),
		).rejects.toThrow();

		await prisma.tenantMembership.update({
			where: { membershipId: membership.membershipId },
			data: { customRoleId: null },
		});
		await expect(prisma.tenantRole.delete({ where: { roleId: role.roleId } })).resolves.toBeTruthy();
	});

	it('eliminar el tenant borra sus roles en cascada', async () => {
		const tenant = await createTenant('cascada');
		const role = await prisma.tenantRole.create({
			data: { tenantId: tenant.tenantId, nombre: 'Auditor', permissions: [] },
		});

		// Se borra aquí mismo; el afterEach no debe fallar por la doble baja.
		await prisma.tenant.delete({ where: { tenantId: tenant.tenantId } });
		createdTenantIds.splice(createdTenantIds.indexOf(tenant.tenantId), 1);

		const zombi = await prisma.tenantRole.findUnique({ where: { roleId: role.roleId } });
		expect(zombi).toBeNull();
	});
});
