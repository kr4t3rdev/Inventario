import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { hashImmutableFinancialEvidence } from '@/features/contabilidad/services/immutable-financial-evidence';

assertDisposableDatabase(process.env);

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let prisma!: typeof import('@/lib/prisma').prisma;
let createRequest!: typeof import('@/features/contabilidad/actions-periodos').solicitarAperturaManualAction;
let approveRequest!: typeof import('@/features/contabilidad/actions-periodos').aprobarAperturaManualAction;
let listRequests!: typeof import('@/features/contabilidad/actions-periodos').listarSolicitudesAperturaManualAction;
let readRequest!: typeof import('@/features/contabilidad/actions-periodos').obtenerSolicitudAperturaManualAction;
let openApproved!: typeof import('@/features/contabilidad/actions-periodos').abrirPeriodoManualAprobadoAction;
let tenantId = '';
let otherTenantId = '';
let planId = '';
let licenseId = '';
let userId = '';
let currencyCreated = false;
let usdCreated = false;
let rateId = '';
let triggerInstalled = false;
const unique = crypto.randomUUID().replaceAll('-', '');
const slug = `manual-open-${unique}`;
const email = `${slug}@test.local`;
const triggerName = `manual_open_fail_${unique.slice(0, 12)}`;
const functionName = `manual_open_fail_fn_${unique.slice(0, 12)}`;
const overlapTriggerName = `manual_open_overlap_${unique.slice(0, 12)}`;
const overlapFunctionName = `manual_open_overlap_fn_${unique.slice(0, 12)}`;
let activeTenantId = '';
let multiCurrencyEnabled = true;

function actor(): AuthenticatedUser {
	return {
		userId,
		name: 'Manual opening integration approver',
		email,
		role: 'user',
		isActive: true,
		tenantId: activeTenantId,
		tenantRole: 'manager',
		planFeatures: { contabilidad: true, 'multi-moneda': multiCurrencyEnabled },
		permissions: new Set(['financiero.apertura.aprobar']),
	};
}

function openingLines() {
	return [
		{ cuentaCodigo: '101', moneda: 'USD', debito: '10.00', credito: '0' },
		{ cuentaCodigo: '301', moneda: 'CUP', debito: '0', credito: '20.00' },
	];
}

async function submitAndApprove(start: string, end: string, tipo: string = 'MENSUAL') {
	const request = await createRequest({
		idempotencyKey: `open-${unique.slice(0, 8)}-${start}-${end}`,
		tipo: tipo as never,
		fechaInicio: new Date(`${start}T00:00:00.000Z`).toISOString(),
		fechaFin: new Date(`${end}T23:59:59.000Z`).toISOString(),
		lineas: openingLines(),
	});
	expect(request.success, JSON.stringify(request)).toBe(true);
	if (!request.success) throw new Error(request.error.message);
	const requestId = request.data.solicitudId;
	const approval = await approveRequest({ solicitudId: requestId });
	expect(approval.success, JSON.stringify(approval)).toBe(true);
	if (!approval.success) throw new Error(approval.error.message);
	return requestId;
}

describe('manual verified opening workflow — PostgreSQL', { timeout: 120_000 }, () => {
	beforeAll(async () => {
		const [prismaModule, actions] = await Promise.all([
			import('@/lib/prisma'),
			import('@/features/contabilidad/actions-periodos'),
		]);
		prisma = prismaModule.prisma;
		createRequest = actions.solicitarAperturaManualAction;
		approveRequest = actions.aprobarAperturaManualAction;
		listRequests = actions.listarSolicitudesAperturaManualAction;
		readRequest = actions.obtenerSolicitudAperturaManualAction;
		openApproved = actions.abrirPeriodoManualAprobadoAction;

		const identity = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
			SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
		`;
		assertDisposableDatabaseIdentity(identity[0], process.env);

		const existingCurrency = await prisma.moneda.findUnique({ where: { codigo: 'CUP' } });
		if (!existingCurrency) {
			await prisma.moneda.create({ data: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' } });
			currencyCreated = true;
		}
		if (!(await prisma.moneda.findUnique({ where: { codigo: 'USD' } }))) {
			await prisma.moneda.create({ data: { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'USD' } });
			usdCreated = true;
		}
		const rate = await prisma.tasaCambio.create({ data: {
			monedaOrigenId: 'USD', monedaDestino: 'CUP', tasa: '2', fechaVigencia: new Date('2026-10-28T00:00:00.000Z'),
		} });
		rateId = rate.tasaId;
		const plan = await prisma.plan.create({ data: { nombre: slug, duracionDias: 365, features: { contabilidad: true } } });
		planId = plan.planId;
		const tenant = await prisma.tenant.create({ data: { nombre: slug, slug } });
		tenantId = tenant.tenantId;
		const other = await prisma.tenant.create({ data: { nombre: `${slug}-other`, slug: `${slug}-other` } });
		otherTenantId = other.tenantId;
		const license = await prisma.tenantLicense.create({ data: { tenantId, planId, expiracion: new Date('2099-01-01') } });
		licenseId = license.tenantLicenseId;
		const user = await prisma.user.create({ data: { name: 'Manual opening integration approver', email, password: 'integration-only-placeholder' } });
		userId = user.userId;
		await prisma.tenantAccountingPolicy.create({
			data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
		});
		await prisma.cuentaContable.createMany({ data: [
			{ tenantId, codigo: '101', nombre: 'Caja', tipo: 'ACTIVO', naturaleza: 'DEUDORA' },
			{ tenantId, codigo: '301', nombre: 'Capital', tipo: 'PATRIMONIO', naturaleza: 'ACREEDORA' },
		] });
		const bankRoleAccount = await prisma.cuentaContable.findFirstOrThrow({ where: { tenantId, codigo: '101' } });
		await prisma.cuentaRolTenant.create({ data: { tenantId, rol: 'BANCOS', cuentaId: bankRoleAccount.cuentaContableId } });
		await prisma.diario.create({ data: { tenantId, tipo: 'APERTURA_CIERRE', codigo: `AP-${unique.slice(0, 8)}`, nombre: 'Apertura y cierre' } });
		activeTenantId = tenantId;
		vi.mocked(getCurrentUser).mockImplementation(async () => actor());
	});

	afterAll(async () => {
		if (!prisma) return;
		if (triggerInstalled) {
			await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "AuditLog"`);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
		}
		if (tenantId) {
			await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
			await prisma.$executeRawUnsafe('ALTER TABLE "apertura_periodo_solicitudes" DISABLE TRIGGER "consumed_opening_immutable"');
			try { await prisma.aperturaPeriodoSolicitud.deleteMany({ where: { tenantId } }); }
			finally { await prisma.$executeRawUnsafe('ALTER TABLE "apertura_periodo_solicitudes" ENABLE TRIGGER "consumed_opening_immutable"'); }
			await prisma.aperturaPeriodo.deleteMany({ where: { tenantId } });
			await prisma.auditoriaPeriodo.deleteMany({ where: { tenantId } });
			await prisma.asientoLinea.deleteMany({ where: { tenantId } });
			await prisma.asiento.deleteMany({ where: { tenantId } });
			await prisma.periodoContable.deleteMany({ where: { tenantId } });
			await prisma.periodoCache.deleteMany({ where: { tenantId } });
			await prisma.$executeRawUnsafe('ALTER TABLE "fx_evidence" DISABLE TRIGGER "fx_evidence_immutable_delete"');
			try {
				await prisma.fxEvidence.deleteMany({ where: { tenantId } });
			} finally {
				await prisma.$executeRawUnsafe('ALTER TABLE "fx_evidence" ENABLE TRIGGER "fx_evidence_immutable_delete"');
			}
			await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
			await prisma.diario.deleteMany({ where: { tenantId } });
			await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
			await prisma.cuentaContable.deleteMany({ where: { tenantId } });
		}
		if (userId) await prisma.auditLog.deleteMany({ where: { usuarioId: userId } });
		if (licenseId) await prisma.tenantLicense.deleteMany({ where: { tenantId } });
		if (tenantId) await prisma.tenant.deleteMany({ where: { tenantId } });
		if (otherTenantId) await prisma.tenant.deleteMany({ where: { tenantId: otherTenantId } });
		if (planId) await prisma.plan.deleteMany({ where: { planId } });
		if (userId) await prisma.user.deleteMany({ where: { userId } });
		if (rateId) await prisma.tasaCambio.delete({ where: { tasaId: rateId } });
		if (currencyCreated) await prisma.moneda.deleteMany({ where: { codigo: 'CUP' } });
		if (usdCreated) await prisma.moneda.deleteMany({ where: { codigo: 'USD' } });
		await prisma.$disconnect();
	});

	it('rejects approval when bank balance differs from the opening line', async () => {
		const account = await prisma.cuentaContable.findFirstOrThrow({ where: { tenantId, codigo: '101' } });
		const result = await createRequest({ idempotencyKey: `mismatch-${unique}`, tipo: 'MENSUAL',
			fechaInicio: '2098-03-01T00:00:00.000Z', fechaFin: '2098-03-31T23:59:59.000Z',
			lineas: openingLines(), cuentasBancarias: [{ nombreCuenta: 'Inicial', nombreBanco: 'Banco',
				numeroCuenta: `mismatch-${unique}`, tipoCuenta: 'CORRIENTE', moneda: 'USD',
				saldo: '11.00', cuentaContableId: account.cuentaContableId }] } as never);
		expect(result.success).toBe(true);
		if (!result.success) throw new Error(result.error.message);
		const approved = await approveRequest({ solicitudId: result.data.solicitudId });
		expect(approved.success).toBe(false);
		expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(0);
	});

	it('rejects a zero bank balance linked to a foreign or missing accounting account', async () => {
		const result = await createRequest({ idempotencyKey: `zero-${unique}`, tipo: 'MENSUAL',
			fechaInicio: '2098-04-01T00:00:00.000Z', fechaFin: '2098-04-30T23:59:59.000Z',
			lineas: openingLines(), cuentasBancarias: [{ nombreCuenta: 'Inicial', nombreBanco: 'Banco',
				numeroCuenta: `zero-${unique}`, tipoCuenta: 'CORRIENTE', moneda: 'USD',
				saldo: '0', cuentaContableId: 'foreign-id' }] } as never);
		expect(result.success).toBe(true);
		if (!result.success) throw new Error(result.error.message);
		expect((await approveRequest({ solicitudId: result.data.solicitudId })).success).toBe(false);
	});

	it('rejects foreign currency when the effective plan lacks multi-currency', async () => {
		const account = await prisma.cuentaContable.findFirstOrThrow({ where: { tenantId, codigo: '101' } });
		const result = await createRequest({ idempotencyKey: `plan-${unique}`, tipo: 'MENSUAL',
			fechaInicio: '2098-05-01T00:00:00.000Z', fechaFin: '2098-05-31T23:59:59.000Z', lineas: openingLines(),
			cuentasBancarias: [{ nombreCuenta: 'Inicial', nombreBanco: 'Banco', numeroCuenta: `plan-${unique}`,
				tipoCuenta: 'CORRIENTE', moneda: 'USD', saldo: '10', cuentaContableId: account.cuentaContableId }] } as never);
		expect(result.success).toBe(true);
		if (!result.success) throw new Error(result.error.message);
		multiCurrencyEnabled = false;
		try { expect((await approveRequest({ solicitudId: result.data.solicitudId })).success).toBe(false); }
		finally { multiCurrencyEnabled = true; }
	});

	it('rejects an inactive currency even when the balance is zero', async () => {
		const account = await prisma.cuentaContable.findFirstOrThrow({ where: { tenantId, codigo: '101' } });
		const result = await createRequest({ idempotencyKey: `inactive-${unique}`, tipo: 'MENSUAL',
			fechaInicio: '2098-06-01T00:00:00.000Z', fechaFin: '2098-06-30T23:59:59.000Z', lineas: openingLines(),
			cuentasBancarias: [{ nombreCuenta: 'Inicial', nombreBanco: 'Banco', numeroCuenta: `inactive-${unique}`,
				tipoCuenta: 'CORRIENTE', moneda: 'USD', saldo: '0', cuentaContableId: account.cuentaContableId }] } as never);
		expect(result.success).toBe(true);
		if (!result.success) throw new Error(result.error.message);
		await prisma.moneda.update({ where: { codigo: 'USD' }, data: { isActive: false } });
		try { expect((await approveRequest({ solicitudId: result.data.solicitudId })).success).toBe(false); }
		finally { await prisma.moneda.update({ where: { codigo: 'USD' }, data: { isActive: true } }); }
	});

	it('rejects an omitted treasury role with a nonzero opening line', async () => {
		const bank = await prisma.cuentaContable.findFirstOrThrow({ where: { tenantId, codigo: '101' } });
		const cash = await prisma.cuentaContable.create({ data: { tenantId, codigo: '102', nombre: 'Efectivo', tipo: 'ACTIVO', naturaleza: 'DEUDORA' } });
		await prisma.cuentaRolTenant.create({ data: { tenantId, rol: 'CAJA_PRINCIPAL', cuentaId: cash.cuentaContableId } });
		try {
			const result = await createRequest({ idempotencyKey: `omitted-${unique}`, tipo: 'MENSUAL', fechaInicio: '2098-07-01T00:00:00.000Z', fechaFin: '2098-07-31T23:59:59.000Z',
				lineas: [{ cuentaCodigo: '101', moneda: 'USD', debito: '10', credito: '0' }, { cuentaCodigo: '102', moneda: 'CUP', debito: '5', credito: '0' }, { cuentaCodigo: '301', moneda: 'CUP', debito: '0', credito: '25' }],
				cuentasBancarias: [{ nombreCuenta: 'Inicial', nombreBanco: 'Banco', numeroCuenta: `omitted-${unique}`, tipoCuenta: 'CORRIENTE', moneda: 'USD', saldo: '10', cuentaContableId: bank.cuentaContableId }] } as never);
			expect(result.success).toBe(true);
			if (!result.success) throw new Error(result.error.message);
			expect((await approveRequest({ solicitudId: result.data.solicitudId })).success).toBe(false);
		} finally {
			await prisma.cuentaRolTenant.deleteMany({ where: { tenantId, rol: 'CAJA_PRINCIPAL' } });
			await prisma.cuentaContable.delete({ where: { cuentaContableId: cash.cuentaContableId } });
		}
	});

	it('rejects inventory opening without an operational inventory load', async () => {
		const bank = await prisma.cuentaContable.findFirstOrThrow({ where: { tenantId, codigo: '101' } });
		const inventory = await prisma.cuentaContable.create({ data: { tenantId, codigo: '103', nombre: 'Inventario', tipo: 'ACTIVO', naturaleza: 'DEUDORA' } });
		await prisma.cuentaRolTenant.create({ data: { tenantId, rol: 'INVENTARIOS', cuentaId: inventory.cuentaContableId } });
		try {
			const result = await createRequest({ idempotencyKey: `inventory-${unique}`, tipo: 'MENSUAL', fechaInicio: '2098-08-01T00:00:00.000Z', fechaFin: '2098-08-31T23:59:59.000Z',
				lineas: [{ cuentaCodigo: '101', moneda: 'USD', debito: '10', credito: '0' }, { cuentaCodigo: '103', moneda: 'CUP', debito: '50', credito: '0' }, { cuentaCodigo: '301', moneda: 'CUP', debito: '0', credito: '70' }],
				cuentasBancarias: [{ nombreCuenta: 'Inicial', nombreBanco: 'Banco', numeroCuenta: `inventory-${unique}`, tipoCuenta: 'CORRIENTE', moneda: 'USD', saldo: '10', cuentaContableId: bank.cuentaContableId }] } as never);
			expect(result.success).toBe(true);
			if (!result.success) throw new Error(result.error.message);
			expect((await approveRequest({ solicitudId: result.data.solicitudId })).success).toBe(false);
		} finally {
			await prisma.cuentaRolTenant.deleteMany({ where: { tenantId, rol: 'INVENTARIOS' } });
			await prisma.cuentaContable.delete({ where: { cuentaContableId: inventory.cuentaContableId } });
		}
	});

	it('rejects an unassigned asset line without operational details', async () => {
		const bank = await prisma.cuentaContable.findFirstOrThrow({ where: { tenantId, codigo: '101' } });
		const asset = await prisma.cuentaContable.create({ data: { tenantId, codigo: '104', nombre: 'Activo sin rol', tipo: 'ACTIVO', naturaleza: 'DEUDORA' } });
		try {
			const result = await createRequest({ idempotencyKey: `unassigned-${unique}`, tipo: 'MENSUAL', fechaInicio: '2098-09-01T00:00:00.000Z', fechaFin: '2098-09-30T23:59:59.000Z',
				lineas: [{ cuentaCodigo: '101', moneda: 'USD', debito: '10', credito: '0' }, { cuentaCodigo: '104', moneda: 'CUP', debito: '50', credito: '0' }, { cuentaCodigo: '301', moneda: 'CUP', debito: '0', credito: '70' }],
				cuentasBancarias: [{ nombreCuenta: 'Inicial', nombreBanco: 'Banco', numeroCuenta: `unassigned-${unique}`, tipoCuenta: 'CORRIENTE', moneda: 'USD', saldo: '10', cuentaContableId: bank.cuentaContableId }] } as never);
			expect(result.success).toBe(true);
			if (!result.success) throw new Error(result.error.message);
			expect((await approveRequest({ solicitudId: result.data.solicitudId })).success).toBe(false);
		} finally { await prisma.cuentaContable.delete({ where: { cuentaContableId: asset.cuentaContableId } }); }
	});

	it('rejects bank opening when an existing payable is absent from the opening', async () => {
		const account = await prisma.cuentaContable.findFirstOrThrow({ where: { tenantId, codigo: '101' } });
		const payable = await prisma.cuentaPorPagar.create({ data: { tenantId, numeroFactura: `external-${unique}`,
			tipo: 'compra', montoDeuda: 50, saldoPendiente: 50, moneda: 'CUP' } });
		try {
			const result = await createRequest({ idempotencyKey: `existing-payable-${unique}`, tipo: 'MENSUAL',
				fechaInicio: '2098-09-01T00:00:00.000Z', fechaFin: '2098-09-30T23:59:59.000Z',
				lineas: openingLines(), cuentasBancarias: [{ nombreCuenta: 'Inicial', nombreBanco: 'Banco',
					numeroCuenta: `existing-payable-${unique}`, tipoCuenta: 'CORRIENTE', moneda: 'USD',
					saldo: '10', cuentaContableId: account.cuentaContableId }] } as never);
			expect(result.success).toBe(true);
			if (!result.success) throw new Error(result.error.message);
			const approval = await approveRequest({ solicitudId: result.data.solicitudId });
			expect(approval.success).toBe(false);
			if (!approval.success) expect(approval.error.code).toBe('INICIALIZACION_NO_DISPONIBLE');
			expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(0);
		} finally {
			await prisma.cuentaPorPagar.delete({ where: { cuentaPorPagarId: payable.cuentaPorPagarId } });
		}
	});

	it('rejects a bank request approved before the temporary safety guard', async () => {
		const account = await prisma.cuentaContable.findFirstOrThrow({ where: { tenantId, codigo: '101' } });
		const result = await createRequest({ idempotencyKey: `preapproved-${unique}`, tipo: 'MENSUAL',
			fechaInicio: '2098-10-01T00:00:00.000Z', fechaFin: '2098-10-31T23:59:59.000Z', lineas: openingLines(),
			cuentasBancarias: [{ nombreCuenta: 'Inicial', nombreBanco: 'Banco', numeroCuenta: `preapproved-${unique}`,
				tipoCuenta: 'CORRIENTE', moneda: 'USD', saldo: '10', cuentaContableId: account.cuentaContableId }] } as never);
		expect(result.success).toBe(true);
		if (!result.success) throw new Error(result.error.message);
		const detail = await readRequest({ solicitudId: result.data.solicitudId });
		expect(detail.success).toBe(true);
		if (!detail.success) throw new Error(detail.error.message);
		const request = detail.data.solicitud;
		const approvedAt = new Date();
		const hashAprobacion = hashImmutableFinancialEvidence({
			solicitudId: request.solicitudId, tenantId, solicitedBy: request.solicitadaPor,
			approvedBy: userId, approvedAt: approvedAt.toISOString(), functionalCurrencyCode: request.functionalCurrencyCode,
			fechaInicio: new Date(request.fechaInicio).toISOString(), fechaFin: new Date(request.fechaFin).toISOString(),
			tipo: request.tipo, categoria: request.categoria, modoContable: request.modoContable,
			observaciones: request.observaciones, lineas: request.lineas, cuentasBancarias: request.cuentasBancarias,
			fxFingerprints: request.lineasValuadas.map((line) => line.fxEvidenceFingerprint).filter((value): value is string => value !== null).sort(),
			lineasValuadas: request.lineasValuadas,
		});
		await prisma.aperturaPeriodoSolicitud.update({ where: { solicitudId: request.solicitudId },
			data: { estado: 'APROBADA', aprobadaPor: userId, aprobadaAt: approvedAt, hashAprobacion } });
		const opened = await openApproved({ solicitudId: request.solicitudId });
		expect(opened.success).toBe(false);
		if (!opened.success) expect(opened.error.code).toBe('INICIALIZACION_NO_DISPONIBLE');
		expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(0);
		expect(await prisma.periodoContable.count({ where: { tenantId } })).toBe(0);
		expect(await prisma.asiento.count({ where: { tenantId } })).toBe(0);
	});

	it('keeps consumed no-bank opening requests immutable in PostgreSQL', async () => {
		const request = await prisma.aperturaPeriodoSolicitud.create({ data: {
			tenantId, tipo: 'MENSUAL', fechaInicio: new Date('2098-11-01T00:00:00.000Z'),
			fechaFin: new Date('2098-11-30T23:59:59.000Z'), functionalCurrencyCode: 'CUP', lineas: [],
			estado: 'CONSUMIDA', solicitadaPor: userId, aprobadaPor: userId,
			hashAprobacion: 'a'.repeat(64), aprobadaAt: new Date(), consumidaAt: new Date(),
		} });

		await expect(prisma.aperturaPeriodoSolicitud.update({
			where: { solicitudId: request.solicitudId }, data: { hashAprobacion: 'b'.repeat(64) },
		})).rejects.toThrow('La apertura consumida es inmutable');
		await expect(prisma.aperturaPeriodoSolicitud.delete({
			where: { solicitudId: request.solicitudId },
		})).rejects.toThrow('La apertura consumida es inmutable');
	});

	it.skip('pendiente: opens approved bank balances atomically without invented funding', async () => {
		const account = await prisma.cuentaContable.findFirstOrThrow({ where: { tenantId, codigo: '101' } });
		const result = await createRequest({
			idempotencyKey: `bank-${unique}`, tipo: 'MENSUAL',
			fechaInicio: '2098-02-01T00:00:00.000Z', fechaFin: '2098-02-28T23:59:59.000Z',
			lineas: openingLines(),
			cuentasBancarias: [{ nombreCuenta: 'Inicial', nombreBanco: 'Banco', numeroCuenta: `bank-${unique}`, tipoCuenta: 'CORRIENTE', moneda: 'USD', saldo: '10.00', cuentaContableId: account.cuentaContableId }],
		} as never);
		expect(result.success, JSON.stringify(result)).toBe(true);
		if (!result.success) throw new Error(result.error.message);
		const detail = await readRequest({ solicitudId: result.data.solicitudId });
		expect(detail.success).toBe(true);
		if (detail.success) expect(detail.data.solicitud.cuentasBancarias).toHaveLength(1);
		expect((await approveRequest({ solicitudId: result.data.solicitudId })).success).toBe(true);
		await prisma.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entidad" = 'CIERRE_CONTABLE' AND NEW."detalles"->>'accion' = 'ABRIR_MANUAL' THEN RAISE EXCEPTION 'forced audit rejection'; END IF; RETURN NEW; END $$`);
		await prisma.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`);
		triggerInstalled = true;
		expect((await openApproved({ solicitudId: result.data.solicitudId })).success).toBe(false);
		expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(0);
		expect(await prisma.periodoContable.count({ where: { tenantId } })).toBe(0);
		expect(await prisma.asiento.count({ where: { tenantId } })).toBe(0);
		await prisma.$executeRawUnsafe(`DROP TRIGGER "${triggerName}" ON "AuditLog"`);
		await prisma.$executeRawUnsafe(`DROP FUNCTION "${functionName}"()`);
		triggerInstalled = false;
		const concurrent = await Promise.all([openApproved({ solicitudId: result.data.solicitudId }), openApproved({ solicitudId: result.data.solicitudId })]);
		expect(concurrent.filter((entry) => entry.success)).toHaveLength(2);
		expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(1);
		expect(await prisma.asiento.count({ where: { tenantId } })).toBe(1);
		expect(await prisma.cuentaBancaria.findMany({ where: { tenantId, numeroCuenta: `bank-${unique}` } })).toMatchObject([{ saldo: 10, moneda: 'USD', cuentaContableInicialId: account.cuentaContableId }]);
		expect(await prisma.inyeccionCapital.count({ where: { tenantId } })).toBe(0);
		await prisma.cuentaBancaria.updateMany({ where: { tenantId, numeroCuenta: `bank-${unique}` }, data: { saldo: 5 } });
		const replay = await openApproved({ solicitudId: result.data.solicitudId });
		expect(replay.success).toBe(true);
		expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(1);
		expect(await prisma.asiento.count({ where: { tenantId } })).toBe(1);
		const entry = await prisma.asiento.findFirstOrThrow({ where: { tenantId, origenTipo: 'apertura_manual', origenId: result.data.solicitudId }, include: { lineas: { orderBy: { orden: 'asc' } } } });
		const firstLine = entry.lineas[0];
		await prisma.asientoLinea.update({ where: { lineaId: firstLine.lineaId }, data: { montoOriginal: '11' } });
		expect((await openApproved({ solicitudId: result.data.solicitudId })).success).toBe(false);
		await prisma.asientoLinea.update({ where: { lineaId: firstLine.lineaId }, data: { montoOriginal: firstLine.montoOriginal } });
		await prisma.asientoLinea.update({ where: { lineaId: firstLine.lineaId }, data: { tasaCambio: '3' } });
		expect((await openApproved({ solicitudId: result.data.solicitudId })).success).toBe(false);
		await prisma.asientoLinea.update({ where: { lineaId: firstLine.lineaId }, data: { tasaCambio: firstLine.tasaCambio } });
		await prisma.asientoLinea.update({ where: { lineaId: firstLine.lineaId }, data: { fxEvidenceFingerprint: 'alterado' } });
		expect((await openApproved({ solicitudId: result.data.solicitudId })).success).toBe(false);
		await prisma.asientoLinea.update({ where: { lineaId: firstLine.lineaId }, data: { fxEvidenceFingerprint: firstLine.fxEvidenceFingerprint } });
		multiCurrencyEnabled = false;
		await prisma.cuentaRolTenant.deleteMany({ where: { tenantId, rol: 'BANCOS' } });
		await prisma.moneda.update({ where: { codigo: 'USD' }, data: { isActive: false } });
		try {
			vi.mocked(getCurrentUser).mockResolvedValueOnce({ ...actor(), userId: 'other-authorized-user' });
			expect((await openApproved({ solicitudId: result.data.solicitudId })).success).toBe(true);
		} finally {
			multiCurrencyEnabled = true;
			await prisma.moneda.update({ where: { codigo: 'USD' }, data: { isActive: true } });
			await prisma.cuentaRolTenant.create({ data: { tenantId, rol: 'BANCOS', cuentaId: account.cuentaContableId } });
		}
		await expect(prisma.aperturaPeriodoSolicitud.update({ where: { solicitudId: result.data.solicitudId }, data: { consumoHash: 'alterado' } })).rejects.toThrow();
		await expect(prisma.aperturaPeriodoSolicitud.delete({ where: { solicitudId: result.data.solicitudId } })).rejects.toThrow();
		const equity = await prisma.cuentaContable.findFirstOrThrow({ where: { tenantId, codigo: '301' } });
		await prisma.cuentaBancaria.updateMany({ where: { tenantId, numeroCuenta: `bank-${unique}` }, data: { cuentaContableInicialId: equity.cuentaContableId } });
		expect((await openApproved({ solicitudId: result.data.solicitudId })).success).toBe(false);
	});

});
