/**
 * @description Modo operativo de la capa formal por tenant (R7.4).
 *
 * El modo global (`CONTABILIDAD_FORMAL_MODE`) sigue siendo el valor por
 * defecto para toda la flota. Cuando el operador habilita de forma explícita
 * el mecanismo de aprobación por tenant (`CONTABILIDAD_FORMAL_MODO_TENANT=1`),
 * la licencia vigente del tenant puede aprobar `shadow` o `enforce` con dos
 * claves de override, sin cambiar el modo global del resto de los tenants.
 *
 * El mecanismo está **apagado por defecto**: sin la variable de entorno ningún
 * override altera el modo y la capa formal conserva exactamente el
 * comportamiento global actual. Quitar la variable de entorno es el
 * interruptor de reversión: toda la flota vuelve al modo global.
 *
 * La aprobación es explícita por tenant (criterio de reversión R7.4): la
 * licencia es la que autoriza, no el entorno. Si el tenant aprueba `shadow`,
 * el motor registra evidencia simulada sin escribir asientos; si aprueba
 * `enforce`, el asiento es exigible. La flag de plan `contabilidad-formal`
 * sigue siendo condición necesaria: sin ella, ningún modo contabiliza.
 *
 * @module src/features/contabilidad-formal/lib/modo-tenant
 */
import type { Prisma } from '@/generated/prisma';
import { sanitizeFeatureFlags } from '@/lib/plan-features';

/** Modos operativos del motor contable formal. */
export type ModoFormal = 'off' | 'shadow' | 'enforce';

/** Transacción Prisma con la que se resuelve la licencia vigente del tenant. */
export type ModoTenantDb = Prisma.TransactionClient;

/** Clave de override que aprueba el modo `shadow` para un tenant. */
export const OVERRIDE_MODO_SHADOW = 'contabilidad-formal-shadow';

/** Clave de override que aprueba el modo `enforce` para un tenant. */
export const OVERRIDE_MODO_ENFORCE = 'contabilidad-formal-enforce';

/** Variable de entorno que habilita la aprobación de modo por tenant. */
export const ENV_MODO_POR_TENANT = 'CONTABILIDAD_FORMAL_MODO_TENANT';

/**
 * @description Modo global configurado por entorno: `off` por defecto.
 * @param {NodeJS.ProcessEnv | undefined} env - Entorno a inspeccionar (inyectable en tests).
 * @returns {ModoFormal} Modo global configurado.
 */
export function modoActual(env?: NodeJS.ProcessEnv): ModoFormal {
	const modo = (env ?? process.env).CONTABILIDAD_FORMAL_MODE;
	return modo === 'shadow' || modo === 'enforce' ? modo : 'off';
}

/**
 * @description Indica si la aprobación de modo por tenant está habilitada.
 * @param {NodeJS.ProcessEnv | undefined} env - Entorno a inspeccionar (inyectable en tests).
 * @returns {boolean} True si el mecanismo por tenant está habilitado.
 */
export function overridePorTenantHabilitado(env?: NodeJS.ProcessEnv): boolean {
	return (env ?? process.env)[ENV_MODO_POR_TENANT] === '1';
}

/**
 * @description Extrae el modo aprobado por el tenant en sus overrides de licencia.
 *
 * `enforce` tiene prioridad sobre `shadow`: una licencia que aprueba ambos
 * modos exige el asiento. Los overrides ausentes o con valores distintos de
 * `true` no aprueban nada.
 *
 * @param {Record<string, boolean> | null | undefined} featureOverrides - Overrides de la licencia.
 * @returns {'shadow' | 'enforce' | null} Modo aprobado o null si no hay aprobación.
 */
export function resolverModoAprobado(
	featureOverrides: Record<string, boolean> | null | undefined,
): Exclude<ModoFormal, 'off'> | null {
	if (!featureOverrides) return null;
	if (featureOverrides[OVERRIDE_MODO_ENFORCE] === true) return 'enforce';
	if (featureOverrides[OVERRIDE_MODO_SHADOW] === true) return 'shadow';
	return null;
}

/**
 * @description Resuelve el modo efectivo combinando el modo global y la aprobación por tenant.
 *
 * Sin el mecanismo por tenant habilitado, el modo global manda siempre: los
 * overrides de licencia no alteran ningún comportamiento. Con el mecanismo
 * habilitado, la aprobación explícita del tenant prevalece sobre el modo
 * global (también para bajarlo, que es el criterio de reversión por tenant).
 *
 * @param {object} params - Modo global, overrides de licencia y estado del mecanismo.
 * @returns {ModoFormal} Modo efectivo del tenant.
 */
export function resolverModoEfectivo(params: {
	modoGlobal: ModoFormal;
	featureOverrides?: Record<string, boolean> | null;
	porTenantHabilitado?: boolean;
}): ModoFormal {
	const habilitado = params.porTenantHabilitado ?? overridePorTenantHabilitado();
	if (!habilitado) return params.modoGlobal;
	return resolverModoAprobado(params.featureOverrides) ?? params.modoGlobal;
}

/**
 * @description Resuelve el modo efectivo de un tenant leyendo su licencia vigente.
 *
 * Con el mecanismo por tenant apagado no consulta la base: el modo global
 * manda y no se paga ninguna consulta extra. Con el mecanismo habilitado, la
 * licencia vigente (activa y no expirada) es la que aprueba el modo.
 *
 * @param {ModoTenantDb} db - Transacción Prisma del tenant.
 * @param {string} tenantId - Tenant cuyo modo se resuelve.
 * @returns {Promise<ModoFormal>} Modo efectivo del tenant.
 */
export async function resolverModoTenant(
	db: ModoTenantDb,
	tenantId: string,
): Promise<ModoFormal> {
	const modoGlobal = modoActual();
	if (!overridePorTenantHabilitado()) return modoGlobal;
	const licencia = await db.tenantLicense.findFirst({
		where: { tenantId, activa: true, expiracion: { gt: new Date() } },
		select: { featureOverrides: true },
		orderBy: { inicio: 'desc' },
	});
	return resolverModoEfectivo({
		modoGlobal,
		featureOverrides: sanitizeFeatureFlags(licencia?.featureOverrides),
	});
}
