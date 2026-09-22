/**
 * @description Integración real del motor de asientos (CTA-1 T3) contra la base
 * desechable `tcp_test_local`: cuadre persistido, idempotencia por origen,
 * numeración y cadena de hash por tenant, aislamiento entre tenants, y rechazo
 * gobernado cuando el período no es editable.
 * Corre solo con vitest.integration.config.mjs (DB real).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import {
	seedPlanContable,
	seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import {
	postEvento,
	type EventoContableInput,
} from '@/features/contabilidad-formal/services/posting-engine';

const FECHA_VIGENTE = new Date('2026-09-21T15:00:00Z');
const FECHA_PERIODO_CERRADO = new Date('2020-06-15T12:00:00Z');

interface EstadoSuite {
	tenantA: string;
	tenantB: string;
	periodoVigenteA: string;
	periodoCerradoA: string;
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
		periodoVigenteA: '',
		periodoCerradoA: '',
	};

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
		estado.tenantA = tA.tenantId;
		estado.tenantB = tB.tenantId;
		_estado = estado;

		for (const tenantId of [estado.tenantA, estado.tenantB]) {
			await prisma.$transaction(async (tx) => {
				await seedPlanContable(tx, tenantId);
			});
		}

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
			for (const tenantId of [estado.tenantA, estado.tenantB]) {
				if (!tenantId) continue;
				await prisma.asiento.deleteMany({ where: { tenantId } });
				await prisma.aperturaPeriodo.deleteMany({ where: { tenantId } });
				await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
			await prisma.cuentaContable.deleteMany({ where: { tenantId } });
			await prisma.diario.deleteMany({ where: { tenantId } });
			await prisma.periodoContable.deleteMany({ where: { tenantId } });
			await prisma.periodoCache.deleteMany({ where: { tenantId } });
			await prisma.tenant.delete({ where: { tenantId } }).catch(() => undefined);
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

		const debe = asiento.lineas.reduce((acc, l) => acc + Number(l.debe), 0);
		const haber = asiento.lineas.reduce((acc, l) => acc + Number(l.haber), 0);
		expect(debe).toBe(1000);
		expect(haber).toBe(1000);
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

			const periodoNuevo = await prisma.periodoContable.create({
				data: {
					tenantId: _estado.tenantA,
					tipo: 'MENSUAL',
					estado: 'ABIERTO',
					fechaInicio: new Date('2027-01-01'),
					fechaFin: new Date('2027-01-31T23:59:59Z'),
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

			const resultado = await prisma.$transaction((tx) =>
				generarAsientoApertura(tx as never, {
					periodoId: periodoNuevo.periodoId,
					tenantId: _estado.tenantA,
					actorId: 'u-it',
					fecha: new Date('2027-01-01T00:00:00Z'),
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
});
