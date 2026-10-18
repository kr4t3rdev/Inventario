/**
 * @description Contratos del seed del plan de cuentas (CTA-0 T1).
 * El servicio recibe un `tx` (transacción Prisma) y persiste diarios, cuentas
 * y mapeo de roles con upserts idempotentes: nunca create/createMany, los
 * padres se insertan antes que los hijos y los roles se resuelven a los ids
 * de cuenta generados. Se mockea el tx completo (barrera MM-B: nada de prisma
 * real en unitarios).
 */
import { describe, expect, it, vi } from 'vitest';

import {
	seedPlanContable,
	seedPlantillasGlobales,
	type SeedTx,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import {
	CUENTAS_PLAN_DEFAULT,
	DIARIOS_DEFAULT,
	PLANTILLAS_DEFAULT,
	ROLES_CUENTA_DEFAULT,
	padreDeCodigo,
} from '@/features/contabilidad-formal/lib/plan-default';

const TENANT_ID = 'tenant-test-1';

interface UpsertCall {
	where: Record<string, unknown>;
	create: Record<string, unknown>;
	update: Record<string, unknown>;
}

/**
 * @description Construye un tx mockeado cuyos upserts de cuentas devuelven ids
 * derivados del código (`cta-<codigo>`) para verificar la resolución padre/hijo
 * y el mapeo de roles.
 */
function crearTxMock(): {
	tx: SeedTx;
	llamadasCuentas: UpsertCall[];
	llamadasDiarios: UpsertCall[];
	llamadasRoles: UpsertCall[];
	llamadasPlantillas: UpsertCall[];
} {
	const llamadasCuentas: UpsertCall[] = [];
	const llamadasDiarios: UpsertCall[] = [];
	const llamadasRoles: UpsertCall[] = [];
	const llamadasPlantillas: UpsertCall[] = [];

	const tx: SeedTx = {
		diario: {
			upsert: vi.fn(async (args: UpsertCall) => {
				llamadasDiarios.push(args);
				return { diarioId: `dia-${(args.create as { codigo: string }).codigo}` };
			}),
		},
		cuentaContable: {
			upsert: vi.fn(async (args: UpsertCall) => {
				llamadasCuentas.push(args);
				return { cuentaContableId: `cta-${(args.create as { codigo: string }).codigo}` };
			}),
		},
		cuentaRolTenant: {
			upsert: vi.fn(async (args: UpsertCall) => {
				llamadasRoles.push(args);
				return { cuentaRolId: `rol-${(args.create as { rol: string }).rol}` };
			}),
		},
		plantillaAsiento: {
			upsert: vi.fn(async (args: UpsertCall) => {
				llamadasPlantillas.push(args);
				return { plantillaId: 'tpl-1' };
			}),
		},
	};

	return { tx, llamadasCuentas, llamadasDiarios, llamadasRoles, llamadasPlantillas };
}

describe('seedPlanContable', () => {
	it('rechaza tenant vacío antes de tocar la base de datos', async () => {
		const { tx, llamadasCuentas } = crearTxMock();
		await expect(seedPlanContable(tx, '')).rejects.toThrow();
		expect(llamadasCuentas).toHaveLength(0);
	});

	it('siembra los 7 diarios con upserts tenant-scoped', async () => {
		const { tx, llamadasDiarios } = crearTxMock();
		await seedPlanContable(tx, TENANT_ID);
		expect(llamadasDiarios).toHaveLength(7);
		expect(llamadasDiarios).toHaveLength(DIARIOS_DEFAULT.length);
		for (const llamada of llamadasDiarios) {
			expect(JSON.stringify(llamada.where)).toContain(TENANT_ID);
			expect(llamada.create.tenantId).toBe(TENANT_ID);
		}
	});

	it('siembra todas las cuentas del plan con tenantId y padres antes que hijos', async () => {
		const { tx, llamadasCuentas } = crearTxMock();
		const resultado = await seedPlanContable(tx, TENANT_ID);
		expect(resultado.cuentas).toBe(CUENTAS_PLAN_DEFAULT.length);
		expect(llamadasCuentas).toHaveLength(CUENTAS_PLAN_DEFAULT.length);

		const ordenPorCodigo = new Map<string, number>();
		llamadasCuentas.forEach((llamada, index) => {
			const create = llamada.create as { codigo: string; tenantId: string; padre?: unknown };
			expect(create.tenantId).toBe(TENANT_ID);
			ordenPorCodigo.set(create.codigo, index);
		});
		for (const cuenta of CUENTAS_PLAN_DEFAULT) {
			const padre = padreDeCodigo(cuenta.codigo);
			if (!padre) continue;
			expect(
				ordenPorCodigo.get(padre)!,
				`padre ${padre} debe insertarse antes que ${cuenta.codigo}`,
			).toBeLessThan(ordenPorCodigo.get(cuenta.codigo)!);
		}
	});

	it('conecta cada hija con su padre vía FK escalar', async () => {
		const { tx, llamadasCuentas } = crearTxMock();
		await seedPlanContable(tx, TENANT_ID);
		for (const llamada of llamadasCuentas) {
			const create = llamada.create as { codigo: string; padreId?: string };
			const padre = padreDeCodigo(create.codigo);
			if (!padre) {
				expect(create.padreId, `${create.codigo} no debe tener padreId`).toBeUndefined();
			} else {
				expect(create.padreId).toBe(`cta-${padre}`);
			}
		}
	});

	it('mapea los 23 roles a las cuentas hoja resueltas', async () => {
		const { tx, llamadasRoles } = crearTxMock();
		const resultado = await seedPlanContable(tx, TENANT_ID);
		expect(resultado.roles).toBe(23);
		expect(llamadasRoles).toHaveLength(23);
		for (const llamada of llamadasRoles) {
			const create = llamada.create as { rol: string; cuentaId: string; tenantId: string };
			expect(create.tenantId).toBe(TENANT_ID);
			const codigoEsperado = ROLES_CUENTA_DEFAULT[create.rol as keyof typeof ROLES_CUENTA_DEFAULT];
			expect(codigoEsperado, `rol ${create.rol} sin mapeo por defecto`).toBeDefined();
			expect(create.cuentaId).toBe(`cta-${codigoEsperado}`);
		}
	});

	it('es idempotente: una segunda ejecución usa los mismos upserts', async () => {
		const { tx, llamadasCuentas } = crearTxMock();
		const primero = await seedPlanContable(tx, TENANT_ID);
		const segundo = await seedPlanContable(tx, TENANT_ID);
		expect(segundo).toEqual(primero);
		expect(llamadasCuentas).toHaveLength(CUENTAS_PLAN_DEFAULT.length * 2);
		const unicosPrimera = new Set(
			llamadasCuentas
				.slice(0, CUENTAS_PLAN_DEFAULT.length)
				.map((llamada) => JSON.stringify(llamada.where)),
		);
		expect(unicosPrimera.size).toBe(CUENTAS_PLAN_DEFAULT.length);
	});
});

describe('seedPlantillasGlobales', () => {
	it('siembra todas las líneas de plantilla como datos globales', async () => {
		const { tx, llamadasPlantillas } = crearTxMock();
		const resultado = await seedPlantillasGlobales(tx);
		expect(resultado.plantillas).toBe(PLANTILLAS_DEFAULT.length);
		expect(llamadasPlantillas).toHaveLength(PLANTILLAS_DEFAULT.length);
		for (const llamada of llamadasPlantillas) {
			expect(JSON.stringify(llamada.where)).toContain('evento');
			expect(JSON.stringify(llamada.where)).toContain('orden');
		}
	});
});
