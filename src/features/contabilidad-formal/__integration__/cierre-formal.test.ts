/**
 * @description Comprueba atomicidad de las transiciones manuales R3 contra PostgreSQL real.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => ({
	value: {
		userId: 'transition-approver', name: 'Approver', email: 'approver@test.invalid',
		role: 'user' as const, isActive: true, tenantId: '', tenantRole: 'manager' as const,
		planFeatures: { contabilidad: true },
	},
}));

vi.mock('@/lib/server-actions/get-current-user', () => ({
	getCurrentUser: async () => currentUser.value,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { prisma } from '@/lib/prisma';
import {
	aprobarPeriodoAction,
	cerrarPeriodoAction,
} from '@/features/contabilidad/actions-periodos';
import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';

describe('formal accounting period transitions — integration', () => {
	let tenantId = '';
	let periodoId = '';
	const originalFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;

	beforeAll(async () => {
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		await prisma.$transaction(async (tx) => seedPlantillasGlobales(tx));
		const tenant = await prisma.tenant.create({
			data: { nombre: 'R334 transition', slug: `r334-${Date.now()}` },
		});
		tenantId = tenant.tenantId;
		await prisma.$transaction(async (tx) => seedPlanContable(tx, tenantId));
		currentUser.value.tenantId = tenantId;
		const periodo = await prisma.periodoContable.create({
			data: {
				tenantId, tipo: 'MENSUAL', estado: 'CERRADO',
				fechaInicio: new Date('2026-01-01T00:00:00Z'),
				fechaFin: new Date('2026-01-31T23:59:59Z'),
				cerradoPor: 'transition-closer', cerradoAt: new Date(),
				resumenJson: { total: 0 }, hashIntegridad: 'test-hash',
			},
		});
		periodoId = periodo.periodoId;
	});

	afterAll(async () => {
		if (originalFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
		else process.env.CONTABILIDAD_FORMAL_MODE = originalFormalMode;
		if (!tenantId) return;
		await prisma.$transaction(async (tx) => {
			await tx.auditoriaPeriodo.deleteMany({ where: { periodo: { tenantId } } });
			await tx.aperturaPeriodo.deleteMany({ where: { tenantId } });
			await tx.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
			await tx.asiento.deleteMany({ where: { tenantId } });
			await tx.periodoContable.deleteMany({ where: { tenantId } });
			await tx.cuentaRolTenant.deleteMany({ where: { tenantId } });
			await tx.cuentaContable.updateMany({ where: { tenantId }, data: { padreId: null } });
			await tx.cuentaContable.deleteMany({ where: { tenantId } });
			await tx.diario.deleteMany({ where: { tenantId } });
			await tx.tenant.delete({ where: { tenantId } });
		});
	});

	it('rolls back approval when enforced formal close returns OMITIDO', async () => {
		const response = await aprobarPeriodoAction({ periodoId });
		expect(response.success).toBe(false);
		if (!response.success) expect(response.error.code).toBe('FORMAL_ACCOUNTING_REQUIRED');
		const persisted = await prisma.periodoContable.findUniqueOrThrow({ where: { periodoId } });
		expect(persisted.estado).toBe('CERRADO');
		expect(await prisma.asiento.count({
			where: { tenantId, origenTipo: 'cierre_periodo', origenId: periodoId },
		})).toBe(0);
	});

	it('rolls back an automatic close when enforce mode cannot create a formal close', async () => {
		const autoClosePeriod = await prisma.periodoContable.create({
			data: {
				tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
				fechaInicio: new Date('2026-02-01T00:00:00Z'),
				fechaFin: new Date('2026-02-28T23:59:59Z'),
			},
		});

		const response = await cerrarPeriodoAction({ periodoId: autoClosePeriod.periodoId });
		expect(response.success).toBe(false);
		if (!response.success) expect(response.error.code).toBe('FORMAL_ACCOUNTING_REQUIRED');
		const persisted = await prisma.periodoContable.findUniqueOrThrow({
			where: { periodoId: autoClosePeriod.periodoId },
		});
		expect(persisted.estado).toBe('ABIERTO');
		expect(await prisma.asiento.count({
			where: { tenantId, origenTipo: 'cierre_periodo', origenId: autoClosePeriod.periodoId },
		})).toBe(0);
	});

	it('does not close an inactive period for a non-manager without a formal journal', async () => {
		currentUser.value.tenantRole = 'economico' as typeof currentUser.value.tenantRole;
		const optionalClosePeriod = await prisma.periodoContable.create({
			data: {
				tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
				fechaInicio: new Date('2026-05-01T00:00:00Z'),
				fechaFin: new Date('2026-05-31T23:59:59Z'),
			},
		});

		const response = await cerrarPeriodoAction({ periodoId: optionalClosePeriod.periodoId });
		expect(response.success).toBe(false);
		if (!response.success) expect(response.error.code).toBe('FORMAL_ACCOUNTING_REQUIRED');
		const persisted = await prisma.periodoContable.findUniqueOrThrow({
			where: { periodoId: optionalClosePeriod.periodoId },
		});
		expect(persisted.estado).toBe('ABIERTO');
		expect(await prisma.asiento.count({
			where: { tenantId, origenTipo: 'cierre_periodo', origenId: optionalClosePeriod.periodoId },
		})).toBe(0);
		currentUser.value.tenantRole = 'manager';
	});

	it.each(['off', 'shadow'] as const)(
		'keeps approval available in %s mode and remains idempotent',
		async (mode) => {
			process.env.CONTABILIDAD_FORMAL_MODE = mode;
			const compatibilityPeriod = await prisma.periodoContable.create({
				data: {
					tenantId, tipo: 'MENSUAL', estado: 'CERRADO',
					fechaInicio: new Date(mode === 'off' ? '2026-03-01T00:00:00Z' : '2026-04-01T00:00:00Z'),
					fechaFin: new Date(mode === 'off' ? '2026-03-31T23:59:59Z' : '2026-04-30T23:59:59Z'),
					cerradoPor: 'transition-closer', cerradoAt: new Date(),
					resumenJson: { total: 0 }, hashIntegridad: 'test-hash',
				},
			});

			const first = await aprobarPeriodoAction({ periodoId: compatibilityPeriod.periodoId });
			expect(first.success).toBe(true);
			const second = await aprobarPeriodoAction({ periodoId: compatibilityPeriod.periodoId });
			expect(second.success).toBe(true);
			expect(await prisma.periodoContable.findUniqueOrThrow({
				where: { periodoId: compatibilityPeriod.periodoId },
			}).then((periodo) => periodo.estado)).toBe('APROBADO');
			expect(await prisma.asiento.count({
				where: { tenantId, origenTipo: 'cierre_periodo', origenId: compatibilityPeriod.periodoId },
			})).toBe(0);
		},
	);
});
