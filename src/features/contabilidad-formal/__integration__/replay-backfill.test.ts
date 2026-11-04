/**
 * @description Verifica contra PostgreSQL desechable el ciclo completo del
 * replay historico: preflight → aprobación independiente → ejecución → verificación.
 *
 * El suite exige una base local desechable explicita (`ALLOW_DISPOSABLE_TEST_DB=1`
 * y una base `tcp_test_*`).
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
	planBackfillContable,
} from '@/features/contabilidad-formal/services/replay-backfill-service';

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

/**
 * @description Valida que la base de integracion sea un objetivo local
 * desechable autorizado de forma explicita.
 * @returns {URL} URL de la base validada.
 */
function assertDisposableTarget(): URL {
	expect(process.env.ALLOW_DISPOSABLE_TEST_DB).toBe('1');
	const url = new URL(process.env.DATABASE_URL ?? '');
	expect(['postgres:', 'postgresql:']).toContain(url.protocol);
	expect(['127.0.0.1', 'localhost', '[::1]']).toContain(url.hostname);
	expect(url.pathname).toMatch(/^\/tcp_test_[a-z0-9_]+$/);
	return url;
}

describe('replay historico — integración PostgreSQL', { timeout: 120_000 }, () => {
	const fixtures: Fixture[] = [];
	let creoMonedaCUP = false;

	beforeAll(async () => {
		assertDisposableTarget();
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
		for (const fixture of fixtures) {
			await prisma.$transaction(async (tx) => {
				await tx.asiento.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.replayRun.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.replayApproval.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.replayPreflight.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.reconciliacionVenta.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.cuentaPorCobrar.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.factura.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.ventaItem.deleteMany({ where: { venta: { tenantId: fixture.tenantId } } });
				await tx.venta.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.serieFacturacion.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.cliente.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.tipoPago.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.cuentaBancaria.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.puntoDeVenta.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.producto.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.almacen.deleteMany({ where: { tenantId: fixture.tenantId } });
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

	/**
	 * @description Crea el aislamiento del tenant con una venta a plazo, su
	 * factura, su cuenta por cobrar y el cobro conciliado.
	 * @returns {Promise<Fixture>} Identificadores de la fixture creada.
	 */
	async function crearFixture(): Promise<Fixture> {
		const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
		const tenant = await prisma.tenant.create({
			data: { nombre: `Replay ${suffix}`, slug: `replay-${suffix}` },
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
					name: `Solicitante ${suffix}`,
					email: `requester-${suffix}@replay.test`,
					password: 'hash-de-prueba',
				},
			}),
			prisma.user.create({
				data: {
					name: `Aprobador ${suffix}`,
					email: `approver-${suffix}@replay.test`,
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
				updatedBy: 'replay-it',
			},
		});
		await prisma.$transaction((tx) => seedPlanContable(tx, tenant.tenantId));

		const periodo = await prisma.periodoContable.create({
			data: {
				tenantId: tenant.tenantId,
				tipo: 'MENSUAL',
				estado: 'CERRADO',
				codigo: `REP-${suffix}`,
				fechaInicio: FECHA_INICIO,
				fechaFin: FECHA_FIN,
			},
		});
		fixture.periodoId = periodo.periodoId;

		const puntoDeVenta = await prisma.puntoDeVenta.create({
			data: { tenantId: tenant.tenantId, nombre: 'PV replay' },
		});
		const cliente = await prisma.cliente.create({
			data: { tenantId: tenant.tenantId, nombre: `Cliente replay ${suffix}` },
		});
		const serie = await prisma.serieFacturacion.create({
			data: {
				tenantId: tenant.tenantId,
				prefijo: 'RP',
				descripcion: 'Replay',
				consecutivo: 1,
				esPorDefecto: true,
			},
		});
		const tipoPago = await prisma.tipoPago.create({
			data: { tenantId: tenant.tenantId, nombre: `Pago replay ${suffix}` },
		});
		const cuentaBancaria = await prisma.cuentaBancaria.create({
			data: {
				tenantId: tenant.tenantId,
				nombreBanco: 'Banco replay',
				numeroCuenta: `REP-${suffix}`,
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
				numeroFactura: `RP-${suffix}-0001`,
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
				observaciones: 'Cobro de venta',
				reconciliadoPor: requester.userId,
			},
		});
		fixture.reconciliacionId = reconciliacion.reconciliacionId;
		return fixture;
	}

	it('exige una aprobación independiente y contabiliza el periodo aprobado', async () => {
		const fixture = await crearFixture();

		const plan = await planBackfillContable(fixture.tenantId);
		expect(plan.totalEvaluados).toBe(2);
		expect(plan.omitidos).toHaveLength(0);

		const preflight = await crearPreflightBackfill(
			fixture.tenantId,
			fixture.periodoId,
			fixture.requesterId,
		);
		expect(preflight.digest).toHaveLength(64);

		await expect(
			aprobarPreflightBackfill(
				fixture.tenantId,
				preflight.replayPreflightId,
				fixture.requesterId,
			),
		).rejects.toThrow('La aprobación debe ser independiente');

		const approval = await aprobarPreflightBackfill(
			fixture.tenantId,
			preflight.replayPreflightId,
			fixture.approverId,
		);
		expect(approval.status).toBe('APPROVED');

		const resultado = await ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId,
			replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId,
		});

		expect(resultado.status).toBe('COMPLETED');
		expect(resultado.contabilizados).toBe(2);
		expect(resultado.reconciliation.status).toBe('CONFORME');

		const asientos = await prisma.asiento.findMany({
			where: { tenantId: fixture.tenantId },
			include: { lineas: true },
			orderBy: { numero: 'asc' },
		});
		expect(asientos).toHaveLength(2);
		expect(asientos.map((asiento) => asiento.origenTipo).sort()).toEqual([
			'factura',
			'reconciliacion_venta',
		]);
		for (const asiento of asientos) {
			expect(asiento.replayRunId).toBe(resultado.replayRunId);
			expect(asiento.periodoId).toBe(fixture.periodoId);
			const debe = asiento.lineas.reduce((total, linea) => total + Number(linea.debe), 0);
			const haber = asiento.lineas.reduce((total, linea) => total + Number(linea.haber), 0);
			expect(debe).toBe(haber);
			expect(debe).toBe(100);
		}

		const run = await prisma.replayRun.findUnique({
			where: { tenantId_replayRunId: {
				tenantId: fixture.tenantId,
				replayRunId: resultado.replayRunId,
			} },
		});
		expect(run?.status).toBe('COMPLETED');
		expect(run?.postedCount).toBe(2);
	});

	it('no duplica los asientos cuando se repite el replay con un preflight nuevo', async () => {
		const fixture = await crearFixture();

		const primerPreflight = await crearPreflightBackfill(
			fixture.tenantId,
			fixture.periodoId,
			fixture.requesterId,
		);
		const primeraAprobacion = await aprobarPreflightBackfill(
			fixture.tenantId,
			primerPreflight.replayPreflightId,
			fixture.approverId,
		);
		await ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: primerPreflight.replayPreflightId,
			replayApprovalId: primeraAprobacion.replayApprovalId,
			actorId: fixture.approverId,
		});

		const segundoPreflight = await crearPreflightBackfill(
			fixture.tenantId,
			fixture.periodoId,
			fixture.requesterId,
		);
		const segundaAprobacion = await aprobarPreflightBackfill(
			fixture.tenantId,
			segundoPreflight.replayPreflightId,
			fixture.approverId,
		);
		const resultado = await ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: segundoPreflight.replayPreflightId,
			replayApprovalId: segundaAprobacion.replayApprovalId,
			actorId: fixture.approverId,
		});

		expect(resultado.contabilizados).toBe(0);
		expect(resultado.yaPosteados).toBe(2);
		const asientos = await prisma.asiento.findMany({
			where: { tenantId: fixture.tenantId },
		});
		expect(asientos).toHaveLength(2);
	});
});
