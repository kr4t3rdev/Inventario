'use server';

/**
 * @description Server Actions de lectura de la capa de contabilidad formal
 * (CTA-2): libro diario, libro mayor, balance de comprobación y conciliación
 * cruzada. Todas gated por el feature `contabilidad-formal` y tenant-scoped.
 * @module src/features/contabilidad-formal/actions-libros
 */

import { z } from 'zod';

import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { obtenerLibroDiario } from '@/features/contabilidad-formal/services/libro-diario-service';
import { obtenerLibroMayor } from '@/features/contabilidad-formal/services/libro-mayor-service';
import { obtenerBalanceComprobacion } from '@/features/contabilidad-formal/services/balance-comprobacion-service';
import { obtenerConciliacionCruzada } from '@/features/contabilidad-formal/services/conciliacion-cruzada-service';

const FEATURE = 'contabilidad-formal';

const libroDiarioSchema = z.object({
	periodoId: z.string().trim().min(1).optional(),
	diarioId: z.string().trim().min(1).optional(),
	fechaDesde: z.string().datetime({ offset: true }).optional(),
	fechaHasta: z.string().datetime({ offset: true }).optional(),
	page: z.coerce.number().int().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict();

const libroMayorSchema = z.object({
	cuentaId: z.string().trim().min(1),
	fechaDesde: z.string().min(4, 'Fecha inicial obligatoria'),
	fechaHasta: z.string().min(4, 'Fecha final obligatoria'),
}).strict();

const comprobacionSchema = z.object({
	periodoId: z.string().trim().min(1).optional(),
	fechaDesde: z.string().datetime({ offset: true }).optional(),
	fechaHasta: z.string().datetime({ offset: true }).optional(),
}).strict();

/**
 * @description Libro diario del tenant autenticado (paginado).
 */
export const getLibroDiarioAction = withAction(
	async (input: z.infer<typeof libroDiarioSchema>, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE, 'consultar el libro diario');
		const parsed = libroDiarioSchema.parse(input ?? {});
		return obtenerLibroDiario(tenantId, {
			periodoId: parsed.periodoId,
			diarioId: parsed.diarioId,
			fechaDesde: parsed.fechaDesde ? new Date(parsed.fechaDesde) : undefined,
			fechaHasta: parsed.fechaHasta ? new Date(parsed.fechaHasta) : undefined,
			page: parsed.page,
			limit: parsed.limit,
		});
	},
);

/**
 * @description Libro mayor de una cuenta del tenant autenticado.
 */
export const getLibroMayorAction = withAction(
	async (input: z.infer<typeof libroMayorSchema>, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE, 'consultar el libro mayor');
		const parsed = libroMayorSchema.parse(input);
		return obtenerLibroMayor(tenantId, parsed);
	},
);

/**
 * @description Balance de comprobación del tenant autenticado.
 */
export const getBalanceComprobacionAction = withAction(
	async (input: z.infer<typeof comprobacionSchema>, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE, 'consultar el balance de comprobación');
		const parsed = comprobacionSchema.parse(input ?? {});
		return obtenerBalanceComprobacion(tenantId, {
			periodoId: parsed.periodoId,
			fechaDesde: parsed.fechaDesde ? new Date(parsed.fechaDesde) : undefined,
			fechaHasta: parsed.fechaHasta ? new Date(parsed.fechaHasta) : undefined,
		});
	},
);

/**
 * @description Conciliación cruzada caja ↔ asientos del tenant autenticado.
 */
export const getConciliacionCruzadaAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE, 'consultar la conciliación cruzada');
		return obtenerConciliacionCruzada(tenantId, {});
	},
);

/**
 * @description Cuentas hoja del plan (para el selector del libro mayor).
 */
export const getCuentasMayorablesAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE, 'consultar las cuentas del libro mayor');
		const cuentas = await prisma.cuentaContable.findMany({
			where: { tenantId, aceptaMovimiento: true, activa: true },
			orderBy: { codigo: 'asc' },
			select: { cuentaContableId: true, codigo: true, nombre: true, tipo: true },
		});
		return cuentas.map((c) => ({
			cuentaId: c.cuentaContableId,
			codigo: c.codigo,
			nombre: c.nombre,
			tipo: c.tipo,
		}));
	},
);
