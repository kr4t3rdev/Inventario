'use server';

/**
 * @description Server Actions de la capa de contabilidad formal (CTA-0):
 * activacion idempotente del plan de cuentas por tenant y consulta de estado.
 *
 * El plan de cuentas (diarios, cuentas, roles y plantillas) es la precondicion
 * del motor formal: sin el, los asientos no se pueden contabilizar. El seed es
 * idempotente, asi que el mismo boton sirve para inicializar y para verificar
 * que el plan sigue al dia.
 *
 * @module src/features/contabilidad-formal/actions-plan-contable
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

/** Feature de licencia que habilita la contabilidad formal. */
const FEATURE_CONTABILIDAD_FORMAL = 'contabilidad-formal';

/** Ruta de configuracion contable que se refresca tras activar el plan. */
const RUTA_CONFIGURACION = '/busy/contabilidad/configuracion';

/** Resumen devuelto por la activacion del plan. */
export interface ResultadoInicializarPlan {
	/** Diarios creados o actualizados. */
	diarios: number;
	/** Cuentas contables creadas o actualizadas. */
	cuentas: number;
	/** Roles semanticos mapeados a cuentas. */
	roles: number;
	/** Plantillas globales de asientos sembradas. */
	plantillas: number;
}

/** Estado actual del plan de cuentas del tenant. */
export interface EstadoPlanContable {
	/** true cuando el tenant ya tiene cuentas contables sembradas. */
	inicializado: boolean;
	/** Cantidad de cuentas contables del tenant. */
	cuentas: number;
	/** Cantidad de roles mapeados del tenant. */
	roles: number;
	/** Cantidad de diarios del tenant. */
	diarios: number;
}

/**
 * @description Siembra diarios, plan de cuentas por defecto, mapeo de roles y
 * plantillas globales en una sola transaccion por alcance. Es idempotente:
 * re-ejecutarlo reutiliza las claves naturales sin duplicar filas.
 * @param {void} _input - Sin parametros: el tenant se deriva del usuario autenticado.
 * @param {AuthenticatedUser} user - Usuario autenticado inyectado por withAction.
 * @returns {Promise<ResultadoInicializarPlan>} Conteos de filas procesadas.
 */
export const inicializarPlanContableAction = withAction(
	async (_input: void, user: AuthenticatedUser): Promise<ResultadoInicializarPlan> => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE_CONTABILIDAD_FORMAL, 'inicializar el plan de cuentas');

		// Las plantillas son globales (datos de plataforma): se siembran fuera de
		// la transaccion del tenant para no bloquear las claves globales.
		const plantillas = await prisma.$transaction((tx) => seedPlantillasGlobales(tx));
		const plan = await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));

		revalidatePath(RUTA_CONFIGURACION);
		return { ...plan, plantillas: plantillas.plantillas };
	},
);

/**
 * @description Consulta el estado del plan de cuentas del tenant actual.
 * @param {void} _input - Sin parametros: el tenant se deriva del usuario autenticado.
 * @param {AuthenticatedUser} user - Usuario autenticado inyectado por withAction.
 * @returns {Promise<EstadoPlanContable>} Conteos y marca de inicializacion.
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
