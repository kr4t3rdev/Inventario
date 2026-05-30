/**
 * @description Server Actions para administración platform-level.
 *
 * NO usa tenant scoping — es funcionalidad de super-admin.
 *
 * @module features/admin/actions
 */
"use server";

import { revalidatePath } from "next/cache";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendEmailVerificationLink } from "@/lib/email";
import { getUserMetrics } from "@/lib/admin/userMetrics";
import {
	createUserSchema,
	updateUserSchema,
	lockUnlockSchema,
	membershipActionSchema,
	createLicenciaSchema,
	updateLicenciaSchema,
	createPlanSchema,
	updatePlanSchema,
} from "./schemas";
import type {
	CreateUserInput,
	UpdateUserInput,
	LockUnlockInput,
	MembershipActionInput,
	CreateLicenciaInput,
	UpdateLicenciaInput,
	CreatePlanInput,
	UpdatePlanInput,
} from "./schemas";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

// ─── User CRUD ─────────────────────────────────────────────

export const getUsersAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		return prisma.user.findMany({ orderBy: { createdAt: "desc" } });
	},
);

export const createUserAction = withAction(
	async (input: CreateUserInput, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const parsed = createUserSchema.parse(input);
		const hashedPassword = await bcrypt.hash(parsed.password, 12);

		const newUser = await prisma.user.create({
			data: {
				name: parsed.name,
				email: parsed.email,
				password: hashedPassword,
				role: parsed.role,
				isActive: true,
				expiresAt: parsed.daysToExpire
					? new Date(Date.now() + parsed.daysToExpire * 24 * 60 * 60 * 1000)
					: null,
			},
		});

		try {
			// @ts-expect-error
			await sendEmailVerificationLink(newUser as any);
		} catch {}

		revalidatePath("/admin");
		return newUser;
	},
);

export const updateUserAction = withAction(
	async (input: UpdateUserInput, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const parsed = updateUserSchema.parse(input);
		const { userId, ...data } = parsed;

		const existing = await prisma.user.findUnique({ where: { userId } });
		if (!existing) throw new ActionError("Usuario no encontrado", "NOT_FOUND");

		const updateData: Record<string, any> = {};
		if (data.name !== undefined) updateData.name = data.name;
		if (data.email !== undefined) updateData.email = data.email;
		if (data.role !== undefined) updateData.role = data.role;
		if (data.isActive !== undefined) updateData.isActive = data.isActive;
		if (data.daysToExpire !== undefined) {
			updateData.expiresAt = data.daysToExpire
				? new Date(Date.now() + data.daysToExpire * 24 * 60 * 60 * 1000)
				: null;
		}
		if (data.password)
			updateData.password = await bcrypt.hash(data.password, 12);

		const updated = await prisma.user.update({
			where: { userId },
			data: updateData,
		});
		revalidatePath("/admin");
		return updated;
	},
);

export const deleteUserAction = withAction(
	async (userId: string, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const existing = await prisma.user.findUnique({ where: { userId } });
		if (!existing) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
		await prisma.user.delete({ where: { userId } });
		revalidatePath("/admin");
		return { success: true, userId };
	},
);

export const lockUserAction = withAction(
	async (input: LockUnlockInput, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const parsed = lockUnlockSchema.parse(input);
		const existing = await prisma.user.findUnique({
			where: { userId: parsed.userId },
		});
		if (!existing) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
		const updated = await prisma.user.update({
			where: { userId: parsed.userId },
			data: { lockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) },
		});
		revalidatePath("/admin");
		return { user: updated, message: "Usuario bloqueado por 24 horas" };
	},
);

export const unlockUserAction = withAction(
	async (input: LockUnlockInput, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const parsed = lockUnlockSchema.parse(input);
		const existing = await prisma.user.findUnique({
			where: { userId: parsed.userId },
		});
		if (!existing) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
		const updated = await prisma.user.update({
			where: { userId: parsed.userId },
			data: { lockedUntil: null, loginAttempts: 0 },
		});
		revalidatePath("/admin");
		return { user: updated, message: "Usuario desbloqueado correctamente" };
	},
);

// ─── Global Users ─────────────────────────────────────────

export const getGlobalUsersAction = withAction(
	async (
		input: { tenantId?: string; limit?: number } = {},
		user: AuthenticatedUser,
	) => {
		const isPlatformAdmin = user.role === "admin";
		const isTenantManager = user.tenantRole === "manager";

		if (!isPlatformAdmin && !isTenantManager) {
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		}

		const tenantId = input.tenantId || user.tenantId;

		if (tenantId) {
			// Modo tenant: buscar membresías activas de esa empresa
			const memberships = await prisma.tenantMembership.findMany({
				where: { tenantId, isActive: true },
				include: {
					user: {
						select: {
							userId: true,
							name: true,
							email: true,
							role: true,
							isActive: true,
							onboardingType: true,
							onboardingStatus: true,
							createdAt: true,
							expiresAt: true,
							lockedUntil: true,
							avatar: true,
						},
					},
				},
				orderBy: { createdAt: "desc" },
				take: input.limit || 100,
			});

			const users = memberships.map((m) => ({
				...m.user,
				tenantRole: m.tenantRole,
				membershipId: m.membershipId,
			}));

			return { users, total: users.length };
		}

		// Modo global: solo admin ve todos los usuarios
		const rawUsers = await prisma.user.findMany({
			take: input.limit || 100,
			orderBy: { createdAt: "desc" },
			include: {
				tenantMemberships: {
					include: { tenant: true },
					take: 1,
				},
			},
		});
		const total = await prisma.user.count();

		const users = rawUsers.map((u) => {
			const membership = u.tenantMemberships?.[0] ?? null;
			return {
				userId: u.userId,
				name: u.name,
				email: u.email,
				role: u.role,
				isActive: u.isActive,
				onboardingType: u.onboardingType,
				onboardingStatus: u.onboardingStatus,
				createdAt: u.createdAt,
				expiresAt: u.expiresAt,
				lockedUntil: u.lockedUntil,
				avatar: u.avatar,
				tenantRole: membership?.tenantRole ?? null,
				tenantId: membership?.tenantId ?? null,
				tenantName: membership?.tenant?.nombre ?? null,
			};
		});

		return { users, total };
	},
);

export const approveGlobalUserAction = withAction(
	async (
		input: {
			userId: string;
			planId?: string;
			tenantName?: string;
			licenseDurationDays?: number;
		},
		user: AuthenticatedUser,
	) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const existing = await prisma.user.findUnique({
			where: { userId: input.userId },
		});
		if (!existing) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
		await prisma.user.update({
			where: { userId: input.userId },
			data: {
				isActive: true,
				expiresAt: input.licenseDurationDays
					? new Date(Date.now() + input.licenseDurationDays * 86400000)
					: null,
			},
		});
		return { success: true };
	},
);

// ─── Admin Dashboard Data ──────────────────────────────────

export const getAdminTenantsAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		return prisma.tenant.findMany({
			orderBy: { createdAt: "desc" },
			include: {
				_count: {
					select: { memberships: true, productos: true, almacenes: true },
				},
			},
		});
	},
);

export const getAdminSystemHealthAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const [users, tenants, sessions, licenses] = await Promise.all([
			prisma.user.count(),
			prisma.tenant.count(),
			prisma.userSession.count(),
			prisma.tenantLicense.count(),
		]);
		const usersByRole = await prisma.user.groupBy({
			by: ["role"],
			_count: true,
		});
		return {
			users: {
				total: users,
				byRole: usersByRole.map((r) => ({ role: r.role, count: r._count })),
			},
			tenants: { total: tenants },
			sessions: { active: sessions },
			licenses: { total: licenses },
		};
	},
);

export const getAdminFinanceAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const [
			ventas,
			ventasServicios,
			gastos,
			cuentasPorCobrar,
			cuentasPorPagar,
			tenantCount,
		] = await Promise.all([
			prisma.venta.aggregate({ _count: true, _sum: { total: true } }),
			prisma.ventaServicios.aggregate({ _count: true, _sum: { total: true } }),
			prisma.gastosDE.aggregate({ _count: true, _sum: { monto: true } }),
			prisma.cuentaPorCobrar.aggregate({
				_count: true,
				_sum: { montoDeuda: true, montoPagado: true },
			}),
			prisma.cuentaPorPagar.aggregate({
				_count: true,
				_sum: { saldoPendiente: true },
			}),
			prisma.tenant.count(),
		]);
		return {
			tenantCount,
			revenue: {
				totalVentas: ventas._count || 0,
				totalVentasMonto: ventas._sum.total || 0,
				totalVentasServicios: ventasServicios._count || 0,
				totalServiciosMonto: ventasServicios._sum.total || 0,
				totalIngresos:
					Number(ventas._sum.total || 0) +
					Number(ventasServicios._sum.total || 0),
			},
			gastos: {
				totalGastos: gastos._count || 0,
				totalMonto: gastos._sum.monto || 0,
			},
			cuentasPorCobrar: {
				total: cuentasPorCobrar._count || 0,
				saldoPendiente:
					Number(cuentasPorCobrar._sum.montoDeuda || 0) -
					Number(cuentasPorCobrar._sum.montoPagado || 0),
			},
			cuentasPorPagar: {
				total: cuentasPorPagar._count || 0,
				saldoPendiente: cuentasPorPagar._sum.saldoPendiente || 0,
			},
		};
	},
);

export const getAdminPlanesAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		return prisma.plan.findMany({ orderBy: { createdAt: "desc" } });
	},
);

export const createAdminPlanAction = withAction(
	async (input: CreatePlanInput, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const parsed = createPlanSchema.parse(input);
		const plan = await prisma.plan.create({
			data: {
				nombre: parsed.nombre,
				descripcion: parsed.descripcion,
				precio: parsed.precio ?? 0,
				duracionDias: parsed.duracionDias,
				maxUsuarios: parsed.maxUsuarios,
				maxAlmacenes: parsed.maxAlmacenes,
				maxProductos: parsed.maxProductos,
			},
		});
		revalidatePath("/admin");
		return plan;
	},
);

export const updateAdminPlanAction = withAction(
	async (input: UpdatePlanInput, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const parsed = updatePlanSchema.parse(input);
		const { planId, ...data } = parsed;
		const existing = await prisma.plan.findUnique({ where: { planId } });
		if (!existing) throw new ActionError("Plan no encontrado", "NOT_FOUND");
		const plan = await prisma.plan.update({
			where: { planId },
			data: {
				...data,
				precio: data.precio ?? undefined,
			},
		});
		revalidatePath("/admin");
		return plan;
	},
);

// ─── Activity Logs ─────────────────────────────────────────

export const getActivityLogsAction = withAction(
	async (
		input: { userId?: string; limit?: number } = {},
		user: AuthenticatedUser,
	) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		return prisma.userActivityLog.findMany({
			where: input.userId ? { userId: input.userId } : undefined,
			orderBy: { createdAt: "desc" },
			take: input.limit || 100,
		});
	},
);

export const getUserLoginHistoryAction = withAction(
	async (
		input: { userId: string; limit?: number },
		user: AuthenticatedUser,
	) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		return prisma.userSession.findMany({
			where: { userId: input.userId },
			orderBy: { createdAt: "desc" },
			take: input.limit || 50,
			include: { user: { select: { name: true, email: true } } },
		});
	},
);

// ─── Sessions ──────────────────────────────────────────────

export const getSessionsAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		return prisma.userSession.findMany({
			orderBy: { createdAt: "desc" },
			take: 100,
			include: { user: { select: { name: true, email: true, role: true } } },
		});
	},
);

export const deleteSessionAction = withAction(
	async (sessionId: string, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		await prisma.userSession.delete({
			// @ts-expect-error
			where: { sessionId },
		});
		revalidatePath("/admin");
		return { success: true };
	},
);

// ─── Expiring Users ────────────────────────────────────────

export const getExpiringSoonAction = withAction(
	async (input: { days?: number } = {}, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const days = input.days || 7;
		const limit = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
		return prisma.user.findMany({
			where: { expiresAt: { not: null, lte: limit }, isActive: true },
			orderBy: { expiresAt: "asc" },
		});
	},
);

export const sendExpiryNotificationsAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
		const expiring = await prisma.user.findMany({
			where: { expiresAt: { not: null, lte: soon }, isActive: true },
		});
		for (const u of expiring) {
			try {
				// @ts-expect-error
				await sendEmailVerificationLink(u as any);
			} catch {}
		}
		return { notified: expiring.length };
	},
);

// ─── Pending Memberships ────────────────────────────────────

export const getPendingMembershipsAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		const isPlatformAdmin = user.role === "admin";
		const isTenantManager = user.tenantRole === "manager";

		if (!isPlatformAdmin && !isTenantManager) {
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		}

		const where = isPlatformAdmin
			? { isActive: false }
			: { isActive: false, tenantId: user.tenantId };

		return prisma.tenantMembership.findMany({
			where,
			include: {
				user: {
					select: {
						userId: true,
						name: true,
						email: true,
						onboardingType: true,
						onboardingStatus: true,
						createdAt: true,
					},
				},
				tenant: { select: { tenantId: true, nombre: true } },
			},
			orderBy: { createdAt: "desc" },
		});
	},
);

export const rejectMembershipAction = withAction(
	async (input: { membershipId: string }, user: AuthenticatedUser) => {
		const membership = await prisma.tenantMembership.findUnique({
			where: { membershipId: input.membershipId },
			select: { membershipId: true, tenantId: true },
		});

		if (!membership)
			throw new ActionError("Solicitud no encontrada", "NOT_FOUND");

		const isPlatformAdmin = user.role === "admin";
		const isTenantManager =
			user.tenantRole === "manager" && user.tenantId === membership.tenantId;

		if (!isPlatformAdmin && !isTenantManager) {
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		}

		await prisma.tenantMembership.delete({
			where: { membershipId: input.membershipId },
		});
		revalidatePath("/admin");
		return { success: true };
	},
);

export const getLicenciasAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		return prisma.tenantLicense.findMany({
			orderBy: { createdAt: "desc" },
			include: { plan: true, tenant: true },
		});
	},
);

export const createLicenciaAction = withAction(
	async (input: any, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const licencia = await prisma.tenantLicense.create({ data: { ...input } });
		revalidatePath("/admin");
		return licencia;
	},
);

export const updateLicenciaAction = withAction(
	async ({ id, ...data }: any, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const licencia = await prisma.tenantLicense.update({
			// @ts-expect-error
			where: { id },
			data,
		});
		revalidatePath("/admin");
		return licencia;
	},
);

export const deleteLicenciaAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		await prisma.tenantLicense.delete({
			// @ts-expect-error
			where: { id },
		});
		revalidatePath("/admin");
		return { success: true };
	},
);

export const generateLicenciasAction = withAction(
	async (input: any, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		return { success: true, message: "Licencias generadas" };
	},
);

export const deleteAdminPlanAction = withAction(
	async (planId: string, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const existing = await prisma.plan.findUnique({ where: { planId } });
		if (!existing) throw new ActionError("Plan no encontrado", "NOT_FOUND");
		await prisma.plan.delete({ where: { planId } });
		revalidatePath("/admin");
		return { success: true, planId };
	},
);

export const getUserMetricsAction = withAction(
	async (
		input: { months?: number; tenantId?: string } = {},
		user: AuthenticatedUser,
	) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const months = input.months ?? 6;
		return getUserMetrics(prisma, months, input.tenantId);
	},
);
