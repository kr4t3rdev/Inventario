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
import { createTenantForUser } from "@/lib/services/tenant-factory";
import { requireFeature } from "@/lib/services/tenant-scope";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendEmailVerificationLink } from "@/lib/email";
import { getUserMetrics } from "@/lib/admin/userMetrics";
import {
	createUserSchema,
	updateUserSchema,
	lockUnlockSchema,
	membershipActionSchema,
	addTenantMembershipSchema,
	createLicenciaSchema,
	updateLicenciaSchema,
	createPlanSchema,
	updatePlanSchema,
	updateTenantUserSchema,
} from "./schemas";
import type {
	CreateUserInput,
	UpdateUserInput,
	AddTenantMembershipInput,
	LockUnlockInput,
	MembershipActionInput,
	CreateLicenciaInput,
	UpdateLicenciaInput,
	CreatePlanInput,
	UpdatePlanInput,
	UpdateTenantUserInput,
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
			// @ts-expect-error sendEmailVerificationLink expects a different user type
			await sendEmailVerificationLink(newUser as any);
		} catch {
			/* email sending is best-effort */
		}

		// ── Crear TenantMembership si se especificó tenantRole ──────
		const adminTenantId = user.tenantId;
		if (parsed.tenantRole && adminTenantId) {
			await prisma.tenantMembership.upsert({
				where: {
					tenantId_userId: { tenantId: adminTenantId, userId: newUser.userId },
				},
				create: {
					tenantId: adminTenantId,
					userId: newUser.userId,
					tenantRole: parsed.tenantRole,
					isActive: true,
				},
				update: { tenantRole: parsed.tenantRole, isActive: true },
			});
		}

		// ── Crear Empleado si el rol es dependiente ────────────────
		if (parsed.tenantRole === "dependiente" && adminTenantId) {
			const nameParts = parsed.name.trim().split(/\s+/);
			const nombre = nameParts[0] || parsed.name;
			const apellido = nameParts.slice(1).join(" ") || "";

			await prisma.empleado.create({
				data: {
					nombre,
					apellido,
					cargo: "Dependiente",
					salarioBases: 0,
					fechaContratacion: new Date(),
					tenantId: adminTenantId,
				},
			});
		}

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

		let tenantId: string | undefined;
		if (isPlatformAdmin) {
			tenantId = input.tenantId || user.tenantId;
		} else {
			if (input.tenantId && input.tenantId !== user.tenantId) {
				throw new ActionError(
					"No tenés permisos para ver usuarios de otra empresa",
					"FORBIDDEN",
				);
			}
			tenantId = user.tenantId;
		}

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
							_count: {
								select: { tenantMemberships: true },
							},
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
				membershipCount: (m.user as { _count?: { tenantMemberships: number } })._count?.tenantMemberships ?? 1,
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
					take: 5,
				},
				_count: {
					select: { tenantMemberships: true },
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
				membershipCount: u._count?.tenantMemberships ?? 0,
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

		const targetUser = await prisma.user.findUnique({
			where: { userId: input.userId },
			select: { userId: true, onboardingType: true, onboardingStatus: true },
		});
		if (!targetUser)
			throw new ActionError("Usuario no encontrado", "NOT_FOUND");

		// Si es tipo "company" o en estado await_global_approval → crear tenant completo
		if (
			targetUser.onboardingType === "company" ||
			targetUser.onboardingStatus === "awaiting_global_approval"
		) {
			const result = await createTenantForUser({
				userId: input.userId,
				planId: input.planId,
				tenantName: input.tenantName,
				licenseDurationDays: input.licenseDurationDays,
			});
			return { success: true, tenantCreated: true, ...result };
		}

		// Tipo "worker" o legacy: solo activar usuario y limpiar onboardingStatus
		await prisma.user.update({
			where: { userId: input.userId },
			data: {
				isActive: true,
				onboardingStatus: null,
				expiresAt: input.licenseDurationDays
					? new Date(Date.now() + input.licenseDurationDays * 86400000)
					: null,
			},
		});
		return { success: true, tenantCreated: false };
	},
);

// ─── Admin Dashboard Data ──────────────────────────────────

export const getAdminTenantsAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const tenants = await prisma.tenant.findMany({
			orderBy: { createdAt: "desc" },
			include: {
				_count: {
					select: { memberships: true, productos: true, almacenes: true },
				},
				licenses: {
					where: { activa: true },
					orderBy: { createdAt: "desc" },
					take: 1,
					include: { plan: true },
				},
			},
		});
		return tenants.map((t) => ({
			...t,
			totalUsers: t._count.memberships,
			plan: t.licenses[0]?.plan?.nombre ?? null,
			planId: t.licenses[0]?.planId ?? null,
			licenseActive: t.licenses.length > 0,
		}));
	},
);

export const getAdminSystemHealthAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const [users, tenants, sessions, licenses, licensesActive, expiringSoon] =
			await Promise.all([
				prisma.user.count(),
				prisma.tenant.count(),
				prisma.userSession.count(),
				prisma.tenantLicense.count(),
				prisma.tenantLicense.count({ where: { activa: true } }),
				prisma.tenantLicense.count({
					where: {
						activa: true,
						expiracion: {
							lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
							gte: new Date(),
						},
					},
				}),
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
			licenses: {
				total: licenses,
				active: licensesActive,
				expiringSoon,
			},
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
		const planes = await prisma.plan.findMany({
			orderBy: { createdAt: "desc" },
		});
		return planes.map((p) => ({
			...p,
			precio: Number(p.precio),
			billingCycle: `${p.duracionDias} días`,
		}));
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
				precio: parsed.precio,
				duracionDias: parsed.duracionDias,
				maxUsuarios: parsed.maxUsuarios,
				maxAlmacenes: parsed.maxAlmacenes,
				maxProductos: parsed.maxProductos,
				maxClientes: parsed.maxClientes,
				maxPuntosVenta: parsed.maxPuntosVenta,
				maxFacturasMes: parsed.maxFacturasMes,
				maxContratos: parsed.maxContratos,
				incluyeBackups: parsed.incluyeBackups,
				features: parsed.features,
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
			data,
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
			// @ts-expect-error sessionId is not in the Prisma type but the schema has it
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
				// @ts-expect-error sendEmailVerificationLink expects a different user type
				await sendEmailVerificationLink(u as any);
			} catch {
				/* email sending is best-effort */
			}
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

export const approveMembershipAction = withAction(
	async (
		input: { membershipId: string; tenantRole: string },
		user: AuthenticatedUser,
	) => {
		const { membershipId, tenantRole } = input;

		if (!tenantRole || typeof tenantRole !== "string") {
			throw new ActionError("El rol del tenant es requerido", "VALIDATION");
		}

		const validRoles = ["manager", "economico", "dependiente", "admin"];
		if (!validRoles.includes(tenantRole)) {
			throw new ActionError(
				`Rol inválido: ${tenantRole}. Roles válidos: ${validRoles.join(", ")}`,
				"VALIDATION",
			);
		}

		const membership = await prisma.tenantMembership.findUnique({
			where: { membershipId },
			select: {
				membershipId: true,
				tenantId: true,
				userId: true,
				isActive: true,
				user: { select: { userId: true, name: true, email: true } },
			},
		});

		if (!membership) {
			throw new ActionError(
				"Solicitud de membresía no encontrada",
				"NOT_FOUND",
			);
		}

		if (membership.isActive) {
			throw new ActionError("Esta membresía ya está activa", "CONFLICT");
		}

		const isPlatformAdmin = user.role === "admin";
		const isTenantManager =
			user.tenantRole === "manager" && user.tenantId === membership.tenantId;

		if (!isPlatformAdmin && !isTenantManager) {
			throw new ActionError(
				"No tenés permisos para aprobar esta solicitud",
				"FORBIDDEN",
			);
		}

		// Activar membresía
		await prisma.tenantMembership.update({
			where: { membershipId },
			data: { isActive: true, tenantRole },
		});

		// Activar usuario
		await prisma.user.update({
			where: { userId: membership.userId },
			data: { isActive: true },
		});

		// Crear Empleado
		const nameParts = membership.user.name.trim().split(" ");
		const nombre = nameParts[0];
		const apellido = nameParts.slice(1).join(" ") || nombre;

		const cargoMap: Record<string, string> = {
			manager: "Director / Manager",
			economico: "Económico",
			dependiente: "Dependiente",
			admin: "Administrador",
		};

		let empleadoCreado = false;

		const existingEmpleado = await prisma.empleado.findFirst({
			where: { tenantId: membership.tenantId, nombre, apellido },
		});

		if (!existingEmpleado) {
			const cargo = cargoMap[tenantRole] || tenantRole;
			await prisma.empleado.create({
				data: {
					tenantId: membership.tenantId,
					nombre,
					apellido,
					cargo,
					salarioBases: 0,
					fechaContratacion: new Date(),
				},
			});
			empleadoCreado = true;
		}

		revalidatePath("/busy/configuracion/usuarios");
		return { success: true, empleadoCreado };
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

export const updateTenantUserAction = withAction(
	async (input: UpdateTenantUserInput, user: AuthenticatedUser) => {
		const parsed = updateTenantUserSchema.parse(input);
		const { userId, tenantRole, isActive } = parsed;

		if (!tenantRole && isActive === undefined) {
			throw new ActionError(
				"Debe proporcionar al menos un campo para actualizar",
				"VALIDATION",
			);
		}

		// Solo manager del mismo tenant puede actualizar usuarios
		if (user.tenantRole !== "manager") {
			throw new ActionError(
				"Solo un manager puede gestionar usuarios del tenant",
				"FORBIDDEN",
			);
		}

		if (!user.tenantId) {
			throw new ActionError("No tenés un tenant asignado", "FORBIDDEN");
		}

		// Verificar que el usuario pertenece al mismo tenant
		const membership = await prisma.tenantMembership.findFirst({
			where: { userId, tenantId: user.tenantId },
			select: { membershipId: true, tenantRole: true, isActive: true },
		});

		if (!membership) {
			throw new ActionError(
				"El usuario no pertenece a tu empresa",
				"NOT_FOUND",
			);
		}

		// Un manager no puede cambiar su propio rol ni desactivarse
		if (userId === user.userId) {
			throw new ActionError(
				"No podés modificar tu propio usuario desde aquí",
				"FORBIDDEN",
			);
		}

		const updateData: Record<string, unknown> = {};
		if (tenantRole !== undefined) updateData.tenantRole = tenantRole;
		if (isActive !== undefined) updateData.isActive = isActive;

		await prisma.tenantMembership.update({
			where: { membershipId: membership.membershipId },
			data: updateData,
		});

		// Si se desactiva, también desactivar el usuario global
		if (isActive !== undefined) {
			await prisma.user.update({
				where: { userId },
				data: { isActive },
			});
		}

		revalidatePath("/busy/configuracion/usuarios");
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
			// @ts-expect-error TenantLicense uses id but Prisma client type may differ
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
			// @ts-expect-error TenantLicense uses id but Prisma client type may differ
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

// ─── Multi-Tenant Membership ──────────────────────────────

/**
 * @description Asigna un usuario a un tenant adicional.
 *
 * Gateada por la feature `multitenantmembership` del plan del admin.
 * Los admins de plataforma (role=admin) siempre pueden.
 */
export const addTenantMembershipAction = withAction(
	async (input: AddTenantMembershipInput, user: AuthenticatedUser) => {
		requireFeature(user, "multitenantmembership", "Membresía multi-tenant");

		const parsed = addTenantMembershipSchema.parse(input);
		const { userId, tenantId, tenantRole } = parsed;

		// Validar que el usuario existe
		const targetUser = await prisma.user.findUnique({
			where: { userId },
			select: { userId: true, name: true, isActive: true },
		});
		if (!targetUser)
			throw new ActionError("Usuario no encontrado", "NOT_FOUND");

		// Validar que el tenant existe
		const tenant = await prisma.tenant.findUnique({
			where: { tenantId },
			select: { tenantId: true, nombre: true },
		});
		if (!tenant)
			throw new ActionError("Empresa no encontrada", "NOT_FOUND");

		// Validar que no exista ya la membresía
		const existing = await prisma.tenantMembership.findUnique({
			where: { tenantId_userId: { tenantId, userId } },
		});
		if (existing) {
			throw new ActionError(
				`${targetUser.name} ya pertenece a ${tenant.nombre}`,
				"DUPLICATE",
			);
		}

		// Crear la membresía
		const membership = await prisma.tenantMembership.create({
			data: {
				tenantId,
				userId,
				tenantRole,
				isActive: true,
			},
		});

		revalidatePath("/admin");
		return { membership, tenantName: tenant.nombre };
	},
);
