/**
 * @description Contratos de la aprobación de modo por tenant (R7.4).
 *
 * El mecanismo permite que la licencia de un tenant apruebe `shadow` o
 * `enforce` sin cambiar el modo global de la flota. Está apagado por
 * defecto: sin la variable de entorno, ningún override altera el modo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@/generated/prisma';
import {
	ENV_MODO_POR_TENANT,
	modoActual,
	overridePorTenantHabilitado,
	OVERRIDE_MODO_ENFORCE,
	OVERRIDE_MODO_SHADOW,
	resolverModoAprobado,
	resolverModoEfectivo,
	resolverModoTenant,
} from '../lib/modo-tenant';

const MODO_ENV = 'CONTABILIDAD_FORMAL_MODE';

describe('modo formal por tenant', () => {
	let modoPrevio: string | undefined;
	let tenantPrevio: string | undefined;

	beforeEach(() => {
		modoPrevio = process.env[MODO_ENV];
		tenantPrevio = process.env[ENV_MODO_POR_TENANT];
		delete process.env[MODO_ENV];
		delete process.env[ENV_MODO_POR_TENANT];
	});

	afterEach(() => {
		if (modoPrevio === undefined) delete process.env[MODO_ENV];
		else process.env[MODO_ENV] = modoPrevio;
		if (tenantPrevio === undefined) delete process.env[ENV_MODO_POR_TENANT];
		else process.env[ENV_MODO_POR_TENANT] = tenantPrevio;
	});

	it('el modo global es off salvo que el entorno declare shadow o enforce', () => {
		expect(modoActual()).toBe('off');
		process.env[MODO_ENV] = 'shadow';
		expect(modoActual()).toBe('shadow');
		process.env[MODO_ENV] = 'enforce';
		expect(modoActual()).toBe('enforce');
		process.env[MODO_ENV] = 'activo';
		expect(modoActual()).toBe('off');
	});

	it('el mecanismo por tenant solo se habilita con el valor 1', () => {
		expect(overridePorTenantHabilitado()).toBe(false);
		process.env[ENV_MODO_POR_TENANT] = '0';
		expect(overridePorTenantHabilitado()).toBe(false);
		process.env[ENV_MODO_POR_TENANT] = '1';
		expect(overridePorTenantHabilitado()).toBe(true);
	});

	it('extrae la aprobación de la licencia con prioridad para enforce', () => {
		expect(resolverModoAprobado(null)).toBeNull();
		expect(resolverModoAprobado({})).toBeNull();
		expect(resolverModoAprobado({ [OVERRIDE_MODO_SHADOW]: true })).toBe('shadow');
		expect(resolverModoAprobado({ [OVERRIDE_MODO_ENFORCE]: true })).toBe('enforce');
		expect(
			resolverModoAprobado({
				[OVERRIDE_MODO_SHADOW]: true,
				[OVERRIDE_MODO_ENFORCE]: true,
			}),
		).toBe('enforce');
		expect(resolverModoAprobado({ [OVERRIDE_MODO_SHADOW]: false })).toBeNull();
	});

	it('sin el mecanismo habilitado el modo global manda', () => {
		expect(
			resolverModoEfectivo({
				modoGlobal: 'off',
				featureOverrides: { [OVERRIDE_MODO_ENFORCE]: true },
				porTenantHabilitado: false,
			}),
		).toBe('off');
	});

	it('con el mecanismo habilitado la aprobación del tenant prevalece', () => {
		expect(
			resolverModoEfectivo({
				modoGlobal: 'off',
				featureOverrides: { [OVERRIDE_MODO_SHADOW]: true },
				porTenantHabilitado: true,
			}),
		).toBe('shadow');
		expect(
			resolverModoEfectivo({
				modoGlobal: 'enforce',
				featureOverrides: { [OVERRIDE_MODO_SHADOW]: true },
				porTenantHabilitado: true,
			}),
		).toBe('shadow');
		expect(
			resolverModoEfectivo({
				modoGlobal: 'off',
				featureOverrides: null,
				porTenantHabilitado: true,
			}),
		).toBe('off');
	});

	it('no consulta la licencia cuando el mecanismo esta apagado', async () => {
		const findFirst = vi.fn();
		const db = { tenantLicense: { findFirst } } as unknown as Prisma.TransactionClient;

		await expect(resolverModoTenant(db, 'tenant-1')).resolves.toBe('off');
		expect(findFirst).not.toHaveBeenCalled();
	});

	it('lee la licencia vigente cuando el mecanismo esta habilitado', async () => {
		process.env[ENV_MODO_POR_TENANT] = '1';
		const findFirst = vi.fn(async () => ({
			featureOverrides: { [OVERRIDE_MODO_ENFORCE]: true },
		}));
		const db = { tenantLicense: { findFirst } } as unknown as Prisma.TransactionClient;

		await expect(resolverModoTenant(db, 'tenant-1')).resolves.toBe('enforce');
		expect(findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ tenantId: 'tenant-1', activa: true }),
				select: { featureOverrides: true },
			}),
		);
	});

	it('sin licencia vigente conserva el modo global', async () => {
		process.env[ENV_MODO_POR_TENANT] = '1';
		process.env[MODO_ENV] = 'shadow';
		const findFirst = vi.fn(async () => null);
		const db = { tenantLicense: { findFirst } } as unknown as Prisma.TransactionClient;

		await expect(resolverModoTenant(db, 'tenant-1')).resolves.toBe('shadow');
	});
});
