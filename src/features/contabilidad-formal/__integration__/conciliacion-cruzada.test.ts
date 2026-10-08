/**
 * @description Verifica la conciliación cruzada contra PostgreSQL desechable:
 * moneda funcional, saldos bancarios extranjeros, corte parcial y aislamiento.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { seedPlanContable } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { obtenerConciliacionCruzada } from '@/features/contabilidad-formal/services/conciliacion-cruzada-service';
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';

interface Fixture {
	tenantId: string;
	periodoId: string;
	cuentaBancariaId: string;
}

describe('conciliación cruzada — integración PostgreSQL', { timeout: 60_000 }, () => {
	const fixtures: Fixture[] = [];
	let fixtureA: Fixture;
	let creoMonedaCUP = false;

	async function crearFixture(nombre: string, saldo: number): Promise<Fixture> {
		const tenant = await prisma.tenant.create({
			data: { nombre, slug: `conciliacion-${crypto.randomUUID()}` },
		});
		fixtures.push({ tenantId: tenant.tenantId, periodoId: '', cuentaBancariaId: '' });

		await prisma.tenantAccountingPolicy.create({
			data: {
				tenantId: tenant.tenantId,
				functionalCurrencyCode: 'CUP',
				updatedBy: 'conciliacion-it',
			},
		});
		await prisma.$transaction((tx) => seedPlanContable(tx, tenant.tenantId));

		const periodo = await prisma.periodoContable.create({
			data: {
				tenantId: tenant.tenantId,
				tipo: 'MENSUAL',
				estado: 'ABIERTO',
				codigo: `IT-${crypto.randomUUID().slice(0, 8)}`,
				fechaInicio: new Date('2026-01-01T00:00:00Z'),
				fechaFin: new Date('2026-12-31T23:59:59Z'),
			},
		});
		const cuentaBancaria = await prisma.cuentaBancaria.create({
			data: {
				tenantId: tenant.tenantId,
				nombreBanco: 'Banco conciliación',
				numeroCuenta: `IT-${crypto.randomUUID()}`,
				tipoCuenta: 'CORRIENTE',
				saldo,
				moneda: 'CUP',
			},
		});

		const roles = await prisma.cuentaRolTenant.findMany({
			where: { tenantId: tenant.tenantId },
			select: { rol: true, cuentaId: true },
		});
		const cuentaCaja = roles.find((rol) => rol.rol === 'CAJA_PRINCIPAL')?.cuentaId;
		const cuentaVentas = roles.find((rol) => rol.rol === 'VENTAS_PRODUCTOS')?.cuentaId;
		const diario = await prisma.diario.findFirstOrThrow({
			where: { tenantId: tenant.tenantId, codigo: 'CAJ' },
		});
		if (!cuentaCaja || !cuentaVentas) throw new Error('roles contables incompletos');

		await prisma.asiento.create({
			data: {
				tenantId: tenant.tenantId,
				diarioId: diario.diarioId,
				periodoId: periodo.periodoId,
				numero: 1,
				fecha: new Date('2026-01-15T12:00:00Z'),
				descripcion: 'Saldo bancario de conciliación',
				origenTipo: 'conciliacion_it',
				origenId: crypto.randomUUID(),
				hash: 'a'.repeat(64),
				createdBy: 'conciliacion-it',
				lineas: {
					create: [
						{
							orden: 1,
							cuentaId: cuentaCaja,
							debe: saldo,
							haber: 0,
							monedaOriginal: 'CUP',
							montoOriginal: saldo,
						},
						{
							orden: 2,
							cuentaId: cuentaVentas,
							debe: 0,
							haber: saldo,
							monedaOriginal: 'CUP',
							montoOriginal: saldo,
						},
					],
				},
			},
		});

		fixtures[fixtures.length - 1].periodoId = periodo.periodoId;
		fixtures[fixtures.length - 1].cuentaBancariaId = cuentaBancaria.cuentaId;
		return fixtures[fixtures.length - 1];
	}

	async function crearSaldosConciliables(fixture: Fixture, pagoNominal: string): Promise<void> {
		const roles = await prisma.cuentaRolTenant.findMany({
			where: { tenantId: fixture.tenantId },
			select: { rol: true, cuentaId: true },
		});
		const account = (role: string) => roles.find((row) => row.rol === role)?.cuentaId;
		const cxcId = account('CXC_CLIENTES');
		const ventasId = account('VENTAS_PRODUCTOS');
		const cxpId = account('CXP_PROVEEDORES');
		const gastosId = account('GASTOS_OPERATIVOS');
		const diario = await prisma.diario.findFirstOrThrow({
			where: { tenantId: fixture.tenantId, codigo: 'CAJ' },
		});
		if (!cxcId || !ventasId || !cxpId || !gastosId) {
			throw new Error('roles para CxC/CxP incompletos');
		}

		const cliente = await prisma.cliente.create({
			data: { tenantId: fixture.tenantId, nombre: 'Cliente conciliación' },
		});
		const fx = buildAppliedFxEvidenceExact({
			originalAmount: '100',
			originalCurrency: 'USD',
			functionalCurrency: 'CUP',
			exchangeRate: '25',
			convertedAmount: '2500',
			rateEffectiveAt: new Date('2026-01-15T12:00:00Z'),
			source: 'integration-test',
			fxProvenanceKind: 'MANUAL_GOVERNED',
		});
		await prisma.cuentaPorCobrar.create({
			data: {
				tenantId: fixture.tenantId,
				clienteId: cliente.clienteId,
				montoDeuda: '100',
				montoPagado: pagoNominal,
				montoOriginal: '100',
				montoDeudaFuncional: '2500',
				montoPagadoFuncional: '1200',
				monedaOriginal: 'USD',
				monedaFuncional: 'CUP',
				tasaCambio: '25',
				fxEvidenceFingerprint: fx.evidence.fxEvidenceFingerprint,
				fxEvidenceVersion: fx.evidence.fxEvidenceVersion,
				rateEffectiveAt: fx.rateEffectiveAt,
				fxProvenanceKind: fx.evidence.fxProvenanceKind,
				fxProvenanceSource: fx.evidence.fxProvenanceSource,
				fxEvidenceJson: fx.evidence as never,
				estado: 'PARCIAL',
			},
		});
		await prisma.cuentaPorPagar.create({
			data: {
				tenantId: fixture.tenantId,
				numeroFactura: `IT-CXP-${crypto.randomUUID()}`,
				montoDeuda: '390',
				montoPagado: '0',
				saldoPendiente: '390',
				moneda: 'CUP',
				tipo: 'compra',
			},
		});

		for (const [numero, cuentaId, contraId, importe, lado] of [
			[2, cxcId, ventasId, '1500', 'debe'],
			[3, gastosId, cxpId, '390', 'debe'],
		] as [number, string, string, string, 'debe' | 'haber'][]) {
			await prisma.asiento.create({
				data: {
					tenantId: fixture.tenantId,
					diarioId: diario.diarioId,
					periodoId: fixture.periodoId,
					numero,
					fecha: new Date('2026-01-20T12:00:00Z'),
					descripcion: 'Saldo de cartera para conciliación',
					origenTipo: 'conciliacion_r42_it',
					origenId: crypto.randomUUID(),
					hash: (numero === 2 ? 'b' : 'c').repeat(64),
					createdBy: 'conciliacion-it',
					lineas: {
						create: [
							{ orden: 1, cuentaId, debe: lado === 'debe' ? importe : 0, haber: lado === 'haber' ? importe : 0, monedaOriginal: 'CUP', montoOriginal: importe },
							{ orden: 2, cuentaId: contraId, debe: lado === 'haber' ? importe : 0, haber: lado === 'debe' ? importe : 0, monedaOriginal: 'CUP', montoOriginal: importe },
						],
					},
				},
			});
		}
	}

	beforeAll(async () => {
		const cup = await prisma.moneda.findUnique({ where: { codigo: 'CUP' } });
		if (!cup) {
			await prisma.moneda.create({
				data: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' },
			});
			creoMonedaCUP = true;
		}
		fixtureA = await crearFixture('Conciliación A', 100);
	});

	afterAll(async () => {
		for (const fixture of fixtures) {
			await prisma.asiento.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.cuentaPorPagar.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.cliente.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.cuentaBancaria.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.cuentaRolTenant.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.cuentaContable.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.diario.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.periodoContable.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.tenant.delete({ where: { tenantId: fixture.tenantId } });
		}
		if (creoMonedaCUP) await prisma.moneda.delete({ where: { codigo: 'CUP' } });
	});

	it('concilia un saldo CUP real y no mezcla datos de otro tenant', async () => {
		const fixtureB = await crearFixture('Conciliación B', 999);

		const resultadoA = await obtenerConciliacionCruzada(fixtureA.tenantId, {});
		const resultadoB = await obtenerConciliacionCruzada(fixtureB.tenantId, {});
		const tesoreriaA = resultadoA.rubros.find((r) => r.clave === 'TESORERIA');
		const tesoreriaB = resultadoB.rubros.find((r) => r.clave === 'TESORERIA');

		expect(tesoreriaA).toMatchObject({ saldoLibros: '100', saldoOperativo: '100', diferencia: '0', estado: 'OK' });
		expect(tesoreriaB).toMatchObject({ saldoLibros: '999', saldoOperativo: '999', diferencia: '0', estado: 'OK' });
		expect(resultadoA.estado).toBe('NO_EVALUABLE');
		expect(resultadoA.enforceReady).toBe(false);
	});

	it('bloquea tesorería cuando hay saldo extranjero activo sin valoración funcional', async () => {
		const fixture = await crearFixture('Conciliación FX', 100);
		await prisma.cuentaBancaria.create({
			data: {
				tenantId: fixture.tenantId,
				nombreBanco: 'Banco USD',
				numeroCuenta: `USD-${crypto.randomUUID()}`,
				tipoCuenta: 'CORRIENTE',
				saldo: 10,
				moneda: 'USD',
			},
		});

		const resultado = await obtenerConciliacionCruzada(fixture.tenantId, {});
		const tesoreria = resultado.rubros.find((r) => r.clave === 'TESORERIA');

		expect(tesoreria).toMatchObject({ estado: 'NO_EVALUABLE', saldoOperativo: '100' });
		expect(tesoreria?.nota).toMatch(/moneda distinta de la funcional/i);
		expect(resultado.estado).toBe('NO_EVALUABLE');
		expect(resultado.enforceReady).toBe(false);
	});

	it('compara CxC y CxP con cobertura funcional verificable y asignación exacta del valor libro', async () => {
		const fixture = await crearFixture('Conciliación de cartera', 100);
		await crearSaldosConciliables(fixture, '40');

		const resultado = await obtenerConciliacionCruzada(fixture.tenantId, {});

		expect(resultado.rubros.find((r) => r.clave === 'CXC')).toMatchObject({
			saldoLibros: '1500', saldoOperativo: '1500', diferencia: '0', estado: 'OK',
		});
		expect(resultado.rubros.find((r) => r.clave === 'CXP')).toMatchObject({
			saldoLibros: '390', saldoOperativo: '390', diferencia: '0', estado: 'OK',
		});
	});

	it('retiene una diferencia Decimal exacta y bloquea CxP con moneda de pago desconocida', async () => {
		const fixture = await crearFixture('Conciliación cartera parcial', 100);
		await crearSaldosConciliables(fixture, '39.99');
		await prisma.cuentaPorPagar.updateMany({
			where: { tenantId: fixture.tenantId },
			data: { montoDeuda: '500', montoPagado: '110', saldoPendiente: '390' },
		});

		const resultado = await obtenerConciliacionCruzada(fixture.tenantId, {});

		expect(resultado.rubros.find((r) => r.clave === 'CXC')).toMatchObject({
			saldoOperativo: '1500.25', diferencia: '-0.25', estado: 'DIFERENCIA',
		});
		expect(resultado.rubros.find((r) => r.clave === 'CXP')).toMatchObject({
			saldoOperativo: null, diferencia: null, estado: 'NO_EVALUABLE',
		});
		expect(resultado.enforceReady).toBe(false);
	});

	it('oculta importes cuando se solicita un corte parcial sin cobertura temporal', async () => {
		const resultado = await obtenerConciliacionCruzada(fixtureA.tenantId, {
			fechaHasta: new Date('2026-01-31T23:59:59Z'),
		});

		expect(resultado.estado).toBe('NO_EVALUABLE');
		expect(resultado.enforceReady).toBe(false);
		expect(resultado.rubros.every((r) =>
			r.saldoLibros === null && r.saldoOperativo === null && r.diferencia === null,
		)).toBe(true);
	});

});
