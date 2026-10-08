/**
 * @description Integración real del motor de asientos (CTA-1 T3) contra la base
 * desechable `tcp_test_local`: cuadre persistido, idempotencia por origen,
 * numeración y cadena de hash por tenant, aislamiento entre tenants, y rechazo
 * gobernado cuando el período no es editable.
 * Corre solo con vitest.integration.config.mjs (DB real).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import {
	seedPlanContable,
	seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import {
	postEvento,
	construirHashAsiento,
	construirHashAsientoV2,
	type EventoContableInput,
} from '@/features/contabilidad-formal/services/posting-engine';
import {
	ejecutarBackfillAutorizado,
	ejecutarBackfillPeriodo,
} from '@/features/contabilidad-formal/services/replay-backfill-service';

const FECHA_VIGENTE = new Date('2026-09-21T15:00:00Z');
const FECHA_PERIODO_CERRADO = new Date('2020-06-15T12:00:00Z');

interface EstadoSuite {
	tenantA: string;
	tenantB: string;
	tenantC: string;
	periodoVigenteA: string;
	periodoCerradoA: string;
	periodoHistoricoC: string;
	replayRequesterC: string;
	replayApproverC: string;
	replaySourceIdsC: string[];
}

/** Accessor auxiliar dentro del describe de libros. */
let _estado: EstadoSuite;
function tenantListado(cual: 'A' | 'B'): string {
	return cual === 'A' ? _estado.tenantA : _estado.tenantB;
}
function periodoVigenteId(): string {
	return _estado.periodoVigenteA;
}

/**
 * @description Evento de venta al contado mínimo para la suite.
 */
function eventoVenta(origenId: string, tenantMoneda = 'CUP'): EventoContableInput {
	return {
		tipo: 'VENTA_CONTADO',
		fecha: FECHA_VIGENTE,
		descripcion: `Venta de prueba ${origenId}`,
		origen: { tipo: 'venta', id: origenId },
		monto: 1000,
		moneda: tenantMoneda,
		monedaFuncional: tenantMoneda,
		tasaCambio: null,
		montoFuncional: 1000,
	};
}

describe('posting engine — integración (DB real)', { timeout: 60_000 }, () => {
	const estado: EstadoSuite = {
		tenantA: '',
		tenantB: '',
		tenantC: '',
		periodoVigenteA: '',
		periodoCerradoA: '',
		periodoHistoricoC: '',
		replayRequesterC: '',
		replayApproverC: '',
		replaySourceIdsC: [],
	};
	let cupCurrencyCreatedBySuite = false;

	beforeAll(async () => {
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';

		await prisma.$transaction(async (tx) => {
			await seedPlantillasGlobales(tx);
		});

		const tA = await prisma.tenant.create({
			data: { nombre: 'Tenant CTA1 A', slug: `cta1-a-${Date.now()}` },
		});
		const tB = await prisma.tenant.create({
			data: { nombre: 'Tenant CTA1 B', slug: `cta1-b-${Date.now()}` },
		});
		const cupCurrency = await prisma.moneda.findUnique({ where: { codigo: 'CUP' } });
		if (!cupCurrency) {
			await prisma.moneda.create({
				data: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP', esPrincipal: true },
			});
			cupCurrencyCreatedBySuite = true;
		}
		estado.tenantA = tA.tenantId;
		estado.tenantB = tB.tenantId;
		_estado = estado;
		await prisma.tenantAccountingPolicy.create({
			data: { tenantId: tA.tenantId, functionalCurrencyCode: 'CUP', updatedBy: 'u-it' },
		});
		await prisma.tenantAccountingPolicy.create({
			data: { tenantId: tB.tenantId, functionalCurrencyCode: 'CUP', updatedBy: 'u-it' },
		});

		// Tenant C: período histórico cerrado con operaciones sin asientos (backfill).
		const tC = await prisma.tenant.create({
			data: { nombre: 'Tenant CTA1 C histórico', slug: `cta1-c-${Date.now()}` },
		});
		estado.tenantC = tC.tenantId;
		const replayUsers = await Promise.all([
			prisma.user.create({ data: { name: 'Replay requester', email: `replay-requester-${Date.now()}@test.invalid`, password: 'test-hash' } }),
			prisma.user.create({ data: { name: 'Replay approver', email: `replay-approver-${Date.now()}@test.invalid`, password: 'test-hash' } }),
		]);
		estado.replayRequesterC = replayUsers[0].userId;
		estado.replayApproverC = replayUsers[1].userId;
		await prisma.tenantMembership.createMany({ data: replayUsers.map((user) => ({ tenantId: tC.tenantId, userId: user.userId, tenantRole: 'manager' })) });
		await prisma.moneda.upsert({
			where: { codigo: 'CUP' },
			create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP', esPrincipal: true },
			update: {},
		});
		await prisma.$transaction(async (tx) => {
			await seedPlanContable(tx, tC.tenantId);
		});
		await prisma.tenantAccountingPolicy.create({
			data: { tenantId: tC.tenantId, functionalCurrencyCode: 'CUP', updatedBy: 'u-it' },
		});
		const cuentaC = await prisma.cuentaBancaria.create({
			data: {
				tenantId: tC.tenantId,
				nombreBanco: 'Banco C',
				numeroCuenta: `C-${Date.now()}`,
				tipoCuenta: 'AHORROS',
				moneda: 'CUP',
				saldo: 0,
			},
		});
		const tipoPagoC = await prisma.tipoPago.create({
			data: {
				tenantId: tC.tenantId,
				nombre: 'Efectivo',
				descripcion: 'Test',
				isActive: true,
			},
		});
		const periodoHistoricoC = await prisma.periodoContable.create({
			data: {
				tenantId: tC.tenantId,
				tipo: 'MENSUAL',
				estado: 'APROBADO',
				codigo: 'M-2026-03',
				fechaInicio: new Date('2026-03-01T00:00:00Z'),
				fechaFin: new Date('2026-03-31T23:59:59Z'),
			},
		});
		estado.periodoHistoricoC = periodoHistoricoC.periodoId;

		// Dos operaciones históricas válidas para replay: ventas al contado.
		for (const [index, monto] of [500, 300].entries()) {
			const source = await prisma.reconciliacionVenta.create({
			data: {
				tenantId: tC.tenantId,
				ventaId: null,
				cuentaId: cuentaC.cuentaId,
				tipoPagoId: tipoPagoC.tipoId,
				monto,
				moneda: 'CUP',
				montoConvertido: monto,
				fechaReconciliacion: new Date(`2026-03-${10 + index}T12:00:00Z`),
				reconciliadoPor: 'u-it',
			},
			});
			estado.replaySourceIdsC.push(source.reconciliacionId);
		}

		for (const tenantId of [estado.tenantA, estado.tenantB]) {
			await prisma.tenantLicense.create({
				data: {
					tenantId,
					activa: true,
					expiracion: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
					features: { 'contabilidad-formal': true },
				},
			});
			await prisma.$transaction(async (tx) => {
				await seedPlanContable(tx, tenantId);
			});
		}
		await prisma.tenantLicense.create({
			data: {
				tenantId: estado.tenantC,
				activa: true,
				expiracion: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
				features: { 'contabilidad-formal': true },
			},
		});

		const vigente = await prisma.periodoContable.create({
			data: {
				tenantId: estado.tenantA,
				tipo: 'MENSUAL',
				estado: 'ABIERTO',
				fechaInicio: new Date('2026-01-01T00:00:00Z'),
				fechaFin: new Date('2026-12-31T23:59:59Z'),
			},
		});
		estado.periodoVigenteA = vigente.periodoId;

		const cerrado = await prisma.periodoContable.create({
			data: {
				tenantId: estado.tenantA,
				tipo: 'MENSUAL',
				estado: 'APROBADO',
				fechaInicio: new Date('2020-06-01T00:00:00Z'),
				fechaFin: new Date('2020-06-30T23:59:59Z'),
			},
		});
		estado.periodoCerradoA = cerrado.periodoId;

		return async () => void 0;
	}, 60_000);

	afterAll(async () => {
		delete process.env.CONTABILIDAD_FORMAL_MODE;
		for (const tenantId of [estado.tenantA, estado.tenantB, estado.tenantC]) {
				if (!tenantId) continue;
				await prisma.asiento.deleteMany({ where: { tenantId } });
				await prisma.aperturaPeriodo.deleteMany({ where: { tenantId } });
				await prisma.reconciliacionVenta.deleteMany({ where: { tenantId } });
				await prisma.reconciliacionGasto.deleteMany({ where: { tenantId } });
				await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
				await prisma.replayRun.deleteMany({ where: { tenantId } });
				await prisma.replayApproval.deleteMany({ where: { tenantId } });
				await prisma.replayPreflight.deleteMany({ where: { tenantId } });
			await prisma.cuentaContable.deleteMany({ where: { tenantId } });
				await prisma.diario.deleteMany({ where: { tenantId } });
				await prisma.periodoContable.deleteMany({ where: { tenantId } });
				await prisma.tipoPago.deleteMany({ where: { tenantId } });
				await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
				await prisma.periodoCache.deleteMany({ where: { tenantId } });
				await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
				await prisma.tenant.delete({ where: { tenantId } }).catch(() => undefined);
		}
		await prisma.user.deleteMany({ where: { userId: { in: [estado.replayRequesterC, estado.replayApproverC] } } });
		if (cupCurrencyCreatedBySuite) {
			await prisma.moneda.deleteMany({ where: { codigo: 'CUP' } });
		}
	});

	it('contabiliza una venta al contado cuadrada en el diario de ventas', async () => {
		const resultado = await prisma.$transaction((tx) =>
			postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, eventoVenta('it-venta-1')),
		);

		expect(resultado.estado).toBe('CONTABILIZADO');

		const asiento = await prisma.asiento.findFirstOrThrow({
			where: { tenantId: estado.tenantA, origenTipo: 'venta', origenId: 'it-venta-1' },
			include: { lineas: true, diario: true },
		});
		expect(asiento.diario.tipo).toBe('VENTAS');
		expect(asiento.numero).toBe(1);
		expect(asiento.periodoId).toBe(estado.periodoVigenteA);
		expect(asiento.hashAnterior).toBeNull();
		expect(asiento.hash).toMatch(/^[0-9a-f]{64}$/);
		expect(asiento.hashVersion).toBe('canonical-v2');
		expect(asiento.tenantSequence).toBe(BigInt(1));

		const debe = asiento.lineas.reduce((acc, l) => acc + Number(l.debe), 0);
		const haber = asiento.lineas.reduce((acc, l) => acc + Number(l.haber), 0);
		expect(debe).toBe(1000);
		expect(haber).toBe(1000);
	});

	it('verifica y continúa v2 sin pérdida en Decimal(20,4)', async () => {
		let original = await prisma.asiento.findFirst({
			where: { tenantId: estado.tenantA, origenId: 'it-precision-base' }, include: { lineas: true },
		});
		if (!original) {
			const seeded = await prisma.$transaction((tx) =>
				postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, eventoVenta('it-precision-base')),
			);
			original = await prisma.asiento.findUniqueOrThrow({
				where: { asientoId: seeded.asientoId }, include: { lineas: true },
			});
		}
		const originalLines = original.lineas.map((line) => ({
			lineaId: line.lineaId, debe: line.debe, haber: line.haber,
		}));
		const importe = new Prisma.Decimal('123456789012345.0001');
		let appendedId: string | null = null;
		try {
			const lineasHash = original.lineas.map((line, index) => ({
				orden: line.orden, cuentaId: line.cuentaId,
				debe: index === 0 ? importe : new Prisma.Decimal(0),
				haber: index === 1 ? importe : new Prisma.Decimal(0),
			}));
			await prisma.$transaction(async (tx) => {
				await Promise.all(original.lineas.map((line, index) => tx.asientoLinea.update({
					where: { lineaId: line.lineaId },
					data: { debe: lineasHash[index].debe, haber: lineasHash[index].haber },
				})));
				const hash = construirHashAsientoV2({
					tenantId: original.tenantId, diarioId: original.diarioId, periodoId: original.periodoId,
					numero: original.numero, fecha: original.fecha, origenTipo: original.origenTipo,
					origenId: original.origenId, hashAnterior: original.hashAnterior,
					lineas: lineasHash, tenantSequence: original.tenantSequence!,
				});
				await tx.asiento.update({ where: { asientoId: original.asientoId }, data: { hash } });
			});
			const { verificarCadenaAsientos, inicializarMetadataCadenaHistorica } = await import(
				'@/features/contabilidad-formal/services/verificador-hash-service'
			);
			expect((await verificarCadenaAsientos(estado.tenantA)).integro).toBe(true);
			await prisma.$transaction(async (tx) => {
				expect(await inicializarMetadataCadenaHistorica(tx, estado.tenantA)).toBe(0);
			});
			const result = await prisma.$transaction((tx) =>
				postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, eventoVenta('it-precision-next')),
			);
			appendedId = result.asientoId ?? null;
			const appended = await prisma.asiento.findUniqueOrThrow({ where: { asientoId: result.asientoId } });
			expect(appended.hashAnterior).toBe(construirHashAsientoV2({
				tenantId: original.tenantId, diarioId: original.diarioId, periodoId: original.periodoId,
				numero: original.numero, fecha: original.fecha, origenTipo: original.origenTipo,
				origenId: original.origenId, hashAnterior: original.hashAnterior,
				lineas: lineasHash, tenantSequence: original.tenantSequence!,
			}));
			expect(appended.tenantSequence).toBe(original.tenantSequence! + BigInt(1));
			expect((await verificarCadenaAsientos(estado.tenantA)).integro).toBe(true);
		} finally {
			await prisma.$transaction(async (tx) => {
				if (appendedId) await tx.asiento.delete({ where: { asientoId: appendedId } });
				await Promise.all(originalLines.map((line) => tx.asientoLinea.update({
					where: { lineaId: line.lineaId }, data: { debe: line.debe, haber: line.haber },
				})));
				await tx.asiento.update({ where: { asientoId: original.asientoId }, data: { hash: original.hash } });
			});
		}
	});

	it('inicializa y reejecuta metadata legacy sin tocar hash ni líneas', async () => {
		const { inicializarMetadataCadenaHistorica } = await import(
			'@/features/contabilidad-formal/services/verificador-hash-service'
		);
		let originals = await prisma.asiento.findMany({
			where: { tenantId: estado.tenantA }, orderBy: { tenantSequence: 'asc' }, include: { lineas: true },
		});
		if (originals.length === 0) {
			await prisma.$transaction((tx) =>
				postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, eventoVenta('it-legacy-init-seed')),
			);
			originals = await prisma.asiento.findMany({
				where: { tenantId: estado.tenantA }, orderBy: { tenantSequence: 'asc' }, include: { lineas: true },
			});
		}
		let previousHash: string | null = null;
		const legacyRows = originals.map((row) => {
			const hash = construirHashAsiento({
				tenantId: row.tenantId, diarioId: row.diarioId, periodoId: row.periodoId,
				numero: row.numero, fecha: row.fecha, origenTipo: row.origenTipo,
				origenId: row.origenId, hashAnterior: previousHash,
				lineas: row.lineas.map((line) => ({
					orden: line.orden, cuentaId: line.cuentaId, debe: String(line.debe), haber: String(line.haber),
				})),
			});
			const legacy = { asientoId: row.asientoId, hash, hashAnterior: previousHash };
			previousHash = hash;
			return legacy;
		});
		const originalLines = originals.flatMap((row) => row.lineas.map((line) => ({
			lineaId: line.lineaId, debe: line.debe.toString(), haber: line.haber.toString(),
		})));
		await prisma.$transaction(async (tx) => {
			for (const row of legacyRows) {
				await tx.asiento.update({
					where: { asientoId: row.asientoId },
					data: { hash: row.hash, hashAnterior: row.hashAnterior, hashVersion: null, tenantSequence: null },
				});
			}
			expect(await inicializarMetadataCadenaHistorica(tx, estado.tenantA)).toBe(originals.length);
			const initialized = await tx.asiento.findMany({
				where: { tenantId: estado.tenantA }, orderBy: { tenantSequence: 'asc' }, include: { lineas: true },
			});
			expect(initialized.map((row) => row.hash)).toEqual(legacyRows.map((row) => row.hash));
			expect(initialized.every((row) => row.hashVersion === 'legacy-decimal-v1')).toBe(true);
			expect(initialized.every((row, index) => row.tenantSequence === BigInt(index + 1))).toBe(true);
			const initializedLines = initialized.flatMap((row) => row.lineas.map((line) => ({
				lineaId: line.lineaId, debe: line.debe.toString(), haber: line.haber.toString(),
			}))).sort((a, b) => a.lineaId.localeCompare(b.lineaId));
			expect(initializedLines).toEqual(
				[...originalLines].sort((a, b) => a.lineaId.localeCompare(b.lineaId)),
			);
			expect(await inicializarMetadataCadenaHistorica(tx, estado.tenantA)).toBe(0);
			for (const row of originals) {
				await tx.asiento.update({
					where: { asientoId: row.asientoId },
					data: { hash: row.hash, hashAnterior: row.hashAnterior, hashVersion: row.hashVersion, tenantSequence: row.tenantSequence },
				});
			}
		});
	});

		it('reintentar el mismo evento no duplica el asiento', async () => {
		const primero = await prisma.$transaction((tx) =>
			postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, eventoVenta('it-venta-2')),
		);
		const segundo = await prisma.$transaction((tx) =>
			postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, eventoVenta('it-venta-2')),
		);

		expect(primero.estado).toBe('CONTABILIZADO');
		expect(segundo.estado).toBe('YA_EXISTENTE');
		expect(segundo.asientoId).toBe(primero.asientoId);

		const total = await prisma.asiento.count({
			where: { tenantId: estado.tenantA, origenId: 'it-venta-2' },
		});
		expect(total).toBe(1);
	});

	it('serializa dos posteos simultáneos del mismo origen sin duplicar el asiento', async () => {
			const evento = eventoVenta('it-venta-concurrente-mismo');
			const resultados = await Promise.all([
				prisma.$transaction((tx) => postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, evento)),
				prisma.$transaction((tx) => postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, evento)),
			]);

			expect(resultados.map((r) => r.estado).sort()).toEqual(['CONTABILIZADO', 'YA_EXISTENTE']);
			expect(new Set(resultados.map((r) => r.asientoId)).size).toBe(1);
			expect(await prisma.asiento.count({
				where: { tenantId: estado.tenantA, origenId: evento.origen.id },
			})).toBe(1);
		});

	it.each(['RepeatableRead', 'Serializable'].flatMap((isolationLevel) =>
		['same-origin', 'different-origin'].map((kind) => ({ isolationLevel, kind })),
	))(
			'restablece snapshot de $isolationLevel con $kind y reintento transaccional completo',
			async ({ isolationLevel, kind }) => {
				const suffix = `${isolationLevel}-${kind}-${Date.now()}`;
				const origenGanador = `it-snapshot-winner-${suffix}`;
				const origenA = kind === 'same-origin' ? origenGanador : `it-snapshot-a-${suffix}`;
				const nombreOriginal = (await prisma.tenant.findUniqueOrThrow({
					where: { tenantId: estado.tenantA }, select: { nombre: true },
				})).nombre;
				let markSnapshot!: () => void;
				let continueA!: () => void;
				const snapshotReady = new Promise<void>((resolve) => { markSnapshot = resolve; });
				const gate = new Promise<void>((resolve) => { continueA = resolve; });
				let aError: unknown;
				const transactionA = prisma.$transaction(async (tx: any) => {
					await tx.asiento.findMany({ where: { tenantId: estado.tenantA } });
					markSnapshot();
					await gate;
					await tx.tenant.update({
						where: { tenantId: estado.tenantA }, data: { nombre: `${nombreOriginal}-rolled-back` },
					});
					return postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, eventoVenta(origenA));
				}, { isolationLevel: isolationLevel as Prisma.TransactionIsolationLevel, timeout: 20_000 }).catch((error: unknown) => {
					aError = error;
					return null;
				});

				try {
					await snapshotReady;
					const ganador = await prisma.$transaction((tx: any) =>
						postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, eventoVenta(origenGanador)),
						{ isolationLevel: isolationLevel as Prisma.TransactionIsolationLevel },
					);
					expect(ganador.estado).toBe('CONTABILIZADO');
					continueA();
					await transactionA;
					const errorCode = (aError as { code?: string }).code;
					expect(['P2002', 'P2034']).toContain(errorCode);
					expect(await prisma.tenant.findUniqueOrThrow({
						where: { tenantId: estado.tenantA }, select: { nombre: true },
					})).toEqual({ nombre: nombreOriginal });
					expect(await prisma.asiento.count({
						where: { tenantId: estado.tenantA, origenId: { in: [origenGanador, origenA] } },
					})).toBe(1);

					const retry = await prisma.$transaction(async (tx: any) => {
						const existing = await tx.asiento.findUnique({
							where: { tenantId_origenTipo_origenId: {
								tenantId: estado.tenantA, origenTipo: 'venta', origenId: origenA,
							} },
						});
						if (existing) return { estado: 'YA_EXISTENTE' as const, asientoId: existing.asientoId };
						await tx.tenant.update({
							where: { tenantId: estado.tenantA }, data: { nombre: `${nombreOriginal}-retry` },
						});
						return postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, eventoVenta(origenA));
					}, { isolationLevel: isolationLevel as Prisma.TransactionIsolationLevel });
					if (kind === 'same-origin') {
						expect(retry.estado).toBe('YA_EXISTENTE');
						expect(retry.asientoId).toBe(ganador.asientoId);
					} else {
						expect(retry.estado).toBe('CONTABILIZADO');
					}
					const asientos = await prisma.asiento.findMany({
						where: { tenantId: estado.tenantA, origenId: { in: [origenGanador, origenA] } },
						orderBy: { tenantSequence: 'asc' },
					});
					expect(asientos).toHaveLength(kind === 'same-origin' ? 1 : 2);
					if (asientos.length === 2) {
						expect(asientos[1]!.tenantSequence).toBe(asientos[0]!.tenantSequence! + BigInt(1));
						expect(asientos[1]!.hashAnterior).toBe(asientos[0]!.hash);
					}
				} finally {
					continueA();
					await transactionA;
					await prisma.tenant.update({
						where: { tenantId: estado.tenantA }, data: { nombre: nombreOriginal },
					});
				}
			},
		);

	it('mantiene el lock order cuando una transacción anterior empieza después en el lock', async () => {
		let markStarted!: () => void;
		let releaseFirst!: () => void;
		const started = new Promise<void>((resolve) => { markStarted = resolve; });
		const gate = new Promise<void>((resolve) => { releaseFirst = resolve; });
		const primeraTx = prisma.$transaction(async (tx) => {
			await tx.$queryRaw<Array<{ inicio: Date }>>`SELECT transaction_timestamp() AS inicio`;
			markStarted();
			await gate;
			return postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, eventoVenta('it-lock-order-a'));
		});
		await started;
		const segundo = await prisma.$transaction((tx) =>
			postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, eventoVenta('it-lock-order-b')),
		);
		releaseFirst();
		const primero = await primeraTx;
		const asientos = await prisma.asiento.findMany({
			where: { asientoId: { in: [primero.asientoId!, segundo.asientoId!] } },
		});
		const porSecuencia = [...asientos].sort((a, b) => Number(a.tenantSequence! - b.tenantSequence!));
		const fechasOriginales = porSecuencia.map((row) => row.createdAt);
		await prisma.asiento.update({ where: { asientoId: porSecuencia[0].asientoId }, data: { createdAt: new Date('2035-01-01T00:00:00Z') } });
		await prisma.asiento.update({ where: { asientoId: porSecuencia[1].asientoId }, data: { createdAt: new Date('2025-01-01T00:00:00Z') } });
		expect(porSecuencia[0].origenId).toBe('it-lock-order-b');
		expect(porSecuencia[1].origenId).toBe('it-lock-order-a');
		const inverted = await prisma.asiento.findMany({ where: { asientoId: { in: porSecuencia.map((row) => row.asientoId) } } });
		expect(inverted.find((row) => row.tenantSequence === porSecuencia[1].tenantSequence)!.createdAt.getTime())
			.toBeLessThan(inverted.find((row) => row.tenantSequence === porSecuencia[0].tenantSequence)!.createdAt.getTime());
		expect(porSecuencia[1].hashAnterior).toBe(porSecuencia[0].hash);
		await Promise.all(porSecuencia.map((row, index) => prisma.asiento.update({
			where: { asientoId: row.asientoId }, data: { createdAt: fechasOriginales[index] },
		})));
	});

	it('serializa orígenes distintos con numeración y hash encadenados', async () => {
			const resultados = await Promise.all(['it-venta-concurrente-a', 'it-venta-concurrente-b'].map(
				(origenId) => prisma.$transaction((tx) =>
					postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, eventoVenta(origenId)),
				),
			));
			const asientos = await prisma.asiento.findMany({
				where: { asientoId: { in: resultados.map((r) => r.asientoId!).filter(Boolean) } },
				orderBy: { numero: 'asc' },
			});
			expect(asientos).toHaveLength(2);
			expect(asientos[1].numero).toBe(asientos[0].numero + 1);
			expect(asientos[1].hashAnterior).toBe(asientos[0].hash);
		});

	it('hereda tasa y fingerprint FX en la línea TOTAL', async () => {
			const evento: EventoContableInput = {
				...eventoVenta('it-venta-fx', 'USD'),
				monedaFuncional: 'CUP',
				monto: 25,
				montoFuncional: 2500,
				tasaCambio: 100,
				fxEvidenceFingerprint: 'fx-evidence-it-2026-09',
			};
			const resultado = await prisma.$transaction((tx) =>
				postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, evento),
			);
			const asiento = await prisma.asiento.findUniqueOrThrow({
				where: { asientoId: resultado.asientoId }, include: { lineas: true },
			});
			const total = asiento.lineas.find((linea) => linea.monedaOriginal === 'USD');
			expect(total?.montoOriginal.toString()).toBe('25');
			expect(total?.tasaCambio?.toString()).toBe('100');
			expect(total?.fxEvidenceFingerprint).toBe('fx-evidence-it-2026-09');
		});

	it('revierte una operación de negocio si falta el plan contable', async () => {
			const tenant = await prisma.tenant.create({
				data: { nombre: 'Tenant CTA1 sin plan', slug: `cta1-no-plan-${Date.now()}` },
			});
			await prisma.tenantLicense.create({
				data: {
					tenantId: tenant.tenantId,
					activa: true,
					expiracion: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
					features: { 'contabilidad-formal': true },
				},
			});
			// Política CUP para que el guard fail-closed no oculte el caso bajo prueba
			// (plan contable ausente → PLAN_NO_INICIALIZADO).
			await prisma.tenantAccountingPolicy.create({
				data: { tenantId: tenant.tenantId, functionalCurrencyCode: 'CUP', updatedBy: 'u-it' },
			});

			try {
				await expect(prisma.$transaction(async (tx) => {
					await tx.tipoPago.create({ data: { tenantId: tenant.tenantId, nombre: 'Pago rollback' } });
					await postEvento(tx, { tenantId: tenant.tenantId, userId: 'u-it' }, eventoVenta('it-plan-ausente'));
				})).rejects.toMatchObject({ code: 'PLAN_NO_INICIALIZADO' });
				expect(await prisma.tipoPago.count({ where: { tenantId: tenant.tenantId } })).toBe(0);
				expect(await prisma.asiento.count({ where: { tenantId: tenant.tenantId } })).toBe(0);
			} finally {
				await prisma.tenantLicense.deleteMany({ where: { tenantId: tenant.tenantId } });
				await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId: tenant.tenantId } });
				await prisma.tenant.delete({ where: { tenantId: tenant.tenantId } });
			}
		});

	it('encadena el hash del asiento anterior del tenant y numera en secuencia', async () => {
		const previo = await prisma.asiento.findFirstOrThrow({
			where: { tenantId: estado.tenantA },
			orderBy: { createdAt: 'desc' },
		});

		const resultado = await prisma.$transaction((tx) =>
			postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, eventoVenta('it-venta-3')),
		);

		const nuevo = await prisma.asiento.findUniqueOrThrow({
			where: { asientoId: resultado.asientoId },
		});
		expect(nuevo.numero).toBe(previo.numero + 1);
		expect(nuevo.hashAnterior).toBe(previo.hash);
	});

	it('revierte la operación si el evento produce un asiento descuadrado', async () => {
		const plantilla = await prisma.plantillaAsiento.findFirstOrThrow({
			where: { evento: 'VENTA_CONTADO', orden: 2, activa: true },
		});
		try {
			await prisma.plantillaAsiento.update({
				where: { plantillaId: plantilla.plantillaId },
				data: { montoRegla: 'MONTO_PAGADO' },
			});
			await expect(prisma.$transaction(async (tx) => {
				await tx.tipoPago.create({ data: { tenantId: estado.tenantA, nombre: 'Pago descuadre' } });
				await postEvento(tx, { tenantId: estado.tenantA, userId: 'u-it' }, {
					...eventoVenta('it-asiento-desbalanceado'),
					auxiliares: { montoPagado: 900 },
				});
			})).rejects.toMatchObject({ code: 'ASIENTO_DESCUADRADO' });
			expect(await prisma.tipoPago.count({
				where: { tenantId: estado.tenantA, nombre: 'Pago descuadre' },
			})).toBe(0);
			expect(await prisma.asiento.count({
				where: { tenantId: estado.tenantA, origenId: 'it-asiento-desbalanceado' },
			})).toBe(0);
		} finally {
			await prisma.plantillaAsiento.update({
				where: { plantillaId: plantilla.plantillaId },
				data: { montoRegla: plantilla.montoRegla },
			});
		}
	});

	it('aisla los asientos por tenant', async () => {
		// crea período vigente para B
		const periodoB = await prisma.periodoContable.create({
			data: {
				tenantId: estado.tenantB,
				tipo: 'MENSUAL',
				estado: 'ABIERTO',
				fechaInicio: new Date('2026-01-01T00:00:00Z'),
				fechaFin: new Date('2026-12-31T23:59:59Z'),
			},
		});
		expect(periodoB).toBeDefined();

		const resultado = await prisma.$transaction((tx) =>
			postEvento(tx, { tenantId: estado.tenantB, userId: 'u-it' }, eventoVenta('it-venta-b1')),
		);
		expect(resultado.estado).toBe('CONTABILIZADO');

		const delTenantA = await prisma.asiento.count({
			where: { tenantId: estado.tenantA, origenId: 'it-venta-b1' },
		});
		expect(delTenantA).toBe(0);

		const delTenantB = await prisma.asiento.count({
			where: { tenantId: estado.tenantB, origenId: 'it-venta-b1' },
		});
		expect(delTenantB).toBe(1);
	});

	it('rechaza evento en período no editable', async () => {
		await expect(
			prisma.$transaction((tx) =>
				postEvento(
					tx,
					{ tenantId: estado.tenantA, userId: 'u-it' },
					{ ...eventoVenta('it-cerrada-1'), fecha: FECHA_PERIODO_CERRADO },
				),
			),
		).rejects.toMatchObject({ code: expect.stringMatching(/^PERIODO/) });

		const asientos = await prisma.asiento.count({
			where: { tenantId: estado.tenantA, origenId: 'it-cerrada-1' },
		});
		expect(asientos).toBe(0);
	});

	describe('libros desde los asientos posteados (CTA-2 T4)', () => {
		it('el libro diario lista los asientos del período con líneas', async () => {
			const { obtenerLibroDiario } = await import(
				'@/features/contabilidad-formal/services/libro-diario-service'
			);
			const resultado = await obtenerLibroDiario(tenantListado('A'), {
				periodoId: periodoVigenteId(),
			});

			expect(resultado.total).toBeGreaterThanOrEqual(3);
			expect(resultado.asientos.length).toBeGreaterThan(0);
			for (const asiento of resultado.asientos) {
				expect(asiento.totalDebe).toBeCloseTo(asiento.totalHaber, 4);
				expect(asiento.etiqueta).toMatch(/^(VTA|CMP|CAJ|BAN|NOM|AJU|APE)-\d+$/);
			}
		});

		it('el balance de comprobación cuadra los totales', async () => {
			const { obtenerBalanceComprobacion } = await import(
				'@/features/contabilidad-formal/services/balance-comprobacion-service'
			);
			const resultado = await obtenerBalanceComprobacion(tenantListado('A'), {
				periodoId: periodoVigenteId(),
			});
			expect(resultado.totales.debe).toBeCloseTo(resultado.totales.haber, 4);
			expect(resultado.totales.saldoDeudor).toBeCloseTo(resultado.totales.saldoAcreedor, 4);
			expect(resultado.filas.length).toBeGreaterThan(0);
		});

		it('el libro mayor de caja muestra saldo corrido según naturaleza', async () => {
			const { obtenerLibroMayor } = await import(
				'@/features/contabilidad-formal/services/libro-mayor-service'
			);
			const caja = await prisma.cuentaRolTenant.findFirstOrThrow({
				where: { tenantId: tenantListado('A'), rol: 'CAJA_PRINCIPAL' },
			});
			const resultado = await obtenerLibroMayor(tenantListado('A'), {
				cuentaId: caja.cuentaId,
				fechaDesde: new Date('2026-01-01').toISOString(),
				fechaHasta: new Date('2026-12-31').toISOString(),
			});
			expect(resultado.movimientos.length).toBeGreaterThan(0);
			expect(resultado.saldoFinal).toBeGreaterThan(0);
			// Saldo final = inicial + Σ(debe - haber)
			const esperado =
				resultado.saldoInicial +
				resultado.movimientos.reduce((s, m) => s + m.debe - m.haber, 0);
			expect(resultado.saldoFinal).toBeCloseTo(esperado, 4);
		});

		it('la conciliación cruzada reporta los tres rubros', async () => {
			const { obtenerConciliacionCruzada } = await import(
				'@/features/contabilidad-formal/services/conciliacion-cruzada-service'
			);
			const resultado = await obtenerConciliacionCruzada(tenantListado('A'), {});
			expect(resultado.rubros.map((r) => r.clave).sort()).toEqual(['CXC', 'CXP', 'TESORERIA']);
			expect(resultado.monedaFuncional).toBe('CUP');
		});
	});

	describe('cierre y apertura formales (CTA-3 T4)', () => {
		it('aprobar el período genera el asiento de cierre con líneas de resultado', async () => {
			const { generarAsientoCierre } = await import(
				'@/features/contabilidad-formal/services/cierre-formal-service'
			);
			const resultado = await prisma.$transaction((tx) =>
				generarAsientoCierre(tx as never, {
					periodoId: _estado.periodoVigenteA,
					tenantId: _estado.tenantA,
					actorId: 'u-it',
				}),
			);

			expect(resultado.estado).toBe('CONTABILIZADO');
			const asiento = await prisma.asiento.findFirstOrThrow({
				where: { origenTipo: 'cierre_periodo', origenId: _estado.periodoVigenteA },
				include: { lineas: true },
			});
			// Las ventas al contado del período cierran contra el resultado del período.
			const ventas = asiento.lineas.find((l) =>
				l.debe && l.debe.gt(0),
			);
			expect(ventas).toBeDefined();
			const totalDebe = asiento.lineas.reduce((s, l) => s + Number(l.debe), 0);
			const totalHaber = asiento.lineas.reduce((s, l) => s + Number(l.haber), 0);
			expect(totalDebe).toBeCloseTo(totalHaber, 4);
		});

		it('la apertura del período siguiente crea el asiento con saldos iniciales', async () => {
			const { AperturaPeriodoService } = await import(
				'@/lib/services/apertura-periodo-service'
			);
			const { generarAsientoApertura } = await import(
				'@/features/contabilidad-formal/services/cierre-formal-service'
			);
			const periodoAnterior = await prisma.periodoContable.create({
				data: {
					tenantId: _estado.tenantA,
					tipo: 'MENSUAL',
					estado: 'APROBADO',
					fechaInicio: new Date('2029-12-01T00:00:00.000Z'),
					fechaFin: new Date('2029-12-31T23:59:59.000Z'),
					resumenJson: { saldosPorMoneda: {}, totalCuentas: 0 },
				},
			});

			const periodoNuevo = await prisma.periodoContable.create({
				data: {
					tenantId: _estado.tenantA,
					tipo: 'MENSUAL',
					estado: 'ABIERTO',
					fechaInicio: new Date('2030-01-01T00:00:00.000Z'),
					fechaFin: new Date('2030-01-31T23:59:59.000Z'),
				},
			});

			await prisma.$transaction(async (tx) => {
				await AperturaPeriodoService.createAperturaPeriodo(
					periodoNuevo.periodoId,
					_estado.tenantA,
					'u-it',
					tx,
				);
			});
			const apertura = await prisma.aperturaPeriodo.findUniqueOrThrow({
				where: { periodoId: periodoNuevo.periodoId },
			});
			expect(apertura.origenPeriodoId).toBe(periodoAnterior.periodoId);

			const resultado = await prisma.$transaction((tx) =>
				generarAsientoApertura(tx as never, {
					periodoId: periodoNuevo.periodoId,
					tenantId: _estado.tenantA,
					actorId: 'u-it',
					fecha: new Date('2030-01-01T00:00:00.000Z'),
				}),
			);

			expect(['CONTABILIZADO', 'OMITIDO']).toContain(resultado.estado);
			if (resultado.estado === 'CONTABILIZADO') {
				const asiento = await prisma.asiento.findFirstOrThrow({
					where: { origenTipo: 'apertura_periodo', origenId: periodoNuevo.periodoId },
					include: { lineas: true },
				});
				expect(asiento.lineas.length).toBeGreaterThan(0);
				const debe = asiento.lineas.reduce((s, l) => s + Number(l.debe), 0);
				const haber = asiento.lineas.reduce((s, l) => s + Number(l.haber), 0);
				expect(debe).toBeCloseTo(haber, 4);
			}

			// La limpieza del período nuevo ocurre en afterAll junto al resto del tenant.
		});

		it('la cadena de hash detecta una línea alterada a propósito', async () => {
			const { verificarCadenaAsientos } = await import(
				'@/features/contabilidad-formal/services/verificador-hash-service'
			);

			// Cadena sana primero
			const sano = await verificarCadenaAsientos(_estado.tenantA);
			expect(sano.integro).toBe(true);
			expect(sano.total).toBeGreaterThan(0);

			// Alterar la primera línea del primer asiento y verificar quiebre
			const primero = await prisma.asiento.findFirstOrThrow({
				where: { tenantId: _estado.tenantA },
				orderBy: { numero: 'asc' },
				include: { lineas: true },
			});
			await prisma.asientoLinea.updateMany({
				where: { asientoId: primero.asientoId, orden: 1 },
				data: { debe: 1 },
			});

			const corrupto = await verificarCadenaAsientos(_estado.tenantA);
			expect(corrupto.integro).toBe(false);
			expect(corrupto.asientoCortadoId).toBe(primero.asientoId);
		});
	});

	describe('backfill histórico (CTA-4 T3)', () => {
		/** @description Generates and approves the exact replay snapshot using distinct managers. */
		async function approveReplay() {
			const { crearPreflightBackfill, aprobarPreflightBackfill } = await import(
				'@/features/contabilidad-formal/services/replay-backfill-service'
			);
			const preflight = await crearPreflightBackfill(_estado.tenantC, _estado.periodoHistoricoC, _estado.replayRequesterC);
			const approval = await aprobarPreflightBackfill(_estado.tenantC, preflight.replayPreflightId, _estado.replayApproverC);
			expect(approval.requestedByUserId).toBe(_estado.replayRequesterC);
			expect(approval.approvedByUserId).toBe(_estado.replayApproverC);
			expect(approval.approvedByUserId).not.toBe(approval.requestedByUserId);
			return {
				tenantId: _estado.tenantC,
				replayPreflightId: preflight.replayPreflightId,
				replayApprovalId: approval.replayApprovalId,
				actorId: _estado.replayApproverC,
			};
		}

		it('rechaza replay sin aprobación y aprobación del propio solicitante', async () => {
			const { crearPreflightBackfill, aprobarPreflightBackfill } = await import(
				'@/features/contabilidad-formal/services/replay-backfill-service'
			);
			const preflight = await crearPreflightBackfill(
				_estado.tenantC, _estado.periodoHistoricoC, _estado.replayRequesterC,
			);
			await expect(ejecutarBackfillPeriodo(
				_estado.tenantC, _estado.periodoHistoricoC, _estado.replayRequesterC,
			)).rejects.toThrow('preflight vigente y aprobado');
			await expect(aprobarPreflightBackfill(
				_estado.tenantC, preflight.replayPreflightId, _estado.replayRequesterC,
			)).rejects.toThrow('independiente');
			expect(await prisma.asiento.count({ where: { tenantId: _estado.tenantC } })).toBe(0);
			expect(await prisma.replayRun.count({ where: { tenantId: _estado.tenantC } })).toBe(0);
		});

		it('revierte todo el período cuando falla una fuente posterior', async () => {
			const tenantId = _estado.tenantC;
			const approved = await approveReplay();
			const triggerName = `posting_replay_fail_${Date.now()}`;
			const functionName = `${triggerName}_fn`;
			await prisma.$executeRawUnsafe(
				`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."origenId" = '${_estado.replaySourceIdsC[1]}' THEN RAISE EXCEPTION 'replay_later_source_failure'; END IF; RETURN NEW; END $$`,
			);
			await prisma.$executeRawUnsafe(
				`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "asientos" FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`,
			);

			try {
				await expect(ejecutarBackfillAutorizado(approved))
					.rejects.toThrow('replay_later_source_failure');
				const asientos = await prisma.asiento.count({
					where: { tenantId, periodoId: _estado.periodoHistoricoC },
				});
				expect(asientos).toBe(0);
				const failed = await prisma.replayRun.findFirstOrThrow({
					where: { tenantId, replayPreflightId: approved.replayPreflightId },
				});
				expect(failed.status).toBe('FAILED');
				expect(failed.postedCount).toBe(0);
				expect(JSON.stringify(failed.diagnostic)).toContain('replay_later_source_failure');
				expect(await prisma.asientoLinea.count({
					where: { asiento: { tenantId } },
				})).toBe(0);
			} finally {
				await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "asientos"`);
				await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
			}
		});

		it('dry-run reporta replayables por período y ejecución postea ambos', async () => {
			const { planBackfillContable } = await import(
				'@/features/contabilidad-formal/services/replay-backfill-service'
			);
			const plan = await planBackfillContable(_estado.tenantC);
			const historico = plan.periodos.find((p) => p.periodoId === _estado.periodoHistoricoC);
			expect(historico).toBeDefined();
			expect(historico!.replayables).toBe(2);
			const approved = await approveReplay();
			const resultado = await ejecutarBackfillAutorizado(approved);
			expect(resultado.contabilizados).toBe(2);

			// Los asientos quedan en el período cerrado y el libro cuadra
			const asientos = await prisma.asiento.findMany({
				where: { tenantId: _estado.tenantC, periodoId: _estado.periodoHistoricoC },
				include: { lineas: true },
			});
			expect(asientos).toHaveLength(2);
			for (const a of asientos) {
				const debe = a.lineas.reduce((sum, line) => sum.plus(line.debe), new Prisma.Decimal(0));
				const haber = a.lineas.reduce((sum, line) => sum.plus(line.haber), new Prisma.Decimal(0));
				expect(debe.eq(haber)).toBe(true);
				expect(a.replayRunId).not.toBeNull();
			}

			// La cadena del tenant está íntegra tras el replay
			const { verificarCadenaAsientos } = await import(
				'@/features/contabilidad-formal/services/verificador-hash-service'
			);
			const cadena = await verificarCadenaAsientos(_estado.tenantC);
			expect(cadena.integro).toBe(true);
		});

		it('re-ejecutar el backfill es idempotente (sin duplicados)', async () => {
			const approved = await approveReplay();
			const segunda = await ejecutarBackfillAutorizado(approved);
			expect(segunda.contabilizados).toBe(0);
			expect(segunda.yaPosteados).toBe(2);
			expect(await prisma.asiento.count({ where: { tenantId: _estado.tenantC } })).toBe(2);
			const run = await prisma.replayRun.findFirstOrThrow({
				where: { tenantId: _estado.tenantC, replayPreflightId: approved.replayPreflightId },
			});
			expect(run.status).toBe('COMPLETED');
			expect(run.postedCount).toBe(0);
		});

		it('omite la antigua fixture de gasto no verificable con una causa explícita', async () => {
			const { planBackfillContable } = await import(
				'@/features/contabilidad-formal/services/replay-backfill-service'
			);
			const source = await prisma.reconciliacionVenta.findUniqueOrThrow({
				where: { reconciliacionId: _estado.replaySourceIdsC[0] },
			});
			const invalid = await prisma.reconciliacionGasto.create({
				data: {
					tenantId: _estado.tenantC, tipoGasto: 'gasto', referenciaId: 'gasto-hist-1',
					descripcion: 'Gasto histórico no verificable',
					cuentaId: source.cuentaId, tipoPagoId: source.tipoPagoId,
					monto: 200, moneda: 'CUP', montoConvertido: 200,
					fechaReconciliacion: new Date('2026-03-05T12:00:00Z'),
					reconciliadoPor: _estado.replayRequesterC,
				},
			});
			try {
				const plan = await planBackfillContable(_estado.tenantC);
				expect(plan.omitidos).toContainEqual({
					origenTipo: 'reconciliacion_gasto', origenId: invalid.reconciliacionId,
					causa: 'TIPO_GASTO_NO_VERIFICABLE',
				});
				expect(await prisma.asiento.count({ where: { tenantId: _estado.tenantC } })).toBe(2);
			} finally {
				await prisma.reconciliacionGasto.delete({ where: { reconciliacionId: invalid.reconciliacionId } });
			}
		});
	});
});
