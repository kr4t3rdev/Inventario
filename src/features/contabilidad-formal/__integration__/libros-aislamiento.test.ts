/**
 * @description R6.3 — lecturas cruzadas de libros con dos tenants reales en
 * PostgreSQL desechable: un asiento de un tenant nunca aparece en el diario,
 * mayor ni balance de comprobación del otro, aun conociendo el período.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { obtenerBalanceComprobacion } from '@/features/contabilidad-formal/services/balance-comprobacion-service';
import { obtenerLibroDiario } from '@/features/contabilidad-formal/services/libro-diario-service';
import { insertarAsientoConNumeracion } from '@/features/contabilidad-formal/services/posting-engine';
import {
	seedPlanContable,
	seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';

describe('libros — aislamiento entre dos tenants (R6.3)', { timeout: 60_000 }, () => {
	let tenantA = '';
	let tenantB = '';
	let periodoAId = '';
	let periodoBId = '';
	let asientoAId = '';

	beforeAll(async () => {
		const suffix = randomUUID().replaceAll('-', '');
		await prisma.$transaction(async (tx) => seedPlantillasGlobales(tx));
		const [a, b] = await Promise.all([
			prisma.tenant.create({ data: { nombre: 'Libros A', slug: `libros-a-${suffix}` } }),
			prisma.tenant.create({ data: { nombre: 'Libros B', slug: `libros-b-${suffix}` } }),
		]);
		tenantA = a.tenantId;
		tenantB = b.tenantId;
		for (const tenantId of [tenantA, tenantB]) {
			await prisma.$transaction(async (tx) => seedPlanContable(tx, tenantId));
			await prisma.tenantLicense.create({
				data: {
					tenantId,
					expiracion: new Date('2099-01-01'),
					features: { 'contabilidad-formal': true },
				},
			});
		}
		const [pa, pb] = await Promise.all([
			prisma.periodoContable.create({
				data: {
					tenantId: tenantA, tipo: 'MENSUAL', estado: 'ABIERTO', codigo: `A-${suffix.slice(0, 8)}`,
					fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
					fechaFin: new Date('2026-10-31T23:59:59.000Z'),
				},
			}),
			prisma.periodoContable.create({
				data: {
					tenantId: tenantB, tipo: 'MENSUAL', estado: 'ABIERTO', codigo: `B-${suffix.slice(0, 8)}`,
					fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
					fechaFin: new Date('2026-10-31T23:59:59.000Z'),
				},
			}),
		]);
		periodoAId = pa.periodoId;
		periodoBId = pb.periodoId;

		// Asiento operativo solo en el tenant A.
		const [cajaA, capitalA] = await Promise.all([
			prisma.cuentaRolTenant.findUniqueOrThrow({
				where: { tenantId_rol: { tenantId: tenantA, rol: 'CAJA_PRINCIPAL' } },
			}).then((r) => r.cuentaId),
			prisma.cuentaRolTenant.findUniqueOrThrow({
				where: { tenantId_rol: { tenantId: tenantA, rol: 'CAPITAL_SOCIAL' } },
			}).then((r) => r.cuentaId),
		]);
		const diarioA = await prisma.diario.findFirstOrThrow({
			where: { tenantId: tenantA, tipo: 'APERTURA_CIERRE' },
		});
		const asiento = await prisma.$transaction(async (tx) => {
			const creado = await insertarAsientoConNumeracion(tx, {
				tenantId: tenantA, userId: 'tenant-a-actor',
			}, {
				diarioId: diarioA.diarioId,
				periodoId: periodoAId,
				fecha: new Date('2026-10-02T12:00:00.000Z'),
				descripcion: 'Capital inicial A',
				origenTipo: 'apertura_revision',
				origenId: randomUUID(),
				createdBy: 'tenant-a-actor',
				lineas: [
					{ orden: 1, cuentaId: cajaA, debe: new Prisma.Decimal(500), haber: new Prisma.Decimal(0),
						monedaOriginal: 'CUP', montoOriginal: new Prisma.Decimal(500),
						tasaCambio: null, fxEvidenceFingerprint: null, referencia: null },
					{ orden: 2, cuentaId: capitalA, debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(500),
						monedaOriginal: 'CUP', montoOriginal: new Prisma.Decimal(500),
						tasaCambio: null, fxEvidenceFingerprint: null, referencia: null },
				],
			});
			return creado;
		});
		asientoAId = asiento.asientoId;
	});

	afterAll(async () => {
		for (const tenantId of [tenantA, tenantB]) {
			if (!tenantId) continue;
			await prisma.asiento.deleteMany({ where: { tenantId } });
			await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
			await prisma.cuentaContable.updateMany({ where: { tenantId }, data: { padreId: null } });
			await prisma.cuentaContable.deleteMany({ where: { tenantId } });
			await prisma.diario.deleteMany({ where: { tenantId } });
			await prisma.tenantLicense.deleteMany({ where: { tenantId } });
			await prisma.periodoContable.deleteMany({ where: { tenantId } });
			await prisma.tenant.delete({ where: { tenantId } }).catch(() => undefined);
		}
	});

	it('el libro diario del tenant A contiene su asiento y el del tenant B está vacío', async () => {
		const diarioA = await obtenerLibroDiario(tenantA, { periodoId: periodoAId } as never);
		expect(diarioA.asientos.some((a: { asientoId: string }) => a.asientoId === asientoAId)).toBe(true);

		const diarioB = await obtenerLibroDiario(tenantB, { periodoId: periodoBId } as never);
		expect(diarioB.asientos).toHaveLength(0);
	});

	it('el tenant A no lee el período del tenant B ni su propio asiento con período ajeno', async () => {
		// El período de B existe, pero pertenece a B: la lectura con tenant A debe
		// quedar vacía aun mezclando periodoId ajeno.
		const mezclado = await obtenerLibroDiario(tenantA, { periodoId: periodoBId } as never);
		expect(mezclado.asientos).toHaveLength(0);
	});

	it('el balance de comprobación del tenant B no muestra las cuentas movidas del A', async () => {
		const aBalance = await obtenerBalanceComprobacion(tenantA, { periodoId: periodoAId });
		expect(aBalance.filas.length).toBeGreaterThan(0);
		expect(aBalance.totales.debe).toBe(500);
		expect(aBalance.totales.haber).toBe(500);

		const bBalance = await obtenerBalanceComprobacion(tenantB, { periodoId: periodoBId });
		expect(bBalance.filas).toHaveLength(0);
		expect(bBalance.totales.debe).toBe(0);
	});
});
