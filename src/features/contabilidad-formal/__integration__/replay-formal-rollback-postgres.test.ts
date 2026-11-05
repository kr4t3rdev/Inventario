/**
 * @description Test de integración real del rollback físico formal del replay
 * gobernado (R6.1, familia de replay).
 *
 * El replay histórico es la única vía que reconstruye el libro mayor de
 * periodos ya cerrados: escribe los asientos de todas las fuentes aprobadas
 * del periodo dentro de una transacción y, si una de esas escrituras falla,
 * revierte el savepoint que las envuelve para no dejar el libro a medias.
 *
 * El test comprueba, contra PostgreSQL desechable, tres cosas:
 *
 *  1. Control positivo: el replay aprobado contabiliza todas las fuentes y
 *     deja la cadena de hashes integra y numerada desde uno.
 *  2. Failpoint físico: cuando falla el insert del segundo asiento del
 *     periodo, el asiento ya contabilizado se revierte **fisicamente** (no
 *     queda ni una fila), el resultado durable queda en `FAILED` con el
 *     diagnostico del fallo y las fuentes operativas no se tocan.
 *  3. Recuperacion: tras el rollback, un nuevo replay del mismo periodo
 *     contabiliza de nuevo sin residuos ni numeros consumidos.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
import {
	assertDisposableDatabase,
	assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const FECHA_INICIO = new Date('2026-03-01T00:00:00.000Z');
const FECHA_FIN = new Date('2026-03-31T23:59:59.999Z');

interface Fixture {
	tenantId: string;
	requesterId: string;
	approverId: string;
	periodoId: string;
	facturaId: string;
	reconciliacionId: string;
}

const fixtures: Fixture[] = [];
const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
const failpointFunction = `formal_replay_ledger_failure_${suffix}`;
const failpointTrigger = `formal_replay_ledger_trigger_${suffix}`;
const failpointCounter = `formal_replay_ledger_attempts_${suffix}`;
let creoMonedaCUP = false;
let falloTenantId = '';

/**
 * @description Crea el aislamiento de un tenant con una venta a credito, su
 * factura, su cuenta por cobrar y el cobro conciliado: dos fuentes
 * reconstruibles en el mismo periodo.
 * @param {string} etiqueta - Sufijo legible del tenant.
 * @returns {Promise<Fixture>} Identificadores de la fixture creada.
 */
async function crearFixture(etiqueta: string): Promise<Fixture> {
	const sufijo = `${etiqueta}-${randomUUID().replaceAll('-', '').slice(0, 8)}`;
	const tenant = await prisma.tenant.create({
		data: { nombre: `Replay rollback ${sufijo}`, slug: `replay-rb-${sufijo}` },
	});
	const fixture: Fixture = {
		tenantId: tenant.tenantId,
		requesterId: '',
		approverId: '',
		periodoId: '',
		facturaId: '',
		reconciliacionId: '',
	};
	fixtures.push(fixture);

	const [requester, approver] = await Promise.all([
		prisma.user.create({
			data: {
				name: `Solicitante ${sufijo}`,
				email: `requester-${sufijo}@replay.test`,
				password: 'hash-de-prueba',
			},
		}),
		prisma.user.create({
			data: {
				name: `Aprobador ${sufijo}`,
				email: `approver-${sufijo}@replay.test`,
				password: 'hash-de-prueba',
			},
		}),
	]);
	fixture.requesterId = requester.userId;
	fixture.approverId = approver.userId;
	await prisma.tenantMembership.createMany({
		data: [
			{ tenantId: tenant.tenantId, userId: requester.userId, tenantRole: 'manager' },
			{ tenantId: tenant.tenantId, userId: approver.userId, tenantRole: 'manager' },
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
			updatedBy: 'replay-rollback-it',
		},
	});
	await prisma.$transaction((tx) => seedPlanContable(tx, tenant.tenantId));

	const periodo = await prisma.periodoContable.create({
		data: {
			tenantId: tenant.tenantId,
			tipo: 'MENSUAL',
			estado: 'CERRADO',
			codigo: `RBR-${sufijo}`,
			fechaInicio: FECHA_INICIO,
			fechaFin: FECHA_FIN,
		},
	});
	fixture.periodoId = periodo.periodoId;

	const puntoDeVenta = await prisma.puntoDeVenta.create({
		data: { tenantId: tenant.tenantId, nombre: 'PV replay rollback' },
	});
	const cliente = await prisma.cliente.create({
		data: { tenantId: tenant.tenantId, nombre: `Cliente replay ${sufijo}` },
	});
	const serie = await prisma.serieFacturacion.create({
		data: {
			tenantId: tenant.tenantId,
			prefijo: 'RB',
			descripcion: 'Replay rollback',
			consecutivo: 1,
			esPorDefecto: true,
		},
	});
	const tipoPago = await prisma.tipoPago.create({
		data: { tenantId: tenant.tenantId, nombre: `Pago replay ${sufijo}` },
	});
	const cuentaBancaria = await prisma.cuentaBancaria.create({
		data: {
			tenantId: tenant.tenantId,
			nombreBanco: 'Banco replay rollback',
			numeroCuenta: `RBR-${sufijo}`,
			tipoCuenta: 'EFECTIVO',
			saldo: 1000,
			moneda: 'CUP',
		},
	});

	const venta = await prisma.venta.create({
		data: {
			tenantId: tenant.tenantId,
			cantidad: 1,
			puntoDeVentaId: puntoDeVenta.pvId,
			clienteId: cliente.clienteId,
			total: 100,
			estado: 'FACTURADA',
			metodoPago: 'CREDITO',
			esVentaUnica: true,
		},
	});
	const factura = await prisma.factura.create({
		data: {
			tenantId: tenant.tenantId,
			serieId: serie.serieId,
			numeroConsecutivo: 1,
			numeroFactura: `RB-${sufijo}-0001`,
			clienteId: cliente.clienteId,
			ventaId: venta.ventaId,
			subtotal: 100,
			total: 100,
			estado: 'PENDIENTE',
			fechaEmision: new Date('2026-03-10T12:00:00.000Z'),
			creadoPor: requester.userId,
		},
	});
	fixture.facturaId = factura.idFactura;
	await prisma.cuentaPorCobrar.create({
		data: {
			tenantId: tenant.tenantId,
			clienteId: cliente.clienteId,
			facturaId: factura.idFactura,
			montoDeuda: 100,
			estado: 'PENDIENTE',
		},
	});
	const reconciliacion = await prisma.reconciliacionVenta.create({
		data: {
			tenantId: tenant.tenantId,
			ventaId: venta.ventaId,
			cuentaId: cuentaBancaria.cuentaId,
			tipoPagoId: tipoPago.tipoId,
			monto: 100,
			moneda: 'CUP',
			montoConvertido: 100,
			functionalCurrency: 'CUP',
			fechaReconciliacion: new Date('2026-03-15T12:00:00.000Z'),
			observaciones: 'Cobro de venta replay',
			reconciliadoPor: requester.userId,
		},
	});
	fixture.reconciliacionId = reconciliacion.reconciliacionId;
	return fixture;
}

/**
 * @description Aprueba un preflight con un responsable independiente y ejecuta
 * el replay del periodo.
 * @param {Fixture} fixture - Fixture del tenant aislado.
 * @returns {Promise<{ preflightId: string; approvalId: string }>} Identificadores usados.
 */
async function aprobarYEjecutar(fixture: Fixture): Promise<{
	preflightId: string;
	approvalId: string;
}> {
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
	await ejecutarBackfillAutorizado({
		tenantId: fixture.tenantId,
		replayPreflightId: preflight.replayPreflightId,
		replayApprovalId: approval.replayApprovalId,
		actorId: fixture.approverId,
	});
	return {
		preflightId: preflight.replayPreflightId,
		approvalId: approval.replayApprovalId,
	};
}

/**
 * @description Lee el libro mayor y el estado durable del replay del tenant.
 * @param {string} tenantId - Tenant observado.
 * @returns {Promise<object>} Fotografia del estado persistido.
 */
async function readSnapshot(tenantId: string) {
	const [asientos, lineas, runs, facturas, reconciliaciones, cobros] = await Promise.all([
		prisma.asiento.findMany({
			where: { tenantId },
			orderBy: { tenantSequence: 'asc' },
			select: {
				asientoId: true,
				origenTipo: true,
				origenId: true,
				numero: true,
				tenantSequence: true,
				hash: true,
				hashAnterior: true,
				replayRunId: true,
			},
		}),
		prisma.asientoLinea.count({ where: { tenantId } }),
		prisma.replayRun.findMany({
			where: { tenantId },
			orderBy: { startedAt: 'asc' },
			select: {
				replayRunId: true,
				status: true,
				postedCount: true,
				diagnostic: true,
			},
		}),
		prisma.factura.count({ where: { tenantId } }),
		prisma.reconciliacionVenta.count({ where: { tenantId } }),
		prisma.cuentaPorCobrar.count({ where: { tenantId } }),
	]);
	return {
		asientos: asientos.map((row) => ({
			id: row.asientoId,
			origenTipo: row.origenTipo,
			origenId: row.origenId,
			numero: row.numero,
			secuencia: row.tenantSequence?.toString() ?? null,
			hash: row.hash,
			hashAnterior: row.hashAnterior,
			replayRunId: row.replayRunId,
		})),
		lineas,
		runs: runs.map((row) => ({
			id: row.replayRunId,
			status: row.status,
			postedCount: row.postedCount,
			error:
				(row.diagnostic as { error?: string } | null)?.error ??
				null,
		})),
		fuentes: { facturas, reconciliaciones, cobros },
	};
}

describe('rollback fisico formal del replay gobernado en PostgreSQL aislado', { timeout: 180_000 }, () => {
	beforeAll(async () => {
		const identity = await prisma.$queryRaw<Array<{
			databaseName: string;
			roleName: string;
			serverPort: number;
		}>>`
			SELECT current_database() AS "databaseName",
			  current_user AS "roleName", inet_server_port() AS "serverPort"
		`;
		expect(identity).toHaveLength(1);
		assertDisposableDatabaseIdentity(identity[0], process.env);

		const moneda = await prisma.moneda.findUnique({ where: { codigo: 'CUP' } });
		if (!moneda) {
			await prisma.moneda.create({
				data: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP', esPrincipal: true },
			});
			creoMonedaCUP = true;
		}
		await prisma.$transaction((tx) => seedPlantillasGlobales(tx));
	});

	afterAll(async () => {
		await prisma.$executeRawUnsafe(
			`DROP TRIGGER IF EXISTS "${failpointTrigger}" ON public."asientos"`,
		);
		await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${failpointFunction}"()`);
		await prisma.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS public."${failpointCounter}"`);
		for (const fixture of fixtures) {
			await prisma.$transaction(async (tx) => {
				await tx.asiento.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.replayRun.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.replayApproval.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.replayPreflight.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.reconciliacionVenta.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.cuentaPorCobrar.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.factura.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.venta.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.serieFacturacion.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.cliente.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.tipoPago.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.cuentaBancaria.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.puntoDeVenta.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.cuentaRolTenant.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.cuentaContable.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.diario.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.periodoContable.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.tenantAccountingPolicy.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.tenantMembership.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.tenantLicense.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.user.deleteMany({
					where: { userId: { in: [fixture.requesterId, fixture.approverId] } },
				});
				await tx.tenant.deleteMany({ where: { tenantId: fixture.tenantId } });
			});
		}
		if (creoMonedaCUP) {
			await prisma.moneda.deleteMany({ where: { codigo: 'CUP' } });
		}
	});

	it('contabiliza todas las fuentes aprobadas con la cadena de hashes integra', async () => {
		const fixture = await crearFixture('control');
		const before = await readSnapshot(fixture.tenantId);

		const { preflightId, approvalId } = await aprobarYEjecutar(fixture);

		const after = await readSnapshot(fixture.tenantId);
		expect(after.asientos).toHaveLength(before.asientos.length + 2);
		expect(after.asientos.map((row) => row.origenTipo).sort()).toEqual([
			'factura',
			'reconciliacion_venta',
		]);
		expect(after.asientos.map((row) => row.numero).sort()).toEqual([1, 2]);
		expect(after.asientos.map((row) => row.secuencia).sort()).toEqual(['1', '2']);
		const [primero, segundo] = after.asientos;
		expect(primero.hashAnterior).toBeNull();
		expect(segundo.hashAnterior).toBe(primero.hash);
		for (const asiento of after.asientos) {
			expect(asiento.hash).toMatch(/^[a-f0-9]{64}$/);
			expect(asiento.replayRunId).not.toBeNull();
		}
		expect(after.runs).toHaveLength(1);
		expect(after.runs[0].status).toBe('COMPLETED');
		expect(after.runs[0].postedCount).toBe(2);
		expect(after.fuentes).toEqual(before.fuentes);
		expect(preflightId).toBeTruthy();
		expect(approvalId).toBeTruthy();
	});

	it('revierte fisicamente los asientos ya contabilizados cuando falla un insert del periodo', async () => {
		const fixture = await crearFixture('failpoint');
		falloTenantId = fixture.tenantId;
		const before = await readSnapshot(fixture.tenantId);

		// Failpoint fisico: el trigger aborta el insert del segundo asiento del
		// periodo, cuando el primero ya estaba contabilizado dentro de la misma
		// transaccion. Asi se prueba que el savepoint revierte lo ya escrito.
		// La secuencia cuenta los intentos y no se revierte con la transaccion:
		// deja constancia de que el segundo insert llego a intentarse.
		await prisma.$executeRawUnsafe(`CREATE SEQUENCE public."${failpointCounter}"`);
		await prisma.$executeRawUnsafe(
			`CREATE FUNCTION public."${failpointFunction}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."tenantId" = '${fixture.tenantId}' THEN PERFORM nextval('public."${failpointCounter}"'); IF (SELECT count(*) FROM public."asientos" WHERE "tenantId" = '${fixture.tenantId}') >= 1 THEN RAISE EXCEPTION 'forced replay asiento failure' USING ERRCODE = '23514'; END IF; END IF; RETURN NEW; END $$`,
		);
		await prisma.$executeRawUnsafe(
			`CREATE TRIGGER "${failpointTrigger}" BEFORE INSERT ON public."asientos" FOR EACH ROW EXECUTE FUNCTION public."${failpointFunction}"()`,
		);

		try {
			await expect(aprobarYEjecutar(fixture)).rejects.toThrow(/forced replay asiento failure/);

			// El trigger contó dos intentos: el primer asiento se escribió y el
			// segundo provocó el fallo. La secuencia sobrevive al rollback.
			const intentos = await prisma.$queryRawUnsafe<Array<{ ultimo: bigint }>>(
				`SELECT last_value AS "ultimo" FROM public."${failpointCounter}"`,
			);
			expect(Number(intentos[0]?.ultimo ?? 0n)).toBe(2);

			const after = await readSnapshot(fixture.tenantId);
			// Nada del libro quedo a medias: ni el asiento ya contabilizado ni el
			// que provoco el fallo.
			expect(after.asientos).toEqual(before.asientos);
			expect(after.lineas).toBe(before.lineas);
			// El resultado durable del intento queda registrado como fallido.
			expect(after.runs).toHaveLength(1);
			expect(after.runs[0].status).toBe('FAILED');
			expect(after.runs[0].postedCount).toBe(0);
			expect(after.runs[0].error).toContain('forced replay asiento failure');
			// Las fuentes operativas del periodo no se tocan: el replay solo
			// reconstruye el libro formal.
			expect(after.fuentes).toEqual(before.fuentes);
		} finally {
			await prisma.$executeRawUnsafe(
				`DROP TRIGGER IF EXISTS "${failpointTrigger}" ON public."asientos"`,
			);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${failpointFunction}"()`);
			await prisma.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS public."${failpointCounter}"`);
		}
	});

	it('permite reejecutar el replay tras el rollback sin residuos ni numeros consumidos', async () => {
		const fixture = fixtures.find((row) => row.tenantId === falloTenantId);
		expect(fixture).toBeDefined();
		if (!fixture) return;

		const { preflightId, approvalId } = await aprobarYEjecutar(fixture);

		const after = await readSnapshot(fixture.tenantId);
		expect(after.asientos).toHaveLength(2);
		expect(after.asientos.map((row) => row.numero).sort()).toEqual([1, 2]);
		expect(after.asientos.map((row) => row.secuencia).sort()).toEqual(['1', '2']);
		expect(after.runs).toHaveLength(2);
		expect(after.runs.map((row) => row.status).sort()).toEqual(['COMPLETED', 'FAILED']);
		expect(preflightId).toBeTruthy();
		expect(approvalId).toBeTruthy();
	});
});
