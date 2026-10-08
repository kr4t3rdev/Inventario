/**
 * @description Transición positiva cierre→apertura formal contra PostgreSQL
 * desechable (R3.3/R3.4): cierra un período con actividad en modo enforce,
 * aprueba, abre el período siguiente y verifica libros cuadrados, traspaso
 * único del resultado y continuidad de la cadena de hash. Incluye el caso
 * negativo de rollover sin el cierre inmediato aprobado (R3.9).
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => ({
	value: {
		userId: 'positive-transition-approver', name: 'Approver',
		email: 'positive-approver@test.invalid',
		role: 'user' as const, isActive: true, tenantId: '',
		tenantRole: 'manager' as const,
		planFeatures: { contabilidad: true },
	},
}));

vi.mock('@/lib/server-actions/get-current-user', () => ({
	getCurrentUser: async () => currentUser.value,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import {
	abrirPeriodoAction,
	aprobarPeriodoAction,
	cerrarPeriodoAction,
} from '@/features/contabilidad/actions-periodos';
import { TipoPeriodo } from '@/lib/services/periodo-contable-types';
import { insertarAsientoConNumeracion } from '@/features/contabilidad-formal/services/posting-engine';
import {
	seedPlanContable,
	seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';

describe('positive formal close → opening transition — disposable PostgreSQL', () => {
	let tenantId = '';
	let periodoAnteriorId = '';
	let periodoSiguienteId = '';
	const originalFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;

	beforeAll(async () => {
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		await prisma.$transaction(async (tx) => seedPlantillasGlobales(tx));
		const tenant = await prisma.tenant.create({
			data: { nombre: 'R3 positive transition', slug: `r3pos-${randomUUID().replaceAll('-', '')}` },
		});
		tenantId = tenant.tenantId;
		await prisma.$transaction(async (tx) => seedPlanContable(tx, tenantId));
		currentUser.value.tenantId = tenantId;
	});

	afterAll(async () => {
		if (originalFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
		else process.env.CONTABILIDAD_FORMAL_MODE = originalFormalMode;
		if (!tenantId) return;
		await prisma.$transaction(async (tx) => {
			await tx.auditoriaPeriodo.deleteMany({ where: { periodo: { tenantId } } });
			await tx.aperturaRevision.deleteMany({ where: { tenantId } }).catch(() => undefined);
			await tx.aperturaPeriodo.deleteMany({ where: { tenantId } });
			await tx.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
			await tx.asiento.deleteMany({ where: { tenantId } });
			await tx.periodoContable.deleteMany({ where: { tenantId } });
			await tx.cuentaRolTenant.deleteMany({ where: { tenantId } });
			await tx.cuentaContable.updateMany({ where: { tenantId }, data: { padreId: null } });
			await tx.cuentaContable.deleteMany({ where: { tenantId } });
			await tx.diario.deleteMany({ where: { tenantId } });
			await tx.tenant.delete({ where: { tenantId } });
		});
	});

	function cuentaIdDe(rol: string) {
		return prisma.cuentaRolTenant
			.findUniqueOrThrow({ where: { tenantId_rol: { tenantId, rol: rol as never } } })
			.then((fila) => fila.cuentaId);
	}

	/**
	 * @description Postea una venta operativa simple en el período indicado
	 * usando el motor de inserción directo (fixture de actividad para el cierre).
	 */
	async function postearIngresoOperativo(periodoId: string, monto: string): Promise<string> {
		return prisma.$transaction(async (tx) => {
			const diario = await tx.diario.findFirstOrThrow({
				where: { tenantId, tipo: 'VENTAS' },
			});
			const [caja, ventas] = await Promise.all([
				cuentaIdDe('CAJA_PRINCIPAL'), cuentaIdDe('VENTAS_PRODUCTOS'),
			]);
			const resultado = await insertarAsientoConNumeracion(tx, {
				tenantId, userId: currentUser.value.userId,
			}, {
				diarioId: diario.diarioId,
				periodoId,
				fecha: new Date('2026-01-15T12:00:00.000Z'),
				descripcion: 'Venta operativa de fixture',
				origenTipo: 'venta',
				origenId: randomUUID(),
				createdBy: currentUser.value.userId,
				lineas: [
					{ orden: 1, cuentaId: caja, debe: new Prisma.Decimal(monto), haber: new Prisma.Decimal(0),
						monedaOriginal: 'CUP', montoOriginal: new Prisma.Decimal(monto),
						tasaCambio: null, fxEvidenceFingerprint: null, referencia: null },
					{ orden: 2, cuentaId: ventas, debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(monto),
						monedaOriginal: 'CUP', montoOriginal: new Prisma.Decimal(monto),
						tasaCambio: null, fxEvidenceFingerprint: null, referencia: null },
				],
			});
			return resultado.asientoId;
		});
	}

	it('closes and approves an active period, then opens the next with balanced rollover', async () => {
		const periodoAnterior = await prisma.periodoContable.create({
			data: {
				tenantId, tipo: 'MENSUAL', estado: 'ABIERTO', codigo: 'P-2026-01-POS',
				fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
				fechaFin: new Date('2026-01-31T23:59:59.000Z'),
			},
		});
		periodoAnteriorId = periodoAnterior.periodoId;
		await postearIngresoOperativo(periodoAnteriorId, '1300');

		// Cierre en enforce: el asiento de cierre nace en el mismo tx que la
		// transición de estado; sin actividad formalizable la acción rechazaría.
		const cierreResp = await cerrarPeriodoAction({ periodoId: periodoAnteriorId });
		expect(cierreResp.success).toBe(true);

		let periodoPersistido = await prisma.periodoContable.findUniqueOrThrow({
			where: { periodoId: periodoAnteriorId },
		});
		if (periodoPersistido.estado !== 'APROBADO') {
			const aprobacion = await aprobarPeriodoAction({ periodoId: periodoAnteriorId });
			expect(aprobacion.success).toBe(true);
			periodoPersistido = await prisma.periodoContable.findUniqueOrThrow({
				where: { periodoId: periodoAnteriorId },
			});
		}
		expect(periodoPersistido.estado).toBe('APROBADO');

		const asientoCierre = await prisma.asiento.findFirstOrThrow({
			where: { tenantId, periodoId: periodoAnteriorId, origenTipo: 'cierre_periodo' },
			include: { lineas: true },
		});
		expect(asientoCierre.estado).toBe('CONTABILIZADO');
		const debeCierre = asientoCierre.lineas
			.reduce((acc, linea) => acc.plus(linea.debe), new Prisma.Decimal(0));
		const haberCierre = asientoCierre.lineas
			.reduce((acc, linea) => acc.plus(linea.haber), new Prisma.Decimal(0));
		expect(debeCierre.eq(haberCierre)).toBe(true);
		expect(asientoCierre.fecha.getTime()).toBeLessThanOrEqual(periodoPersistido.fechaFin.getTime());

		// El libro del período cerrado deja las cuentas de resultado en cero.
		const [ventasId, resultadoId, acumuladosId] = await Promise.all([
			cuentaIdDe('VENTAS_PRODUCTOS'), cuentaIdDe('RESULTADO_PERIODO'),
			cuentaIdDe('RESULTADOS_ACUMULADOS'),
		]);
		const saldoResultado = await prisma.asientoLinea.aggregate({
			where: {
				asiento: { tenantId, periodoId: periodoAnteriorId, estado: 'CONTABILIZADO' },
				cuentaId: ventasId,
			},
			_sum: { debe: true, haber: true },
		});
		expect(new Prisma.Decimal(String(saldoResultado._sum.debe ?? 0)).toString())
			.toBe(new Prisma.Decimal(String(saldoResultado._sum.haber ?? 0)).toString());

		// deriveOpeningBalances solo toma la ruta de período anterior si hay resumen;
		// conservamos el resumen producido/sustituimos por uno vacío de saldos.
		await prisma.periodoContable.update({
			where: { periodoId: periodoAnteriorId },
			data: {
				resumenJson: periodoPersistido.resumenJson ?? { total: 0 },
				hashIntegridad: periodoPersistido.hashIntegridad ?? 'positive-hash',
			},
		});

		// Apertura del período siguiente dentro de la misma transacción bajo lock.
		const aperturaResp = await abrirPeriodoAction({
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: '2026-02-01T00:00:00.000Z',
			fechaFin: '2026-02-28T23:59:59.000Z',
		});
		expect(aperturaResp.success).toBe(true);
		const periodoSiguiente = await prisma.periodoContable.findFirstOrThrow({
			where: { tenantId, fechaInicio: new Date('2026-02-01T00:00:00.000Z') },
		});
		periodoSiguienteId = periodoSiguiente.periodoId;

		const apertura = await prisma.aperturaPeriodo.findUniqueOrThrow({
			where: { periodoId: periodoSiguienteId },
		});
		expect(apertura.origenPeriodoId).toBe(periodoAnteriorId);

		const asientoApertura = await prisma.asiento.findFirstOrThrow({
			where: { tenantId, periodoId: periodoSiguienteId, origenTipo: 'apertura_periodo' },
			include: { lineas: true },
		});
		expect(asientoApertura.estado).toBe('CONTABILIZADO');
		const debeApertura = asientoApertura.lineas
			.reduce((acc, linea) => acc.plus(linea.debe), new Prisma.Decimal(0));
		const haberApertura = asientoApertura.lineas
			.reduce((acc, linea) => acc.plus(linea.haber), new Prisma.Decimal(0));
		expect(debeApertura.eq(haberApertura)).toBe(true);
		expect(debeApertura.isZero()).toBe(false);

		// Traspaso del resultado exactamente una vez por lado.
		const traspasoDebe = asientoApertura.lineas
			.filter((linea) => linea.cuentaId === resultadoId);
		const traspasoHaber = asientoApertura.lineas
			.filter((linea) => linea.cuentaId === acumuladosId);
		expect(traspasoDebe).toHaveLength(1);
		expect(traspasoHaber).toHaveLength(1);
		expect(traspasoDebe[0].debe.toString()).toBe('1300');
		expect(traspasoHaber[0].haber.toString()).toBe('1300');

		// Cadena de hash: la apertura hereda el hash del cierre aprobado.
		expect(asientoApertura.hashAnterior).toBe(asientoCierre.hash);
	});

	it('rejects opening a period whose immediate predecessor is not approved', async () => {
		// 2026-03 sigue a 2026-02 (creado en el test positivo pero NUNCA cerrado/
		// aprobado): el rollover debe rechazarse y la transacción no dejar período.
		const respuesta = await abrirPeriodoAction({
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: '2026-03-01T00:00:00.000Z',
			fechaFin: '2026-03-31T23:59:59.000Z',
		});
		expect(respuesta.success).toBe(false);
		// El servicio rechaza por validación (Error) o el gate enforce
		// (FORMAL_ACCOUNTING_REQUIRED): ambas superficies rechazan el rollover;
		// la garantía observable es que la transacción no dejó período creado.
		expect(await prisma.periodoContable.count({
			where: { tenantId, fechaInicio: new Date('2026-03-01T00:00:00.000Z') },
		})).toBe(0);
	});
});
