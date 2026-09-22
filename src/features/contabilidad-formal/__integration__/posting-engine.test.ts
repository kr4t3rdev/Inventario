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
});
