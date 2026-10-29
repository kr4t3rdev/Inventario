import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

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

function actor(): AuthenticatedUser {
	return {
		userId,
		name: 'Manual opening integration approver',
		email,
		role: 'user',
		isActive: true,
		tenantId: activeTenantId,
		tenantRole: 'manager',
		planFeatures: { contabilidad: true },
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
			await prisma.aperturaPeriodoSolicitud.deleteMany({ where: { tenantId } });
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

	it('lists and reads across sessions, scopes tenants, rolls back audit failure, and consumes once under concurrency', async () => {
		const requestId = await submitAndApprove('2098-01-01', '2098-01-31');
		const list = await listRequests({});
		expect(list.success).toBe(true);
		if (list.success) expect(list.data.solicitudes.some((row) => row.solicitudId === requestId)).toBe(true);
		const detail = await readRequest({ solicitudId: requestId });
		expect(detail.success).toBe(true);
		if (detail.success) {
			expect(detail.data.solicitud.lineas).toHaveLength(2);
			expect(detail.data.solicitud.lineasValuadas[0]).toMatchObject({
				debitoFuncional: '20', tasaCambio: '2', monedaFuncional: 'CUP',
				fxEvidence: { sourceType: 'MANUAL_OPENING_LINE', source: 'TasaCambio catalog', provenance: 'MANUAL_GOVERNED', fxCatalogRateId: rateId, evidenceVersion: 1 },
			});
			expect(detail.data.solicitud.lineasValuadas[0].fxEvidence.evidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
			expect(detail.data.solicitud.lineasValuadas[0].fxEvidence.sourceId).toMatch(new RegExp(`^${requestId}:line-1:`));
		}

		activeTenantId = otherTenantId;
		const isolatedList = await listRequests({});
		expect(isolatedList.success).toBe(true);
		if (isolatedList.success) expect(isolatedList.data.solicitudes).toHaveLength(0);
		const isolatedDetail = await readRequest({ solicitudId: requestId });
		expect(isolatedDetail.success).toBe(false);
		activeTenantId = tenantId;

		await prisma.$executeRawUnsafe(`
			CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN
				IF NEW."entidad" = 'CIERRE_CONTABLE' AND NEW."detalles"->>'accion' = 'ABRIR_MANUAL' THEN
					RAISE EXCEPTION 'forced manual opening audit rejection' USING ERRCODE = '22012';
				END IF;
				RETURN NEW;
			END $$
		`);
		await prisma.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`);
		triggerInstalled = true;
		const before = {
			periods: await prisma.periodoContable.count({ where: { tenantId } }),
			openings: await prisma.aperturaPeriodo.count({ where: { tenantId } }),
			journals: await prisma.asiento.count({ where: { tenantId } }),
		};
		const rollback = await openApproved({ solicitudId: requestId });
		expect(rollback.success).toBe(false);
		expect(await prisma.periodoContable.count({ where: { tenantId } })).toBe(before.periods);
		expect(await prisma.aperturaPeriodo.count({ where: { tenantId } })).toBe(before.openings);
		expect(await prisma.asiento.count({ where: { tenantId } })).toBe(before.journals);
		expect((await prisma.aperturaPeriodoSolicitud.findUnique({ where: { solicitudId: requestId } }))?.estado).toBe('APROBADA');
		await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "AuditLog"`);
		await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
		triggerInstalled = false;

		const concurrent = await Promise.all([
			openApproved({ solicitudId: requestId }),
			openApproved({ solicitudId: requestId }),
		]);
		expect(concurrent.filter((result) => result.success)).toHaveLength(1);
		expect(await prisma.periodoContable.count({ where: { tenantId } })).toBe(before.periods + 1);
		expect(await prisma.aperturaPeriodo.count({ where: { tenantId } })).toBe(before.openings + 1);
		expect(await prisma.asiento.count({ where: { tenantId } })).toBe(before.journals + 1);
		const opening = await prisma.aperturaPeriodo.findFirst({ where: { tenantId }, include: { periodo: true } });
		expect(opening?.saldoCajaInicial).toBeNull();
		expect(opening?.saldoCapitalInicial).toBeNull();
		expect(opening?.detalleJson).toMatchObject({ origen: 'CUADRE_MANUAL_APROBADO' });
		const valuedLines = (opening?.detalleJson as { lineas: Array<Record<string, string | null>> }).lineas;
		expect(valuedLines).toHaveLength(2);
		expect(valuedLines[0]).toMatchObject({ moneda: 'USD', debitoFuncional: '20' });
		const journal = await prisma.asiento.findFirst({ where: { tenantId, origenTipo: 'apertura_manual', origenId: requestId }, include: { lineas: { orderBy: { orden: 'asc' } } } });
		expect(journal?.lineas).toHaveLength(2);
		expect(journal?.lineas.map((line) => [line.debe.toString(), line.haber.toString()])).toEqual([['20', '0'], ['0', '20']]);
	});

	it('deduplicates concurrent retries by tenant, requester, key, and immutable payload hash', async () => {
		const payload = {
			idempotencyKey: `${slug}-idempotency`,
			tipo: 'MENSUAL' as never,
			fechaInicio: '2099-02-01T00:00:00.000Z',
			fechaFin: '2099-02-28T23:59:59.000Z',
			lineas: openingLines(),
		};
		const [first, retry] = await Promise.all([createRequest(payload), createRequest(payload)]);
		expect(first.success, JSON.stringify(first)).toBe(true);
		expect(retry.success, JSON.stringify(retry)).toBe(true);
		if (!first.success || !retry.success) return;
		expect(retry.data.solicitudId).toBe(first.data.solicitudId);
		expect([first.data.replayed, retry.data.replayed].sort()).toEqual([false, true]);
		expect(await prisma.aperturaPeriodoSolicitud.count({
			where: { tenantId, solicitadaPor: userId, idempotencyKey: payload.idempotencyKey },
		})).toBe(1);
	});

	it('rolls back a request when no eligible tenant-functional catalog rate exists', async () => {
		const beforeRequests = await prisma.aperturaPeriodoSolicitud.count({ where: { tenantId } });
		const beforeEvidence = await prisma.fxEvidence.count({ where: { tenantId, sourceType: 'MANUAL_OPENING_LINE' } });
		const result = await createRequest({
			idempotencyKey: `${slug}-missing-rate`, tipo: 'MENSUAL' as never,
			fechaInicio: '2099-03-01T00:00:00.000Z', fechaFin: '2099-03-31T23:59:59.000Z',
			lineas: [
				{ cuentaCodigo: '101', moneda: 'EUR', debito: '10', credito: '0' },
				{ cuentaCodigo: '301', moneda: 'CUP', debito: '0', credito: '10' },
			],
		});
		expect(result.success).toBe(false);
		expect(await prisma.aperturaPeriodoSolicitud.count({ where: { tenantId } })).toBe(beforeRequests);
		expect(await prisma.fxEvidence.count({ where: { tenantId, sourceType: 'MANUAL_OPENING_LINE' } })).toBe(beforeEvidence);
	});

	it('serializes distinct overlapping approved requests so only one opens', async () => {
		const first = await submitAndApprove('2099-04-01', '2099-05-15');
		const second = await submitAndApprove('2099-05-01', '2099-05-31');
		const beforePeriods = await prisma.periodoContable.count({ where: { tenantId } });
		await prisma.$executeRawUnsafe(`
			CREATE FUNCTION "${overlapFunctionName}"() RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN
				IF NEW."tenantId" = '${tenantId}' AND NEW."codigo" IN ('M-2099-04', 'M-2099-05') THEN
					PERFORM pg_sleep(0.4);
				END IF;
				RETURN NEW;
			END $$
		`);
		await prisma.$executeRawUnsafe(`CREATE TRIGGER "${overlapTriggerName}" BEFORE INSERT ON "periodos_contables" FOR EACH ROW EXECUTE FUNCTION "${overlapFunctionName}"()`);
		let results!: Awaited<ReturnType<typeof openApproved>>[];
		try {
			results = await Promise.all([
				openApproved({ solicitudId: first }),
				openApproved({ solicitudId: second }),
			]);
		} finally {
			await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${overlapTriggerName}" ON "periodos_contables"`);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${overlapFunctionName}"()`);
		}
		expect(results.filter((result) => result.success)).toHaveLength(1);
		expect(results.find((result) => !result.success)?.error?.code).toBe('PERIODO_SOLAPADO');
		expect(await prisma.periodoContable.count({ where: { tenantId } })).toBe(beforePeriods + 1);
		const states = await prisma.aperturaPeriodoSolicitud.findMany({
			where: { solicitudId: { in: [first, second] } }, select: { estado: true },
		});
		expect(states.filter((row) => row.estado === 'CONSUMIDA')).toHaveLength(1);
	});
});
