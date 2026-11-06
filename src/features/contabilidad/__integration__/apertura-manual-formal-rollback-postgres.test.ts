/**
 * @description Test de integración real del rollback físico formal de la
 * apertura contable manual aprobada (R6.1, familia de apertura).
 *
 * Abrir un período con cuadre manual aprobado es la única vía vigente de
 * apertura con saldos iniciales verificados: una sola transacción crea el
 * período, su auditoría de timeline, el asiento formal de apertura en el
 * libro mayor, el registro de apertura, consume la aprobación y escribe la
 * auditoría de la operación.
 *
 * El test comprueba, contra PostgreSQL desechable, que si falla la escritura
 * del asiento en el libro formal, **nada** queda a medias: ni el período, ni
 * su auditoría, ni el asiento ni sus líneas, ni el registro de apertura, ni el
 * consumo de la aprobación, ni la auditoría de la operación. La solicitud
 * sigue aprobada y puede abrir el período después, sin residuos ni números de
 * asiento consumidos.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import {
	assertDisposableDatabase,
	assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let prisma!: typeof import('@/lib/prisma').prisma;
let solicitarApertura!: typeof import('@/features/contabilidad/actions-periodos').solicitarAperturaManualAction;
let aprobarApertura!: typeof import('@/features/contabilidad/actions-periodos').aprobarAperturaManualAction;
let abrirAprobado!: typeof import('@/features/contabilidad/actions-periodos').abrirPeriodoManualAprobadoAction;

const unique = randomUUID().replaceAll('-', '');
const slug = `apertura-formal-rb-${unique.slice(0, 12)}`;
const email = `${slug}@test.local`;
let tenantId = '';
let planId = '';
let licenseId = '';
let approverUserId = '';
const failUserId = `formal_ledger_fail_${unique.slice(0, 16)}`;
let rateId = '';
const failpointFunction = `formal_apertura_ledger_failure_${unique.slice(0, 12)}`;
const failpointTrigger = `formal_apertura_ledger_trigger_${unique.slice(0, 12)}`;
let activeUserId = '';
let currencyCreated = false;
let usdCreated = false;
let triggerInstalled = false;
let solicitudAprobadaId = '';

/**
 * @description Construye el responsable autenticado de la apertura.
 * @returns {AuthenticatedUser} Actor con permiso de aprobación de aperturas.
 */
function actor(): AuthenticatedUser {
	return {
		userId: activeUserId,
		name: 'Apertura formal integration actor',
		email,
		role: 'user',
		isActive: true,
		tenantId,
		tenantRole: 'manager',
		planFeatures: { contabilidad: true },
		permissions: new Set(['financiero.apertura.aprobar']),
	};
}

/**
 * @description Líneas del cuadre manual: 10 USD valorados a 20 CUP.
 * @returns {Array<object>} Líneas de débito y crédito del período.
 */
function openingLines() {
	return [
		{ cuentaCodigo: '101', moneda: 'USD', debito: '10.00', credito: '0' },
		{ cuentaCodigo: '301', moneda: 'CUP', debito: '0', credito: '20.00' },
	];
}

/**
 * @description Solicita y aprueba una apertura manual para el período dado.
 * @param {string} inicio - Fecha inicial del período.
 * @param {string} fin - Fecha final del período.
 * @returns {Promise<string>} Identificador de la solicitud aprobada.
 */
async function submitAndApprove(inicio: string, fin: string): Promise<string> {
	activeUserId = approverUserId;
	const request = await solicitarApertura({
		idempotencyKey: `apertura-rb-${unique.slice(0, 8)}-${inicio}`,
		tipo: 'MENSUAL' as never,
		fechaInicio: new Date(`${inicio}T00:00:00.000Z`).toISOString(),
		fechaFin: new Date(`${fin}T23:59:59.000Z`).toISOString(),
		lineas: openingLines(),
	});
	expect(request.success, JSON.stringify(request)).toBe(true);
	if (!request.success) throw new Error(request.error.message);
	const approval = await aprobarApertura({ solicitudId: request.data.solicitudId });
	expect(approval.success, JSON.stringify(approval)).toBe(true);
	if (!approval.success) throw new Error(approval.error.message);
	return request.data.solicitudId;
}

/**
 * @description Fotografía del estado persistido del tenant alrededor de la
 * apertura: lo que la transacción de apertura escribe y lo que consume.
 * @returns {Promise<object>} Conteos y estado de la solicitud observada.
 */
async function readSnapshot(solicitudId: string) {
	const [periodos, auditorias, asientos, lineas, aperturas, solicitudes, auditoriasOperacion] =
		await Promise.all([
			prisma.periodoContable.count({ where: { tenantId } }),
			prisma.auditoriaPeriodo.count({ where: { tenantId } }),
			prisma.asiento.count({ where: { tenantId } }),
			prisma.asientoLinea.count({ where: { tenantId } }),
			prisma.aperturaPeriodo.count({ where: { tenantId } }),
			prisma.aperturaPeriodoSolicitud.findUnique({
				where: { solicitudId },
				select: { estado: true, consumidaAt: true, periodoId: true },
			}),
			prisma.auditLog.count({ where: { usuarioId: failUserId } }),
		]);
	return {
		periodos,
		auditorias,
		asientos,
		lineas,
		aperturas,
		solicitud: solicitudes,
		auditoriasOperacion,
	};
}

describe('apertura contable manual — rollback fisico formal en PostgreSQL aislado', { timeout: 120_000 }, () => {
	beforeAll(async () => {
		const [prismaModule, actions] = await Promise.all([
			import('@/lib/prisma'),
			import('@/features/contabilidad/actions-periodos'),
		]);
		prisma = prismaModule.prisma;
		solicitarApertura = actions.solicitarAperturaManualAction;
		aprobarApertura = actions.aprobarAperturaManualAction;
		abrirAprobado = actions.abrirPeriodoManualAprobadoAction;

		const identity = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
			SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
		`;
		expect(identity).toHaveLength(1);
		assertDisposableDatabaseIdentity(identity[0], process.env);

		if (!(await prisma.moneda.findUnique({ where: { codigo: 'CUP' } }))) {
			await prisma.moneda.create({ data: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' } });
			currencyCreated = true;
		}
		if (!(await prisma.moneda.findUnique({ where: { codigo: 'USD' } }))) {
			await prisma.moneda.create({ data: { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'USD' } });
			usdCreated = true;
		}
		const rate = await prisma.tasaCambio.create({
			data: {
				monedaOrigenId: 'USD',
				monedaDestino: 'CUP',
				tasa: '2',
				// Vigente en el momento de la captura de la evidencia FX.
				fechaVigencia: new Date('2026-10-28T00:00:00.000Z'),
			},
		});
		rateId = rate.tasaId;

		const plan = await prisma.plan.create({
			data: { nombre: slug, duracionDias: 365, features: { contabilidad: true } },
		});
		planId = plan.planId;
		const tenant = await prisma.tenant.create({ data: { nombre: slug, slug } });
		tenantId = tenant.tenantId;
		const license = await prisma.tenantLicense.create({
			data: { tenantId: tenant.tenantId, planId, expiracion: new Date('2099-01-01') },
		});
		licenseId = license.tenantLicenseId;

		const approver = await prisma.user.create({
			data: { name: 'Apertura formal integration approver', email, password: 'integration-only-placeholder' },
		});
		approverUserId = approver.userId;
		// El actor del failpoint existe como usuario real: la auditoría de la
		// apertura lo referencia por clave foránea.
		await prisma.user.create({
			data: {
				name: 'Apertura formal failpoint actor',
				email: `fail-${email}`,
				password: 'integration-only-placeholder',
				userId: failUserId,
			},
		});
		await prisma.tenantAccountingPolicy.create({
			data: { tenantId: tenant.tenantId, functionalCurrencyCode: 'CUP', updatedBy: approver.userId },
		});
		await prisma.cuentaContable.createMany({
			data: [
				{ tenantId: tenant.tenantId, codigo: '101', nombre: 'Caja', tipo: 'ACTIVO', naturaleza: 'DEUDORA' },
				{ tenantId: tenant.tenantId, codigo: '301', nombre: 'Capital', tipo: 'PATRIMONIO', naturaleza: 'ACREEDORA' },
			],
		});
		await prisma.diario.create({
			data: {
				tenantId: tenant.tenantId,
				tipo: 'APERTURA_CIERRE',
				codigo: `AP-${unique.slice(0, 8)}`,
				nombre: 'Apertura y cierre',
			},
		});
		activeUserId = approver.userId;
		vi.mocked(getCurrentUser).mockImplementation(async () => actor());
	}, 120_000);

	afterAll(async () => {
		if (!prisma) return;
		if (triggerInstalled) {
			await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${failpointTrigger}" ON public."asientos"`);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${failpointFunction}"()`);
		}
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
		await prisma.auditLog.deleteMany({ where: { usuarioId: { in: [approverUserId, failUserId] } } });
		await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
		await prisma.diario.deleteMany({ where: { tenantId } });
		await prisma.cuentaContable.deleteMany({ where: { tenantId } });
		await prisma.tenantLicense.deleteMany({ where: { tenantId } });
		await prisma.tenant.deleteMany({ where: { tenantId } });
		await prisma.plan.deleteMany({ where: { planId } });
		await prisma.user.deleteMany({ where: { userId: { in: [approverUserId, failUserId] } } });
		await prisma.tasaCambio.deleteMany({ where: { tasaId: rateId } });
		if (currencyCreated) await prisma.moneda.deleteMany({ where: { codigo: 'CUP' } });
		if (usdCreated) await prisma.moneda.deleteMany({ where: { codigo: 'USD' } });
		await prisma.$disconnect();
	}, 120_000);

	it('revierte el periodo, el asiento, la apertura y el consumo de la aprobacion cuando falla el insert del asiento', async () => {
		const solicitudId = await submitAndApprove('2097-06-01', '2097-06-30');
		solicitudAprobadaId = solicitudId;
		const before = await readSnapshot(solicitudId);

		// Failpoint fisico: el trigger aborta la escritura del asiento de
		// apertura en el libro formal, que ocurre en el medio de la transaccion
		// de apertura (despues de crear el periodo y antes de consumir la
		// aprobacion y escribir la auditoria).
		await prisma.$executeRawUnsafe(`
			CREATE FUNCTION public."${failpointFunction}"() RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN
				IF NEW."tenantId" = '${tenantId}' AND NEW."origenTipo" = 'apertura_manual' THEN
					RAISE EXCEPTION 'forced apertura asiento failure' USING ERRCODE = '23514';
				END IF;
				RETURN NEW;
			END $$
		`);
		await prisma.$executeRawUnsafe(
			`CREATE TRIGGER "${failpointTrigger}" BEFORE INSERT ON public."asientos" FOR EACH ROW EXECUTE FUNCTION public."${failpointFunction}"()`,
		);
		triggerInstalled = true;

		activeUserId = failUserId;
		try {
			const resultado = await abrirAprobado({ solicitudId });
			expect(resultado.success).toBe(false);

			const after = await readSnapshot(solicitudId);
			// Nada de la apertura quedo persistido: ni el periodo, ni su
			// auditoria, ni el asiento, ni el registro de apertura.
			expect(after.periodos).toBe(before.periodos);
			expect(after.auditorias).toBe(before.auditorias);
			expect(after.asientos).toBe(before.asientos);
			expect(after.lineas).toBe(before.lineas);
			expect(after.aperturas).toBe(before.aperturas);
			// La aprobacion no se consumio y la auditoria de la operacion no se
			// escribio.
			expect(after.solicitud?.estado).toBe('APROBADA');
			expect(after.solicitud?.consumidaAt).toBeNull();
			expect(after.solicitud?.periodoId).toBeNull();
			expect(after.auditoriasOperacion).toBe(before.auditoriasOperacion);
		} finally {
			await prisma.$executeRawUnsafe(
				`DROP TRIGGER IF EXISTS "${failpointTrigger}" ON public."asientos"`,
			);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${failpointFunction}"()`);
			triggerInstalled = false;
		}
	});

	it('abre el periodo tras el rollback sin residuos ni numeros de asiento consumidos', async () => {
		// Se reintenta la **misma** aprobacion que fallo: el rollback no la
		// consumio ni dejo residuos que impidan abrir el periodo.
		const solicitudId = solicitudAprobadaId;
		expect(solicitudId).toBeTruthy();
		const before = await readSnapshot(solicitudId);
		activeUserId = failUserId;

		const resultado = await abrirAprobado({ solicitudId });
		expect(resultado.success, JSON.stringify(resultado)).toBe(true);

		const after = await readSnapshot(solicitudId);
		expect(after.periodos).toBe(before.periodos + 1);
		expect(after.asientos).toBe(before.asientos + 1);
		expect(after.lineas).toBe(before.lineas + 2);
		expect(after.aperturas).toBe(before.aperturas + 1);
		expect(after.solicitud?.estado).toBe('CONSUMIDA');
		expect(after.solicitud?.periodoId).toBeTruthy();
		expect(after.auditoriasOperacion).toBe(before.auditoriasOperacion + 1);

		const asiento = await prisma.asiento.findFirst({
			where: { tenantId, origenTipo: 'apertura_manual', origenId: solicitudId },
			include: { lineas: { orderBy: { orden: 'asc' } } },
		});
		expect(asiento).not.toBeNull();
		expect(asiento?.numero).toBe(1);
		expect(asiento?.hashAnterior).toBeNull();
		expect(asiento?.lineas).toHaveLength(2);
		expect(asiento?.lineas.map((line) => [line.debe.toString(), line.haber.toString()])).toEqual([
			['20', '0'],
			['0', '20'],
		]);
		const apertura = await prisma.aperturaPeriodo.findFirst({ where: { tenantId } });
		expect(apertura?.detalleJson).toMatchObject({ origen: 'CUADRE_MANUAL_APROBADO' });
	});
});
