'use server';

/**
 * @description Server Actions de la capa de contabilidad formal (CTA-0):
 * activación idempotente del plan de cuentas por tenant y consulta de estado.
 * @module src/features/contabilidad-formal/actions
 */

import { revalidatePath } from 'next/cache';

import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import {
	seedPlanContable,
	seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';

const FEATURE_CONTABILIDAD_FORMAL = 'contabilidad-formal';
const RUTA_CONFIGURACION = '/busy/contabilidad/configuracion';

/** Resumen devuelto por la activación del plan. */
export interface ResultadoInicializarPlan {
	diarios: number;
	cuentas: number;
	roles: number;
	plantillas: number;
}

/** Estado actual del plan de cuentas del tenant. */
export interface EstadoPlanContable {
	inicializado: boolean;
	cuentas: number;
	roles: number;
	diarios: number;
}

/**
 * @description Siembra diarios, plan de cuentas por defecto, mapeo de roles y
 * plantillas globales en una sola transacción. Es idempotente: re-ejecutarlo
 * reutiliza las claves naturales sin duplicar filas.
 * @param _input - Sin parámetros (el tenant se deriva del usuario autenticado).
 * @param {AuthenticatedUser} user - Usuario autenticado inyectado por withAction.
 * @returns {Promise<ResultadoInicializarPlan>} Conteos de filas procesadas.
 */
export const inicializarPlanContableAction = withAction(
	async (_input: void, user: AuthenticatedUser): Promise<ResultadoInicializarPlan> => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE_CONTABILIDAD_FORMAL, 'inicializar el plan de cuentas');

		// Las plantillas son globales: se siembran junto al primer tenant, pero
		// fuera de la transacción del tenant para no bloquear claves globales.
		const plantillas = await prisma.$transaction((tx) => seedPlantillasGlobales(tx));
		const plan = await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));

		revalidatePath(RUTA_CONFIGURACION);
		return { ...plan, plantillas: plantillas.plantillas };
	},
);

/**
 * @description Consulta el estado del plan de cuentas del tenant actual.
 * @param _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado inyectado por withAction.
 * @returns {Promise<EstadoPlanContable>} Conteos y marca de inicialización.
 */
export const obtenerEstadoPlanContableAction = withAction(
	async (_input: void, user: AuthenticatedUser): Promise<EstadoPlanContable> => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE_CONTABILIDAD_FORMAL, 'consultar el plan de cuentas');

		const [cuentas, roles, diarios] = await Promise.all([
			prisma.cuentaContable.count({ where: { tenantId } }),
			prisma.cuentaRolTenant.count({ where: { tenantId } }),
			prisma.diario.count({ where: { tenantId } }),
		]);

		return { inicializado: cuentas > 0, cuentas, roles, diarios };
	},
);
