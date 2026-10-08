import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

assertDisposableDatabase(process.env);

let prisma!: typeof import('@/lib/prisma').prisma;
let PeriodoGuard!: typeof import('@/lib/services/periodo-contable-guard').PeriodoGuard;
let createVentaServicioAction!: typeof import('@/features/venta-servicios/actions').createVentaServicioAction;

vi.mock('@/lib/server-actions', async (importOriginal) => {
	const original = await importOriginal<typeof import('@/lib/server-actions')>();
	return {
		...original,
		withAction: (handler: (input: unknown, user: AuthenticatedUser) => unknown) =>
			async (input: unknown) => {
				const user = await getCurrentUser();
				if (!user) throw new Error('getCurrentUser mock no configurado');
				return handler(input, user);
			},
	};
});
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server-actions/get-current-user');

const prefix = `cta-servicio-cxc-${crypto.randomUUID()}`;
const userId = 'actor-service-credit-integration';
let tenantId = '';
let otherTenantId = '';
let serviceId = '';
let otherServiceId = '';
let customerId = '';
let otherCustomerId = '';
let trigger = '';
let functionName = '';

const admin = (targetTenantId: string): AuthenticatedUser => ({
	userId,
	name: 'Actor Integracion',
	email: 'actor-integracion@test.local',
	role: 'admin',
	isActive: true,
	tenantId: targetTenantId,
	tenantRole: 'manager',
	planFeatures: { servicios: true },
});

/** @description Prueba atomicidad real de la venta de servicio a crédito en PostgreSQL. */
describe('venta de servicio a crédito — PostgreSQL aislado', { timeout: 90_000 }, () => {
	beforeAll(async () => {
		const [prismaModule, periodoModule, actionsModule] = await Promise.all([
			import('@/lib/prisma'),
			import('@/lib/services/periodo-contable-guard'),
			import('@/features/venta-servicios/actions'),
		]);
		prisma = prismaModule.prisma;
		PeriodoGuard = periodoModule.PeriodoGuard;
		createVentaServicioAction = actionsModule.createVentaServicioAction;

		const target = new URL(process.env.DATABASE_URL ?? '');
		const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
			SELECT current_database() AS db, inet_server_port() AS port
		`;
		expect(identity[0]).toMatchObject({
			db: target.pathname.slice(1),
			port: Number(target.port),
		});

		await prisma.moneda.upsert({
			where: { codigo: 'CUP' },
			create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' },
			update: {},
		});

		const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
		tenantId = tenant.tenantId;
		const otherTenant = await prisma.tenant.create({
			data: { nombre: `${prefix}-other`, slug: `${prefix}-other` },
		});
		otherTenantId = otherTenant.tenantId;
		const service = await prisma.servicios.create({ data: {
			tenantId, nombre: prefix, descripcion: prefix, precio: 1250, moneda: 'CUP',
		} });
		serviceId = service.servicioId;
		const otherService = await prisma.servicios.create({ data: {
			tenantId: otherTenantId, nombre: `${prefix}-other`, descripcion: prefix,
			precio: 1250, moneda: 'CUP',
		} });
		otherServiceId = otherService.servicioId;
		customerId = (await prisma.cliente.create({ data: { tenantId, nombre: prefix } })).clienteId;
		otherCustomerId = (await prisma.cliente.create({
			data: { tenantId: otherTenantId, nombre: `${prefix}-other` },
		})).clienteId;
		await prisma.tenantAccountingPolicy.create({ data: {
			tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId,
		} });
		const now = new Date();
		await prisma.periodoContable.create({ data: {
			tenantId,
			tipo: 'MENSUAL',
			estado: 'ABIERTO',
			fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
			fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
		} });
		await PeriodoGuard.assertWritable(now, tenantId, 'devengo', {
			actorId: userId,
			actorTipo: 'USUARIO',
			origen: { tipo: 'venta_servicio', id: prefix },
		});
	});

	beforeEach(() => {
		vi.mocked(getCurrentUser).mockResolvedValue(admin(tenantId));
	});

	afterAll(async () => {
		if (!prisma) return;
		if (trigger) {
			await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "CuentaPorCobrar"`);
		}
		if (functionName) {
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
		}
		if (tenantId || otherTenantId) {
			const tenantIds = [tenantId, otherTenantId].filter(Boolean);
			await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId: { in: tenantIds } } });
			await prisma.ventaServicios.deleteMany({ where: { tenantId: { in: tenantIds } } });
			await prisma.cliente.deleteMany({ where: { tenantId: { in: tenantIds } } });
			await prisma.servicios.deleteMany({ where: { tenantId: { in: tenantIds } } });
			await prisma.periodoCache.deleteMany({ where: { tenantId: { in: tenantIds } } });
			await prisma.periodoContable.deleteMany({ where: { tenantId: { in: tenantIds } } });
			await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId: { in: tenantIds } } });
			await prisma.tenant.deleteMany({ where: { tenantId: { in: tenantIds } } });
		}
	});

	it('revierte la venta cuando PostgreSQL rechaza insertar su CxC', async () => {
		trigger = `cta_service_cxc_${crypto.randomUUID().replaceAll('-', '')}`;
		functionName = `${trigger}_fn`;
		await prisma.$executeRawUnsafe(`CREATE FUNCTION ${functionName}() RETURNS trigger
			LANGUAGE plpgsql AS $$ BEGIN
				RAISE EXCEPTION 'forced service CxC insert failure' USING ERRCODE = '22012';
				RETURN NEW;
			END $$`);
		await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "CuentaPorCobrar"
			FOR EACH ROW WHEN (NEW."tenantId" = '${tenantId}') EXECUTE FUNCTION ${functionName}()`);

		const salesBefore = await prisma.ventaServicios.count({ where: { tenantId } });
		const receivablesBefore = await prisma.cuentaPorCobrar.count({ where: { tenantId } });
		try {
			await expect(createVentaServicioAction({
				servicioId: serviceId,
				cantidad: 2,
				condicionPago: 'CREDITO',
				clienteId: customerId,
			})).rejects.toThrow('forced service CxC insert failure');

			expect(await prisma.ventaServicios.count({ where: { tenantId } })).toBe(salesBefore);
			expect(await prisma.cuentaPorCobrar.count({ where: { tenantId } })).toBe(receivablesBefore);
		} finally {
			await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "CuentaPorCobrar"`);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
			trigger = '';
			functionName = '';
		}
	});

	it('rechaza referencias a servicio o cliente de otro tenant sin escribir filas', async () => {
		const salesBefore = await prisma.ventaServicios.count({ where: { tenantId } });
		const receivablesBefore = await prisma.cuentaPorCobrar.count({ where: { tenantId } });

		await expect(createVentaServicioAction({
			servicioId: otherServiceId,
			cantidad: 1,
			condicionPago: 'CREDITO',
			clienteId: customerId,
		})).rejects.toThrow();
		await expect(createVentaServicioAction({
			servicioId: serviceId,
			cantidad: 1,
			condicionPago: 'CREDITO',
			clienteId: otherCustomerId,
		})).rejects.toThrow();

		expect(await prisma.ventaServicios.count({ where: { tenantId } })).toBe(salesBefore);
		expect(await prisma.cuentaPorCobrar.count({ where: { tenantId } })).toBe(receivablesBefore);
	});
});
