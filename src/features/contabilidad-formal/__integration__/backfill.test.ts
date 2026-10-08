/**
 * @description Verifies the authorized historical replay lifecycle against PostgreSQL.
 * This suite requires an explicitly configured local disposable `tcp_test_*` database.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import {
	seedPlanContable,
	seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import {
	aprobarPreflightBackfill,
	crearPreflightBackfill,
	ejecutarBackfillAutorizado,
} from '@/features/contabilidad-formal/services/replay-backfill-service';

const DISPOSABLE_DATABASE_URL =
	process.env.DATABASE_URL ?? '';
const FECHA_INICIO = new Date('2025-03-01T00:00:00.000Z');
const FECHA_FIN = new Date('2025-03-31T23:59:59.999Z');

interface Fixture {
	tenantId: string;
	requesterId: string;
	approverId: string;
	inactiveApproverId: string;
	periodoId: string;
	accountId: string;
	tipoPagoId: string;
	sourceIds: string[];
}

const fixtures: Fixture[] = [];
const sqlObjects: Array<{ trigger: string; fn: string; table?: string }> = [];
let createdCurrency = false;

/** @description Validates the integration database is an explicitly allowed local disposable target. */
function assertDisposableTarget(): URL {
	expect(process.env.ALLOW_DISPOSABLE_TEST_DB).toBe('1');
	expect(process.env.DATABASE_URL).toBe(DISPOSABLE_DATABASE_URL);
	expect(process.env.DATABASE_URL_TEST).toBe(DISPOSABLE_DATABASE_URL);
	expect(process.env.DIRECT_URL).toBe(DISPOSABLE_DATABASE_URL);
	const url = new URL(DISPOSABLE_DATABASE_URL);
	expect(['postgres:', 'postgresql:']).toContain(url.protocol);
	expect(['127.0.0.1', 'localhost', '[::1]']).toContain(url.hostname);
	expect(url.pathname).toMatch(/^\/tcp_test_[a-z0-9_]+$/);
	expect(url.port).not.toBe('');
	expect(url.search).toBe('');
	expect(url.hash).toBe('');
	return url;
}

/** @description Creates isolated accounting replay fixtures for a single tenant. */
async function createFixture(label: string, sourceCount = 1): Promise<Fixture> {
	const suffix = `${label}-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
	const tenant = await prisma.tenant.create({
		data: { nombre: `Replay R5 ${label}`, slug: `replay-r5-${suffix}` },
	});
	const fixture: Fixture = {
		tenantId: tenant.tenantId,
		requesterId: '',
		approverId: '',
		inactiveApproverId: '',
		periodoId: '',
		accountId: '',
		tipoPagoId: '',
		sourceIds: [],
	};
	fixtures.push(fixture);
	const [requester, approver, inactiveApprover] = await Promise.all([
		prisma.user.create({
			data: {
				name: `Replay requester ${suffix}`,
				email: `replay-requester-${suffix}@test.invalid`,
				password: 'hashed-password-for-integration-test',
			},
		}),
		prisma.user.create({
			data: {
				name: `Replay approver ${suffix}`,
				email: `replay-approver-${suffix}@test.invalid`,
				password: 'hashed-password-for-integration-test',
			},
		}),
		prisma.user.create({
			data: {
				name: `Replay inactive approver ${suffix}`,
				email: `replay-inactive-${suffix}@test.invalid`,
				password: 'hashed-password-for-integration-test',
			},
		}),
	]);
	fixture.requesterId = requester.userId;
	fixture.approverId = approver.userId;
	fixture.inactiveApproverId = inactiveApprover.userId;
	await prisma.tenantMembership.createMany({
		data: [
			{ tenantId: tenant.tenantId, userId: requester.userId, tenantRole: 'manager' },
			{ tenantId: tenant.tenantId, userId: approver.userId, tenantRole: 'manager' },
			{
				tenantId: tenant.tenantId,
				userId: inactiveApprover.userId,
				tenantRole: 'manager',
				isActive: false,
			},
		],
	});
	await prisma.tenantLicense.create({
		data: {
			tenantId: tenant.tenantId,
			activa: true,
			expiracion: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
			features: { 'contabilidad-formal': true },
		},
	});
	await prisma.tenantAccountingPolicy.create({
		data: {
			tenantId: tenant.tenantId,
			functionalCurrencyCode: 'CUP',
			updatedBy: requester.userId,
		},
	});
	await prisma.$transaction(async (tx) => {
		await seedPlanContable(tx, tenant.tenantId);
	});
	const account = await prisma.cuentaBancaria.create({
		data: {
			tenantId: tenant.tenantId,
			nombreBanco: `Replay bank ${suffix}`,
			numeroCuenta: `R5-${suffix}`,
			tipoCuenta: 'AHORROS',
			moneda: 'CUP',
			saldo: 0,
		},
	});
	fixture.accountId = account.cuentaId;
	const tipoPago = await prisma.tipoPago.create({
		data: {
			tenantId: tenant.tenantId,
			nombre: `Replay cash ${suffix}`,
			descripcion: 'R5 integration fixture',
			isActive: true,
		},
	});
	fixture.tipoPagoId = tipoPago.tipoId;
	const periodo = await prisma.periodoContable.create({
		data: {
			tenantId: tenant.tenantId,
			tipo: 'MENSUAL',
			estado: 'APROBADO',
			codigo: `R5-${suffix}`,
			fechaInicio: FECHA_INICIO,
			fechaFin: FECHA_FIN,
		},
	});
	fixture.periodoId = periodo.periodoId;
	for (let index = 0; index < sourceCount; index += 1) {
		const source = await prisma.reconciliacionVenta.create({
			data: {
				tenantId: tenant.tenantId,
				cuentaId: account.cuentaId,
				tipoPagoId: tipoPago.tipoId,
				monto: 100 + index,
				moneda: 'CUP',
				montoConvertido: 100 + index,
				fechaReconciliacion: new Date(`2025-03-${String(10 + index).padStart(2, '0')}T12:00:00.000Z`),
				reconciliadoPor: requester.userId,
			},
		});
		fixture.sourceIds.push(source.reconciliacionId);
	}
	return fixture;
}

/** @description Removes only rows created by this test fixture. */
async function removeFixture(fixture: Fixture): Promise<void> {
	await prisma.ajusteBancario.deleteMany({ where: { tenantId: fixture.tenantId } });
	await prisma.asiento.deleteMany({ where: { tenantId: fixture.tenantId } });
	await prisma.replayRun.deleteMany({ where: { tenantId: fixture.tenantId } });
	await prisma.replayApproval.deleteMany({ where: { tenantId: fixture.tenantId } });
	await prisma.replayPreflight.deleteMany({ where: { tenantId: fixture.tenantId } });
	await prisma.reconciliacionVenta.deleteMany({ where: { tenantId: fixture.tenantId } });
	await prisma.periodoContable.deleteMany({ where: { tenantId: fixture.tenantId } });
	await prisma.cuentaRolTenant.deleteMany({ where: { tenantId: fixture.tenantId } });
	await prisma.cuentaContable.deleteMany({ where: { tenantId: fixture.tenantId } });
	await prisma.diario.deleteMany({ where: { tenantId: fixture.tenantId } });
	await prisma.tipoPago.deleteMany({ where: { tenantId: fixture.tenantId } });
	await prisma.cuentaBancaria.deleteMany({ where: { tenantId: fixture.tenantId } });
	await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId: fixture.tenantId } });
	const userIds = [fixture.requesterId, fixture.approverId, fixture.inactiveApproverId].filter(Boolean);
	await prisma.tenant.delete({ where: { tenantId: fixture.tenantId } });
	await prisma.user.deleteMany({ where: { userId: { in: userIds } } });
}

/** @description Produces a ready preflight and independent active-manager approval. */
async function createApprovedPreflight(fixture: Fixture) {
	const preflight = await crearPreflightBackfill(
		fixture.tenantId,
		fixture.periodoId,
		fixture.requesterId,
	);
	const approval = await aprobarPreflightBackfill(
		fixture.tenantId,
		preflight.replayPreflightId,
		fixture.approverId,
	);
	return { preflight, approval };
}

describe('authorized replay lifecycle — disposable PostgreSQL', { timeout: 120_000 }, () => {
	it('creates a preflight while acquiring the period lock', async () => {
		const fixture = await createFixture('period-lock');
		await expect(
			crearPreflightBackfill(
				fixture.tenantId,
				fixture.periodoId,
				fixture.requesterId,
			),
		).resolves.toBeDefined();
	});
	 beforeAll(async () => {
		const databaseUrl = assertDisposableTarget();
		const identity = await prisma.$queryRaw<Array<{
			database: string;
			address: string;
			port: number;
		}>>`SELECT current_database() AS database, inet_server_addr()::text AS address,
			inet_server_port() AS port`;
		expect(identity).toHaveLength(1);
		expect(identity[0]?.database).toBe(databaseUrl.pathname.slice(1));
		expect(identity[0]?.address).toMatch(/^(127\.0\.0\.1\/32|::1\/128|127\.0\.0\.1|::1)$/);
		expect(identity[0]?.port).toBe(Number(databaseUrl.port));
		const sourceColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
			SELECT column_name FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'ReconciliacionVenta'
		`;
		const presentColumns = new Set(sourceColumns.map((column) => column.column_name));
		const requiredColumns = ['deudaCashId', 'prestamoCashId', 'tipoReconciliacion'];
		const missingColumns = requiredColumns.filter((column) => !presentColumns.has(column));
		if (missingColumns.length > 0) {
			throw new Error(
				`Disposable DB schema is behind the generated Prisma contract; missing ReconciliacionVenta columns: ${missingColumns.join(', ')}`,
			);
		}

		const currency = await prisma.moneda.findUnique({ where: { codigo: 'CUP' } });
		if (!currency) {
			await prisma.moneda.create({
				data: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP', esPrincipal: true },
			});
			createdCurrency = true;
		}
		await prisma.$transaction(async (tx) => {
			await seedPlantillasGlobales(tx);
		});
	}, 60_000);

	afterEach(async () => {
		for (const fixture of fixtures.splice(0)) await removeFixture(fixture);
	});

	afterAll(async () => {
		for (const object of sqlObjects.splice(0)) {
			await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${object.trigger}" ON "${object.table ?? 'asientos'}"`);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${object.fn}"()`);
		}
		if (createdCurrency) {
			await prisma.moneda.delete({ where: { codigo: 'CUP' } }).catch(() => undefined);
		}
	});

	it('scopes preflight by tenant and requires a distinct active manager with unchanged source digest', async () => {
		const requesterTenant = await createFixture('scope-requester');
		const otherTenant = await createFixture('scope-other');
		const preflight = await crearPreflightBackfill(
			requesterTenant.tenantId,
			requesterTenant.periodoId,
			requesterTenant.requesterId,
		);

		await expect(
			aprobarPreflightBackfill(
				requesterTenant.tenantId,
				preflight.replayPreflightId,
				requesterTenant.requesterId,
			),
		).rejects.toThrow('La aprobación debe ser independiente');
		await expect(
			aprobarPreflightBackfill(
				requesterTenant.tenantId,
				preflight.replayPreflightId,
				requesterTenant.inactiveApproverId,
			),
		).rejects.toThrow('membresía activa');
		await expect(
			aprobarPreflightBackfill(
				otherTenant.tenantId,
				preflight.replayPreflightId,
				otherTenant.approverId,
			),
		).rejects.toThrow('Preflight no encontrado');

		await prisma.reconciliacionVenta.update({
			where: { reconciliacionId: requesterTenant.sourceIds[0] },
			data: { monto: 125, montoConvertido: 125 },
		});
		await expect(
			aprobarPreflightBackfill(
				requesterTenant.tenantId,
				preflight.replayPreflightId,
				requesterTenant.approverId,
			),
		).rejects.toThrow('Las fuentes cambiaron antes de aprobar el preflight');
	});

	it('enforces self-approval and the exact 24-hour preflight lifetime in PostgreSQL', async () => {
		const fixture = await createFixture('sql-checks');
		const preflight = await crearPreflightBackfill(
			fixture.tenantId,
			fixture.periodoId,
			fixture.requesterId,
		);
		const snapshot = await prisma.replayPreflight.findUniqueOrThrow({
			where: { replayPreflightId: preflight.replayPreflightId },
		});

		await expect(prisma.replayApproval.create({
			data: {
				tenantId: fixture.tenantId,
				replayPreflightId: snapshot.replayPreflightId,
				requestedByUserId: snapshot.requestedByUserId,
				approvedByUserId: snapshot.requestedByUserId,
				digestVersion: snapshot.digestVersion,
				digest: snapshot.digest,
			},
		})).rejects.toMatchObject({
			message: expect.stringContaining(
				'code: "23514", message: "new row for relation \\"contabilidad_replay_approvals\\" violates check constraint \\"contab_replay_approval_different_actor_check\\"',
			),
		});
		await expect(prisma.replayApproval.create({
			data: {
				tenantId: fixture.tenantId,
				replayPreflightId: snapshot.replayPreflightId,
				requestedByUserId: snapshot.requestedByUserId,
				approvedByUserId: fixture.approverId,
				digestVersion: snapshot.digestVersion,
				digest: snapshot.digest,
			},
		})).resolves.toMatchObject({ status: 'APPROVED' });

		await expect(prisma.replayPreflight.update({
			where: { replayPreflightId: snapshot.replayPreflightId },
			data: { expiresAt: new Date(snapshot.expiresAt.getTime() + 1) },
		})).rejects.toMatchObject({
			message: expect.stringContaining(
				'code: "23514", message: "new row for relation \\"contabilidad_replay_preflights\\" violates check constraint \\"contab_replay_preflight_24h_expiry_check\\"',
			),
		});
	});

	it('enforces approval/run tenant and digest bindings at the database boundary', async () => {
		const fixture = await createFixture('sql-binding');
		const otherTenant = await createFixture('sql-binding-other');
		const { preflight, approval } = await createApprovedPreflight(fixture);
		const approvalRow = await prisma.replayApproval.findUniqueOrThrow({
			where: { replayApprovalId: approval.replayApprovalId },
		});

		await expect(prisma.replayApproval.create({
			data: {
				tenantId: otherTenant.tenantId,
				replayPreflightId: preflight.replayPreflightId,
				requestedByUserId: fixture.requesterId,
				approvedByUserId: fixture.approverId,
				digestVersion: approvalRow.digestVersion,
				digest: approvalRow.digest,
			},
		})).rejects.toMatchObject({
			code: 'P2003',
			meta: { constraint: 'contabilidad_replay_approvals_tenantId_replayPreflightId_r_fkey' },
		});

		await expect(prisma.replayRun.create({
			data: {
				tenantId: fixture.tenantId,
				replayPreflightId: preflight.replayPreflightId,
				replayApprovalId: approval.replayApprovalId,
				startedByUserId: fixture.approverId,
				digestVersion: approvalRow.digestVersion,
				digest: `${approvalRow.digest}-mismatch`,
			},
		})).rejects.toMatchObject({
			code: 'P2003',
			meta: {
				constraint: 'contabilidad_replay_runs_tenantId_replayPreflightId_replay_fkey',
			},
		});
	});

	it('rejects assigning an asiento to a replay run owned by another tenant', async () => {
		const first = await createFixture('sql-lineage-a');
		const second = await createFixture('sql-lineage-b');
		const firstApproval = await createApprovedPreflight(first);
		const secondApproval = await createApprovedPreflight(second);
		const firstOutcome = await ejecutarBackfillAutorizado({
			tenantId: first.tenantId,
			replayPreflightId: firstApproval.preflight.replayPreflightId,
			replayApprovalId: firstApproval.approval.replayApprovalId,
			actorId: first.approverId,
		});
		const secondOutcome = await ejecutarBackfillAutorizado({
			tenantId: second.tenantId,
			replayPreflightId: secondApproval.preflight.replayPreflightId,
			replayApprovalId: secondApproval.approval.replayApprovalId,
			actorId: second.approverId,
		});
		const firstAsiento = await prisma.asiento.findFirstOrThrow({
			where: { tenantId: first.tenantId, replayRunId: firstOutcome.replayRunId },
		});

		await expect(prisma.asiento.update({
			where: { asientoId: firstAsiento.asientoId },
			data: { replayRunId: secondOutcome.replayRunId },
		})).rejects.toMatchObject({
			code: 'P2003',
			meta: { constraint: 'asientos_tenantId_replayRunId_fkey' },
		});
	});

	it('rejects expired preflight and runs one approved period to completion', async () => {
		const fixture = await createFixture('lifecycle');
		const expired = await crearPreflightBackfill(
			fixture.tenantId,
			fixture.periodoId,
			fixture.requesterId,
		);
		const generatedAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
		await prisma.replayPreflight.update({
			where: { replayPreflightId: expired.replayPreflightId },
			data: { generatedAt, expiresAt: new Date(generatedAt.getTime() + 24 * 60 * 60 * 1000) },
		});
		await expect(
			aprobarPreflightBackfill(fixture.tenantId, expired.replayPreflightId, fixture.approverId),
		).rejects.toThrow('Preflight inexistente, vencido o no vigente');

		const { preflight, approval } = await createApprovedPreflight(fixture);
		await prisma.periodoContable.update({
			where: { periodoId: fixture.periodoId },
			data: { estado: 'CERRADO' },
		});
		const outcome = await ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId,
			replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId,
		});
		expect(outcome).toMatchObject({
			status: 'COMPLETED', contabilizados: 1, yaPosteados: 0, omitidos: 0,
			reconciliation: { status: 'CONFORME', expectedCount: 1, matchedCount: 1, differences: [] },
		});

		const asiento = await prisma.asiento.findFirstOrThrow({
			where: { tenantId: fixture.tenantId, origenTipo: 'reconciliacion_venta', origenId: fixture.sourceIds[0] },
		});
		const run = await prisma.replayRun.findFirstOrThrow({
			where: { tenantId: fixture.tenantId, replayPreflightId: preflight.replayPreflightId },
		});
		expect(run.status).toBe('COMPLETED');
		expect(run.postedCount).toBe(1);
		expect(run.startedByUserId).toBe(fixture.approverId);
		expect(run.replayApprovalId).toBe(approval.replayApprovalId);
		expect(run.digest).toBe(preflight.digest);
		expect(run.diagnostic).toMatchObject({
			periodGuardBypass: {
				capability: 'AUTHORIZED_HISTORICAL_REPLAY',
				periodoId: fixture.periodoId,
				replayPreflightId: preflight.replayPreflightId,
				replayApprovalId: approval.replayApprovalId,
				actorId: fixture.approverId,
			},
		});
		expect(asiento.periodoId).toBe(fixture.periodoId);
		expect(asiento.replayRunId).toBe(run.replayRunId);
	});

	it('retries a posting-time SQLSTATE 40001 without partial or duplicate ledger writes', async () => {
		const fixture = await createFixture('serialization-retry', 2);
		const { preflight, approval } = await createApprovedPreflight(fixture);
		const suffix = randomUUID().replaceAll('-', '');
		const sequenceName = `r5_retry_${suffix}_seq`;
		const functionName = `r5_retry_${suffix}_fn`;
		const triggerName = `r5_retry_${suffix}_trigger`;
		const secondSourceId = fixture.sourceIds[1];
		try {
			await prisma.$executeRawUnsafe(`CREATE SEQUENCE "${sequenceName}" START 1`);
			await prisma.$executeRawUnsafe(
				`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$ ` +
				`BEGIN IF EXISTS (SELECT 1 FROM "asientos" WHERE "asientoId" = NEW."asientoId" ` +
				`AND "origenTipo" = 'reconciliacion_venta' AND "origenId" = '${secondSourceId}') ` +
				`AND nextval('"${sequenceName}"') = 1 THEN ` +
				`RAISE EXCEPTION 'injected replay serialization conflict' USING ERRCODE = '40001'; ` +
				`END IF; RETURN NEW; END $$`,
			);
			await prisma.$executeRawUnsafe(
				`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "asiento_lineas" ` +
				`FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`,
			);

			const outcome = await ejecutarBackfillAutorizado({
				tenantId: fixture.tenantId,
				replayPreflightId: preflight.replayPreflightId,
				replayApprovalId: approval.replayApprovalId,
				actorId: fixture.approverId,
			});

			expect(outcome).toMatchObject({ status: 'COMPLETED', contabilizados: 2, omitidos: 0 });
			const runs = await prisma.replayRun.findMany({
				where: { tenantId: fixture.tenantId, replayPreflightId: preflight.replayPreflightId },
			});
			expect(runs).toHaveLength(1);
			expect(runs[0]?.status).toBe('COMPLETED');
			const entries = await prisma.asiento.findMany({
				where: { tenantId: fixture.tenantId, replayRunId: outcome.replayRunId },
				include: { lineas: true },
			});
			expect(entries).toHaveLength(2);
			expect(entries.map((entry) => entry.origenId).sort()).toEqual([...fixture.sourceIds].sort());
			expect(entries.every((entry) => entry.lineas.length >= 2)).toBe(true);
			const sequence = await prisma.$queryRawUnsafe<Array<{ last_value: bigint }>>(
				`SELECT last_value FROM "${sequenceName}"`,
			);
			// First source-2 line aborts the initial transaction; retry inserts both lines.
			expect(Number(sequence[0]?.last_value)).toBe(3);
		} finally {
			await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "asiento_lineas"`);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
			await prisma.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS "${sequenceName}"`);
		}
	});

	it('records NO_CONFORME after posting valid sources and omitting an unsupported adjustment', async () => {
		const fixture = await createFixture('non-conforme');
		const adjustment = await prisma.ajusteBancario.create({
			data: {
				tenantId: fixture.tenantId,
				cuentaId: fixture.accountId,
				tipo: 'tipo_no_soportado',
				monto: 50,
				moneda: 'CUP',
				montoConvertido: 50,
				descripcion: 'Unsupported replay adjustment',
				motivo: 'Integration test',
				realizadoPor: fixture.requesterId,
				fechaOperacion: new Date('2025-03-15T12:00:00.000Z'),
			},
		});
		const { preflight, approval } = await createApprovedPreflight(fixture);
		const result = await ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId,
			replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId,
		});

		expect(result).toMatchObject({ status: 'NO_CONFORME', contabilizados: 1, yaPosteados: 0, omitidos: 1 });
		const run = await prisma.replayRun.findFirstOrThrow({
			where: { tenantId: fixture.tenantId, replayPreflightId: preflight.replayPreflightId },
		});
		expect(run.status).toBe('NO_CONFORME');
		expect(run.postedCount).toBe(1);
		expect(run.omittedCount).toBe(1);
		expect(run.diagnostic).toMatchObject({
			omissions: [{ sourceType: 'ajuste_bancario', sourceId: adjustment.ajusteId, cause: 'TIPO_AJUSTE_BANCARIO_NO_VERIFICABLE' }],
		});
	});

	it('persists exact post-write reconciliation differences and returns NO_CONFORME', async () => {
		const fixture = await createFixture('post-write-difference');
		const { preflight, approval } = await createApprovedPreflight(fixture);
		const suffix = randomUUID().replaceAll('-', '');
		const functionName = `r55_diff_${suffix}_fn`;
		const triggerName = `r55_diff_${suffix}_trigger`;
		try {
			await prisma.$executeRawUnsafe(
				`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$ ` +
				`BEGIN IF NEW."debe" > 0 AND EXISTS (` +
				`SELECT 1 FROM "asientos" WHERE "asientoId" = NEW."asientoId" ` +
				`AND "tenantId" = '${fixture.tenantId}') THEN ` +
				`NEW."debe" := NEW."debe" + 0.0001; END IF; RETURN NEW; END $$`,
			);
			await prisma.$executeRawUnsafe(
				`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "asiento_lineas" ` +
				`FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`,
			);
			const outcome = await ejecutarBackfillAutorizado({
				tenantId: fixture.tenantId, replayPreflightId: preflight.replayPreflightId,
				replayApprovalId: approval.replayApprovalId, actorId: fixture.approverId,
			});
			expect(outcome.status).toBe('NO_CONFORME');
			expect(outcome.reconciliation).toMatchObject({
				status: 'NO_CONFORME', enforceReady: false,
				differences: expect.arrayContaining([
					expect.objectContaining({ cause: 'UNBALANCED_ENTRY', difference: '0.0001' }),
				]),
			});
			const run = await prisma.replayRun.findUniqueOrThrow({
				where: { replayRunId: outcome.replayRunId },
			});
			expect(run.status).toBe('NO_CONFORME');
			expect(run.diagnostic).toMatchObject({ reconciliation: outcome.reconciliation });
		} finally {
			await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "asiento_lineas"`);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
		}
	});

	it('serializes concurrent replay and records existing source as already posted on a new preflight', async () => {
		const fixture = await createFixture('concurrent');
		const { preflight, approval } = await createApprovedPreflight(fixture);
		const input = {
			tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId,
			replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId,
		};
		const concurrent = await Promise.allSettled([
			ejecutarBackfillAutorizado(input),
			ejecutarBackfillAutorizado(input),
		]);
		expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1);
		expect(await prisma.asiento.count({ where: { tenantId: fixture.tenantId } })).toBe(1);

		const retry = await createApprovedPreflight(fixture);
		const result = await ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: retry.preflight.replayPreflightId,
			replayApprovalId: retry.approval.replayApprovalId,
			actorId: fixture.approverId,
		});
		expect(result).toMatchObject({ contabilizados: 0, yaPosteados: 1, omitidos: 0 });
		expect(await prisma.asiento.count({ where: { tenantId: fixture.tenantId } })).toBe(1);
	});

	it('rolls back all period postings and durably records FAILED when a later source insert errors', async () => {
		const fixture = await createFixture('atomic', 2);
		const { preflight, approval } = await createApprovedPreflight(fixture);
		const suffix = randomUUID().replaceAll('-', '');
		const functionName = `r5_atomic_${suffix}_fail`;
		const triggerName = `r5_atomic_${suffix}_trigger`;
		sqlObjects.push({ trigger: triggerName, fn: functionName });
		await prisma.$executeRawUnsafe(
			`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$ ` +
			`BEGIN IF NEW."origenId" = '${fixture.sourceIds[1]}' THEN ` +
			`RAISE EXCEPTION 'r5_atomic_forced_failure'; END IF; RETURN NEW; END $$`,
		);
		await prisma.$executeRawUnsafe(
			`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "asientos" ` +
			`FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`,
		);

		await expect(ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId,
			replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId,
		})).rejects.toThrow('r5_atomic_forced_failure');
		expect(await prisma.asiento.count({ where: { tenantId: fixture.tenantId } })).toBe(0);
		const run = await prisma.replayRun.findFirstOrThrow({
			where: { tenantId: fixture.tenantId, replayPreflightId: preflight.replayPreflightId },
		});
		expect(run.status).toBe('FAILED');
		expect(run.completedAt).toBeInstanceOf(Date);
		expect(run.diagnostic).toMatchObject({
			periodGuardBypass: {
				capability: 'AUTHORIZED_HISTORICAL_REPLAY',
				replayPreflightId: preflight.replayPreflightId,
				replayApprovalId: approval.replayApprovalId,
				actorId: fixture.approverId,
			},
		});

		await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "asientos"`);
		await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
		const sqlObjectIndex = sqlObjects.findIndex((item) => item.trigger === triggerName);
		if (sqlObjectIndex !== -1) sqlObjects.splice(sqlObjectIndex, 1);
		const retry = await ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId,
			replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId,
		});
		expect(retry).toMatchObject({ contabilizados: 2, yaPosteados: 0, omitidos: 0 });
		expect(await prisma.asiento.count({ where: { tenantId: fixture.tenantId } })).toBe(2);
		const runs = await prisma.replayRun.findMany({
			where: { tenantId: fixture.tenantId, replayPreflightId: preflight.replayPreflightId },
			orderBy: { startedAt: 'asc' },
		});
		expect(runs.map((item) => item.status)).toEqual(['FAILED', 'COMPLETED']);
	});

	it('does not persist RUNNING or ledger rows when the transaction fails at commit and allows retry', async () => {
		const fixture = await createFixture('commit-failure');
		const { preflight, approval } = await createApprovedPreflight(fixture);
		const suffix = randomUUID().replaceAll('-', '');
		const functionName = `r5_commit_${suffix}_fail`;
		const triggerName = `r5_commit_${suffix}_trigger`;
		sqlObjects.push({ trigger: triggerName, fn: functionName, table: 'contabilidad_replay_runs' });
		await prisma.$executeRawUnsafe(
			`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$ ` +
			`BEGIN IF NEW."status" = 'COMPLETED' THEN ` +
			`RAISE EXCEPTION 'r5_commit_forced_failure'; END IF; RETURN NEW; END $$`,
		);
		await prisma.$executeRawUnsafe(
			`CREATE CONSTRAINT TRIGGER "${triggerName}" AFTER UPDATE ON "contabilidad_replay_runs" ` +
			`DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`,
		);

		await expect(ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId,
			replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId,
		})).rejects.toThrow('r5_commit_forced_failure');
		expect(await prisma.asiento.count({ where: { tenantId: fixture.tenantId } })).toBe(0);
		expect(await prisma.replayRun.count({ where: { tenantId: fixture.tenantId } })).toBe(0);

		await prisma.$executeRawUnsafe(
			`DROP TRIGGER IF EXISTS "${triggerName}" ON "contabilidad_replay_runs"`,
		);
		await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
		const sqlObjectIndex = sqlObjects.findIndex((item) => item.trigger === triggerName);
		if (sqlObjectIndex !== -1) sqlObjects.splice(sqlObjectIndex, 1);

		await expect(ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId,
			replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId,
		})).resolves.toMatchObject({ contabilizados: 1, yaPosteados: 0, omitidos: 0 });
		expect(await prisma.asiento.count({ where: { tenantId: fixture.tenantId } })).toBe(1);
		expect(await prisma.replayRun.findMany({ where: { tenantId: fixture.tenantId } })).toHaveLength(1);
	});
});
