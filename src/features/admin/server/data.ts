/**
 * @description Data fetcher para la página de Admin Usuarios.
 * Se ejecuta en el servidor (Server Component) para obtener los datos
 * iniciales sin depender de fetching del lado del cliente.
 *
 * Replica lo que hacen getGlobalUsersAction + getAdminPlanesAction
 * pero diseñado específicamente para Server Components.
 *
 * @module features/admin/server/data
 */

import { getCurrentUser } from "@/lib/server-actions/get-current-user";
import { prisma } from "@/lib/prisma";

export interface AdminUsersPageData {
	users: Array<{
		userId: string;
		name: string;
		email: string;
		role: string;
		onboardingStatus: string | null;
		onboardingType: string | null;
		tenantRole: string | null;
		isActive: boolean;
		lockedUntil: Date | null;
		expiresAt: Date | null;
		createdAt: Date;
		loginAttempts: number;
		tenantId: string | null;
		tenantName: string | null;
		membershipCount: number;
		tenants: Array<{
			tenantId: string;
			tenantRole: string | null;
			isActive: boolean;
			tenant: { nombre: string };
		}>;
		salesAgentProfile: { phone: string | null; status: string } | null;
		salesAgentBalance: { availableUsd: unknown; paidUsd: unknown } | null;
		activeReferralCount: number;
	}>;
	total: number;
	planes: Array<{
		planId: string;
		nombre: string;
		precio: number | null;
		billingCycle: string | null;
		maxUsuarios: number;
		maxAlmacenes: number;
		maxProductos: number;
	}>;
}

/**
 * @description Obtiene los datos iniciales para la página de Admin Usuarios.
 * Usa `getCurrentUser()` + Prisma directamente para evitar el waterfall
 * cliente → Server Action.
 *
 * @returns {Promise<AdminUsersPageData | null>} Datos o null si no autenticado / no admin
 */
export async function getAdminUsersPageData(): Promise<AdminUsersPageData | null> {
	const user = await getCurrentUser();

	// Solo admin puede ver esta página
	if (!user || user.role !== "admin") return null;

	const [users, total, planes] = await Promise.all([
		prisma.user.findMany({
			take: 100,
			orderBy: { createdAt: "desc" },
			select: {
				userId: true,
				name: true,
				email: true,
				role: true,
				onboardingStatus: true,
				onboardingType: true,
				isActive: true,
				lockedUntil: true,
				expiresAt: true,
				createdAt: true,
				loginAttempts: true,
				salesAgentProfile: { select: { phone: true, status: true } },
				salesAgentBalance: { select: { availableUsd: true, paidUsd: true } },
				salesAgentReferrals: {
					where: { status: "attributed" },
					select: { salesAgentReferralId: true },
				},
				tenantMemberships: {
					select: {
						tenantId: true,
						tenantRole: true,
						isActive: true,
						tenant: {
							select: { nombre: true },
						},
					},
				},
				_count: {
					select: { tenantMemberships: true },
				},
			},
		}),

		prisma.user.count(),

		prisma.plan.findMany({
			orderBy: { createdAt: "desc" },
		}),
	]);

	return {
		users: users.map((u) => {
			const activeMembership =
				u.tenantMemberships.find((m) => m.isActive) ?? null;
			return {
				userId: u.userId,
				name: u.name,
				email: u.email,
				role: u.role,
				onboardingStatus: u.onboardingStatus,
				onboardingType: u.onboardingType,
				tenantRole: activeMembership?.tenantRole ?? null,
				isActive: u.isActive,
				lockedUntil: u.lockedUntil,
				expiresAt: u.expiresAt,
				createdAt: u.createdAt,
				loginAttempts: u.loginAttempts,
				tenantId: activeMembership?.tenantId ?? null,
				tenantName: activeMembership?.tenant?.nombre ?? null,
				membershipCount: u._count?.tenantMemberships ?? 0,
				salesAgentProfile: u.salesAgentProfile,
				salesAgentBalance: u.salesAgentBalance,
				activeReferralCount: u.salesAgentReferrals.length,
				tenants: u.tenantMemberships.map((m) => ({
					tenantId: m.tenantId,
					tenantRole: m.tenantRole,
					isActive: m.isActive,
					tenant: { nombre: m.tenant.nombre },
				})),
			};
		}),
		total,
		planes: planes.map((p) => ({
			planId: p.planId,
			nombre: p.nombre,
			precio: Number(p.precio),
			billingCycle: `${p.duracionDias} días`,
			maxUsuarios: p.maxUsuarios,
			maxAlmacenes: p.maxAlmacenes,
			maxProductos: p.maxProductos,
		})),
	};
}
