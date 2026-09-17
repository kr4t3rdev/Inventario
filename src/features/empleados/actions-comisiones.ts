'use server';

/**
 * @description Actions de comisiones y metas de vendedores (Gap 5 / CMV).
 *
 * El reporte es informativo y no toca caja ni contabilidad: solo agrega operaciones
 * ya registradas. La configuración (porcentaje/meta) está detrás del permiso
 * `rrhh.comisiones.gestionar`.
 */
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import {
	requireFeature,
	requirePermission,
	requireTenant,
} from '@/lib/services/tenant-scope';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { getComisionEmpleado } from '@/features/empleados/services/comision-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const configuracionSchema = z.object({
	empleadoId: z.string().min(1),
	comisionPct: z.coerce.number().int().min(0).max(100),
	metaMensual: z.coerce.number().int().min(0),
});

/**
 * @description Guarda porcentaje de comisión y meta mensual del empleado
 * (manager vía permiso sensitive).
 * @param {object} input - empleadoId, comisionPct, metaMensual.
 * @returns {Promise<{ok: true}>} Resultado del guardado.
 */
export const updateComisionEmpleadoAction = withAction(
	async (
		input: { empleadoId: string; comisionPct: number; metaMensual: number },
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'empleados', 'gestionar empleados');
		requirePermission(user, 'rrhh.comisiones.gestionar', 'configurar comisiones');
		const tenantId = requireTenant(user);
		const parsed = configuracionSchema.parse(input);

		const existente = await prisma.empleado.findFirst({
			where: { empleadoId: parsed.empleadoId, tenantId },
			select: { empleadoId: true, nombre: true, apellido: true },
		});
		if (!existente) throw new ActionError('Empleado no encontrado', 'NOT_FOUND');

		await prisma.empleado.update({
			where: { empleadoId: parsed.empleadoId },
			data: {
				comisionPct: parsed.comisionPct,
				metaMensual: parsed.metaMensual,
			},
		});
		await AuditLogService.logStrict({
			usuarioId: user.userId,
			accion: 'UPDATE',
			entidad: 'EMPLEADO',
			entidadId: parsed.empleadoId,
			detalles: {
				apartado: 'comisiones',
				comisionPct: parsed.comisionPct,
				metaMensual: parsed.metaMensual,
			},
		});
		revalidatePath('/busy/empleados');
		return { ok: true };
	},
);

/**
 * @description Reporte de comisiones de un mes para todos los empleados del tenant.
 * Devuelve una fila por empleado con venta elegible, base neta y comisión.
 * @param {{ anio: number; mes: number }} params - Año y mes (1-12).
 * @returns {Promise<Array>} Filas del reporte del mes.
 */
export const getComisionesDelMesAction = withAction(
	async (
		params: { anio: number; mes: number },
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'empleados', 'consultar comisiones');
		requirePermission(user, 'rrhh.comisiones.gestionar', 'consultar comisiones');
		const tenantId = requireTenant(user);

		const anio = Math.floor(Number(params.anio));
		const mes = Math.min(12, Math.max(1, Math.floor(Number(params.mes))));
		const desde = new Date(Date.UTC(anio, mes - 1, 1));
		const hasta = new Date(Date.UTC(anio, mes, 0, 23, 59, 59, 999));

		const empleados = await prisma.empleado.findMany({
			where: { tenantId },
			select: {
				empleadoId: true,
				nombre: true,
				apellido: true,
				comisionPct: true,
				metaMensual: true,
			},
		});

		const filas = await Promise.all(
			empleados.map(async (e) => {
				const reporte = await getComisionEmpleado({
					tenantId,
					empleadoId: e.empleadoId,
					desde,
					hasta,
					comisionPct: e.comisionPct,
					metaMensual: e.metaMensual,
				});
				return {
					empleadoId: e.empleadoId,
					nombre: `${e.nombre} ${e.apellido}`.trim(),
					comisionPct: e.comisionPct,
					...reporte,
				};
			}),
		);

		return filas.filter((f) => f.baseBruta > 0 || f.comisionPct > 0 || (f.meta?.metaMensual ?? 0) > 0);
	},
);

