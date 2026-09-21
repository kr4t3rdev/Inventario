/**
 * @description Seed idempotente del plan de cuentas por tenant (CTA-0).
 * Persiste diarios, cuentas (padres antes que hijas, con conexión de jerarquía)
 * y el mapeo de roles semánticos mediante upserts — re-ejecutarlo nunca
 * duplica. Las plantillas son datos globales de plataforma
 * (`seedPlantillasGlobales`), independientes del tenant.
 * @module src/features/contabilidad-formal/services/seed-plan-contable
 */

import {
	CUENTAS_PLAN_DEFAULT,
	DIARIOS_DEFAULT,
	PLANTILLAS_DEFAULT,
	ROLES_CUENTA_DEFAULT,
	padreDeCodigo,
} from '@/features/contabilidad-formal/lib/plan-default';

/** Argumentos mínimos de un upsert compatibles con Prisma. */
export interface SeedUpsertArgs {
	where: Record<string, unknown>;
	create: Record<string, unknown>;
	update: Record<string, unknown>;
}

/**
 * @description Subconjunto del cliente/transacción Prisma que el seed necesita.
 * Estructural: cualquier `tx` de Prisma (o mock de test) lo satisface.
 */
export interface SeedTx {
	diario: { upsert(args: SeedUpsertArgs): Promise<{ diarioId: string }> };
	cuentaContable: {
		upsert(args: SeedUpsertArgs): Promise<{ cuentaContableId: string }>;
	};
	cuentaRolTenant: {
		upsert(args: SeedUpsertArgs): Promise<{ cuentaRolId: string }>;
	};
	plantillaAsiento: {
		upsert(args: SeedUpsertArgs): Promise<{ plantillaId: string }>;
	};
}

/** Resumen de filas procesadas por el seed del plan. */
export interface SeedPlanResult {
	diarios: number;
	cuentas: number;
	roles: number;
}

/** Resumen de filas procesadas por el seed de plantillas globales. */
export interface SeedPlantillasResult {
	plantillas: number;
}

/**
 * @description Siembra diarios, plan de cuentas y roles para un tenant.
 * Idempotente: todo va por upsert con claves naturales; los padres se
 * insertan en orden de nivel ascendente para poder conectar la jerarquía.
 * @param {SeedTx} tx - Transacción Prisma (o mock) de trabajo.
 * @param {string} tenantId - Tenant destino del plan.
 * @returns {Promise<SeedPlanResult>} Conteos de filas procesadas.
 */
export async function seedPlanContable(
	tx: SeedTx,
	tenantId: string,
): Promise<SeedPlanResult> {
	if (!tenantId || !tenantId.trim()) {
		throw new Error('tenantId requerido para sembrar el plan de cuentas');
	}

	for (const diario of DIARIOS_DEFAULT) {
		await tx.diario.upsert({
			where: { tenantId_codigo: { tenantId, codigo: diario.codigo } },
			create: {
				tenantId,
				tipo: diario.tipo,
				codigo: diario.codigo,
				nombre: diario.nombre,
			},
			update: { nombre: diario.nombre, tipo: diario.tipo, activo: true },
		});
	}

	const cuentasPorNivelAscendente = [...CUENTAS_PLAN_DEFAULT].sort(
		(a, b) => a.nivel - b.nivel,
	);
	const idPorCodigo = new Map<string, string>();
	for (const cuenta of cuentasPorNivelAscendente) {
		const padreCodigo = padreDeCodigo(cuenta.codigo);
		const padreId = padreCodigo ? idPorCodigo.get(padreCodigo) : undefined;
		const resultado = await tx.cuentaContable.upsert({
			where: { tenantId_codigo: { tenantId, codigo: cuenta.codigo } },
			create: {
				tenantId,
				codigo: cuenta.codigo,
				nombre: cuenta.nombre,
				tipo: cuenta.tipo,
				naturaleza: cuenta.naturaleza,
				nivel: cuenta.nivel,
				aceptaMovimiento: cuenta.aceptaMovimiento,
				esDeSistema: true,
				...(padreId ? { padre: { connect: { cuentaContableId: padreId } } } : {}),
			},
			update: {
				nombre: cuenta.nombre,
				tipo: cuenta.tipo,
				naturaleza: cuenta.naturaleza,
				nivel: cuenta.nivel,
				aceptaMovimiento: cuenta.aceptaMovimiento,
			},
		});
		idPorCodigo.set(cuenta.codigo, resultado.cuentaContableId);
	}

	let roles = 0;
	for (const [rol, codigoCuenta] of Object.entries(ROLES_CUENTA_DEFAULT)) {
		const cuentaId = idPorCodigo.get(codigoCuenta);
		if (!cuentaId) {
			throw new Error(
				`Plan por defecto inconsistente: rol ${rol} apunta a cuenta inexistente ${codigoCuenta}`,
			);
		}
		await tx.cuentaRolTenant.upsert({
			where: { tenantId_rol: { tenantId, rol } },
			create: { tenantId, rol, cuentaId },
			update: { cuentaId },
		});
		roles += 1;
	}

	return {
		diarios: DIARIOS_DEFAULT.length,
		cuentas: cuentasPorNivelAscendente.length,
		roles,
	};
}

/**
 * @description Siembra las plantillas globales de asientos (versión 1).
 * Las plantillas son datos de plataforma: no llevan tenantId y una misma
 * versión se comparte por todos los tenants.
 * @param {SeedTx} tx - Transacción Prisma (o mock) de trabajo.
 * @returns {Promise<SeedPlantillasResult>} Conteo de líneas procesadas.
 */
export async function seedPlantillasGlobales(
	tx: SeedTx,
): Promise<SeedPlantillasResult> {
	for (const linea of PLANTILLAS_DEFAULT) {
		await tx.plantillaAsiento.upsert({
			where: {
				evento_orden_version: {
					evento: linea.evento,
					orden: linea.orden,
					version: 1,
				},
			},
			create: {
				evento: linea.evento,
				orden: linea.orden,
				lado: linea.lado,
				rolCuenta: linea.rolCuenta,
				montoRegla: linea.montoRegla,
				condicion: linea.condicion ?? null,
				version: 1,
				activa: true,
			},
			update: {
				lado: linea.lado,
				rolCuenta: linea.rolCuenta,
				montoRegla: linea.montoRegla,
				condicion: linea.condicion ?? null,
				activa: true,
			},
		});
	}
	return { plantillas: PLANTILLAS_DEFAULT.length };
}
