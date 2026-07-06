/**
 * @description Server Actions para licencias con paginación, sorting y filtros.
 */
"use server";

import { Prisma } from "@prisma/client";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { getLicenciasQuerySchema, licenciasStatsQuerySchema } from "./schemas";
import type { GetLicenciasQueryInput, LicenciasStatsQueryInput } from "./schemas";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

/**
 * @description Construye la cláusula WHERE de Prisma a partir de los filtros comunes.
 */
function buildLicenciasWhere(params: {
	search?: string;
	planFilter?: string;
	statusFilter?: string;
	typeFilter?: string;
}): Prisma.TenantLicenseWhereInput {
	const { search, planFilter, statusFilter, typeFilter } = params;
	const where: Prisma.TenantLicenseWhereInput = {};

	if (planFilter && planFilter !== 'all') where.planId = planFilter;
	if (statusFilter && statusFilter !== 'all') {
		where.activa = statusFilter === 'true';
	}
	if (typeFilter && typeFilter !== 'all') {
		where.isDemo = typeFilter === 'demo';
	}

	if (search && search.trim()) {
		const q = search.trim();
		where.OR = [
			{ tenantLicenseId: { contains: q, mode: 'insensitive' } },
			{ tenant: { nombre: { contains: q, mode: 'insensitive' } } },
			{
				tenant: {
					memberships: {
						some: { user: { name: { contains: q, mode: 'insensitive' } } },
					},
				},
			},
			{
				tenant: {
					memberships: {
						some: { user: { email: { contains: q, mode: 'insensitive' } } },
					},
				},
			},
		] as Prisma.TenantLicenseWhereInput[];
	}

	return where;
}

export const getLicenciasPaginatedAction = withAction(
	async (input: GetLicenciasQueryInput, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");

		const parsed = getLicenciasQuerySchema.parse(input ?? {});
		const { page, limit, sortBy, sortOrder, search, planFilter, statusFilter, typeFilter } = parsed;
		const skip = (page - 1) * limit;

		const where = buildLicenciasWhere({ search, planFilter, statusFilter, typeFilter });

		// --- Ordering
		let orderBy: Prisma.TenantLicenseOrderByWithRelationInput = { createdAt: sortOrder };
		if (sortBy === 'tenantId') {
			orderBy = { tenant: { nombre: sortOrder } };
		} else if (sortBy === 'planId') {
			orderBy = { plan: { nombre: sortOrder } };
		} else {
			orderBy = { [sortBy]: sortOrder } as Record<string, 'asc' | 'desc'>;
		}

		// --- Query with pagination
		const [licenses, total] = await Promise.all([
			prisma.tenantLicense.findMany({
				where,
				orderBy,
				skip: page === 1 ? undefined : skip,
				take: limit,
				include: {
					plan: true,
					tenant: {
						include: {
							memberships: {
								where: { isActive: true, tenantRole: "manager" },
								take: 1,
								include: {
									user: {
										select: {
											userId: true,
											name: true,
											email: true,
										},
									},
								},
							},
						},
					},
				},
			}),
			prisma.tenantLicense.count({ where }),
		]);

		// Resolve createdByUser
		const createdByIds = Array.from(
			new Set(
				licenses
					.map((license) => license.createdBy)
					.filter((value): value is string => Boolean(value)),
			),
		);

		if (createdByIds.length === 0) {
			return { licencias: licenses, total, page, limit };
		}

		const creators = await prisma.user.findMany({
			where: { userId: { in: createdByIds } },
			select: { userId: true, name: true, email: true },
		});

		const creatorsById = new Map(creators.map((c) => [c.userId, c]));

		const licencias = licenses.map((license) => ({
			...license,
			createdByUser: license.createdBy
				? creatorsById.get(license.createdBy) ?? null
				: null,
		}));

		return { licencias, total, page, limit };
	},
);

/**
 * @description Obtiene métricas agregadas de licencias respetando los mismos filtros
 * que la tabla paginada. Devuelve total, activas, expiradas, demos y porVencer (7 días).
 */
export const getLicenciasStatsAction = withAction(
	async (input: LicenciasStatsQueryInput, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");

		const parsed = licenciasStatsQuerySchema.parse(input ?? {});
		const { search, planFilter, statusFilter, typeFilter } = parsed;

		const baseWhere = buildLicenciasWhere({ search, planFilter, statusFilter, typeFilter });
		const now = new Date();
		const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

		const [total, activas, expiradas, demos, porVencer] = await Promise.all([
			prisma.tenantLicense.count({ where: baseWhere }),
			prisma.tenantLicense.count({
				where: {
					AND: [baseWhere, { activa: true, expiracion: { gt: now } }],
				},
			}),
			prisma.tenantLicense.count({
				where: {
					AND: [baseWhere, { expiracion: { lt: now } }],
				},
			}),
			prisma.tenantLicense.count({
				where: {
					AND: [baseWhere, { isDemo: true }],
				},
			}),
			prisma.tenantLicense.count({
				where: {
					AND: [
						baseWhere,
						{ activa: true, expiracion: { gte: now, lte: nextWeek } },
					],
				},
			}),
		]);

		return { total, activas, expiradas, demos, porVencer };
	},
);
