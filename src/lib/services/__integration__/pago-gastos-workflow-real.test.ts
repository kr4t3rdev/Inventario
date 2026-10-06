import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { prisma } from '@/lib/prisma';
import { seedPlanContable } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { applyPagoGastoWorkflow } from '@/lib/services/pago-gastos-workflow';

assertDisposableDatabase(process.env);

const prefix = `cta-gastos-${crypto.randomUUID()}`;
let tenantId = '';
let cuentaId = '';
let tipoPagoId = '';
let gastosDEId = '';
let auditTrigger = '';

const actorId = 'actor-gastos';

const baseParams = () => ({
	tipoGasto: 'gastoDE' as const,
	referenciaId: gastosDEId,
	gastosDEId,
	reconciliadoPor: actorId,
	tenantId,
	descripcion: 'Pago servicio G1',
	monto: 120,
	moneda: 'CUP',
	periodo: '2026-10',
	fechaPago: new Date(),
	cuentaId,
	tipoPagoId,
});

/** @description Prueba el workflow de pago de gastos en PostgreSQL aislado (G1: rollback por fallo de auditoría). */
describe('pago-gastos workflow — PostgreSQL aislado', { timeout: 90_000 }, () => {
	beforeAll(async () => {
		const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
			SELECT current_database() AS db, inet_server_port() AS port
		`;
		const target = new URL(process.env.DATABASE_URL ?? '');
		expect(identity[0]).toMatchObject({
			db: target.pathname.slice(1),
			port: Number(target.port),
		});
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
		tenantId = tenant.tenantId;
		const plan = await prisma.plan.create({ data: {
			nombre: prefix, duracionDias: 365,
			features: { 'contabilidad-formal': true, contabilidad: true },
		} });
		await prisma.tenantLicense.create({ data: {
			tenantId, planId: plan.planId, expiracion: new Date('2099-01-01'),
		} });
		await prisma.tenantAccountingPolicy.create({
			data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: actorId },
		});
		cuentaId = (await prisma.cuentaBancaria.create({ data: {
			tenantId, nombreBanco: `${prefix}-cta`, numeroCuenta: `${prefix}-cta`,
			tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 1000,
		} })).cuentaId;
		tipoPagoId = (await prisma.tipoPago.create({ data: {
			tenantId, nombre: `${prefix}-tp`, isActive: true, cuentaDefecto: cuentaId,
		} })).tipoId;
		gastosDEId = `gde-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
		await prisma.gastosDE.create({ data: {
			gastosDEId, tenantId, proveedor: `${prefix}-prov`, monto: 120, periodo: '2026-10',
		} });
		await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
		const now = new Date();
		await prisma.periodoContable.create({ data: {
			tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
			fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
			fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
		} });
	});

	afterAll(async () => {
		delete process.env.CONTABILIDAD_FORMAL_MODE;
		if (auditTrigger) {
			await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${auditTrigger}" ON "AuditLog"`);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${auditTrigger}"()`);
		}
		if (!tenantId) return;
		await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
		await prisma.asiento.deleteMany({ where: { tenantId } });
		await prisma.reconciliacionGasto.deleteMany({ where: { tenantId } });
		await prisma.gastosDE.deleteMany({ where: { tenantId } });
		await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
		await prisma.tipoPago.deleteMany({ where: { tenantId } });
		await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
		await prisma.cuentaContable.deleteMany({ where: { tenantId } });
		await prisma.diario.deleteMany({ where: { tenantId } });
		await prisma.periodoCache.deleteMany({ where: { tenantId } });
		await prisma.periodoContable.deleteMany({ where: { tenantId } });
		await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
		await prisma.tenantLicense.deleteMany({ where: { tenantId } });
		await prisma.tenant.deleteMany({ where: { tenantId } });
		await prisma.plan.deleteMany({ where: { nombre: prefix } });
	});

	it('revierte pago, reconciliación y asiento si falla la auditoría transaccional', async () => {
		auditTrigger = `cta_gastos_audit_${crypto.randomUUID().replaceAll('-', '')}`;
		await prisma.$executeRawUnsafe(`CREATE FUNCTION "${auditTrigger}"() RETURNS trigger
			LANGUAGE plpgsql AS $$ BEGIN
				IF NEW."usuarioId" = '${actorId}' AND NEW."entidad" = 'RECONCILIACION' THEN
					RAISE EXCEPTION 'gastos audit rejected' USING ERRCODE = '22012';
				END IF;
				RETURN NEW;
			END $$`);
		await prisma.$executeRawUnsafe(`CREATE TRIGGER "${auditTrigger}" BEFORE INSERT ON "AuditLog"
			FOR EACH ROW EXECUTE FUNCTION "${auditTrigger}"()`);
		const saldoBefore = (await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId },
		})).saldo;
		const recBefore = await prisma.reconciliacionGasto.count({ where: { tenantId } });
		const asientosBefore = await prisma.asiento.count({ where: { tenantId } });
		const gdeBefore = await prisma.gastosDE.findUniqueOrThrow({ where: { gastosDEId } });

		try {
			await expect(prisma.$transaction((tx) =>
			applyPagoGastoWorkflow(tx, baseParams()),
		)).rejects.toThrow(/gastos audit rejected/);

			expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
				.toEqual(saldoBefore);
			expect(await prisma.reconciliacionGasto.count({ where: { tenantId } })).toBe(recBefore);
			expect(await prisma.asiento.count({ where: { tenantId } })).toBe(asientosBefore);
			expect((await prisma.gastosDE.findUniqueOrThrow({ where: { gastosDEId } })).isPagado)
				.toBe(gdeBefore.isPagado);
		} finally {
			await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${auditTrigger}" ON "AuditLog"`);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${auditTrigger}"()`);
			auditTrigger = '';
		}
	});

	it('confirma pago con asiento único y débito bancario en el camino feliz', async () => {
		const result = await prisma.$transaction((tx) =>
			applyPagoGastoWorkflow(tx, baseParams()),
		);
		expect(result.reconciliaciones).toHaveLength(1);
		expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo
			.toString()).toBe('880');
		const asientos = await prisma.asiento.findMany({ where: {
			tenantId, origenTipo: 'reconciliacion_gasto',
			origenId: result.reconciliaciones[0].reconciliacionId,
		} });
		expect(asientos).toHaveLength(1);
	});

	it('rechaza el reintento de un pago directo ya registrado (409 PAGO_DUPLICADO)', async () => {
		// Gasto propio para no colisionar con el fixture compartido de los otros tests.
		const gdeRetry = `gde-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
		await prisma.gastosDE.create({ data: {
			gastosDEId: gdeRetry, tenantId, proveedor: `${prefix}-prov-retry`,
			monto: 120, periodo: '2026-10',
		} });
		const params = () => ({ ...baseParams(), referenciaId: gdeRetry, gastosDEId: gdeRetry });

		await prisma.$transaction((tx) => applyPagoGastoWorkflow(tx, params()));
		const saldoTrasPrimero = (await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId },
		})).saldo.toString();

		const retryError = await prisma.$transaction((tx) =>
			applyPagoGastoWorkflow(tx, params()),
		).then(
			() => null,
			(err: unknown) => err as { status?: number; code?: string },
		);
		expect(retryError).not.toBeNull();
		expect(retryError?.status).toBe(409);
		expect(retryError?.code).toBe('PAGO_DUPLICADO');

		// Sin duplicados: una sola reconciliación y un solo débito para este gasto.
		expect(await prisma.reconciliacionGasto.count({
			where: { tenantId, referenciaId: gdeRetry },
		})).toBe(1);
		// El saldo solo se movió por el primer pago de este test (120), no por el reintento.
		const saldoFinal = (await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId },
		})).saldo.toString();
		expect(Number(saldoTrasPrimero) - Number(saldoFinal)).toBe(0);
	});
});
