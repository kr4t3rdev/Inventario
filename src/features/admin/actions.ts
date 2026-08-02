/**
 * @description Server Actions para administración platform-level.
 *
 * NO usa tenant scoping — es funcionalidad de super-admin.
 *
 * @module features/admin/actions
 */
"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { withAction, ActionError } from "@/lib/server-actions";
import { createTenantForUser } from "@/lib/services/tenant-factory";
import {
	generateSalesAgentReferralCode,
	isUniqueConstraintCollision,
} from "@/features/sales-agent/referral-code";
import {
	createSalesAgentEvent,
	deliverSalesAgentEmails,
} from "@/features/sales-agent/services/notification-service";
import { createDemoTenantForPlan } from "@/lib/services/demo-tenant-factory";
import { seedDemoTenantData } from "@/lib/services/demo-seed";
import { requireFeature } from "@/lib/services/tenant-scope";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendEmailVerificationLink } from "@/lib/email";
import { getUserMetrics } from "@/lib/admin/userMetrics";
import { destroyCloudinaryAsset } from "@/lib/cloudinary";
import { AuditLogService } from "@/lib/services/audit-log-service";
import {
	createUserSchema,
	updateUserSchema,
	lockUnlockSchema,
	cloudinaryAssetsQuerySchema,
	cloudinaryCleanupSchema,
	membershipActionSchema,
	addTenantMembershipSchema,
	createLicenciaSchema,
	createDemoTenantSchema,
	cleanupExpiredDemoLicenciasSchema,
	convertDemoToPaidPlanSchema,
	changePlanSchema,
	updateLicenciaSchema,
	updateLicenseAccountingOverridesSchema,
	createPlanSchema,
	updatePlanSchema,
	updateTenantUserSchema,
	getLicenciasQuerySchema,
} from "./schemas";
import type {
	CreateUserInput,
	UpdateUserInput,
	CloudinaryAssetsQueryInput,
	CloudinaryCleanupInput,
	AddTenantMembershipInput,
	LockUnlockInput,
	MembershipActionInput,
	CreateLicenciaInput,
	CreateDemoTenantInput,
	CleanupExpiredDemoLicenciasInput,
	ConvertDemoToPaidPlanInput,
	ChangePlanInput,
	UpdateLicenciaInput,
	UpdateLicenseAccountingOverridesInput,
	CreatePlanInput,
	UpdatePlanInput,
	UpdateTenantUserInput,
	GetLicenciasQueryInput,
} from "./schemas";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import { mergeAccountingFeatureOverrides } from "./license-feature-overrides";

// ─── User CRUD ─────────────────────────────────────────────

export const getUsersAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		return prisma.user.findMany({
			orderBy: { createdAt: "desc" },
			select: {
				userId: true,
				name: true,
				email: true,
				role: true,
				isActive: true,
				onboardingType: true,
				onboardingStatus: true,
				createdAt: true,
				updatedAt: true,
				activatedAt: true,
				expiresAt: true,
				avatar: true,
				salesAgentProfile: { select: { phone: true, status: true } },
				salesAgentBalance: { select: { availableUsd: true, paidUsd: true } },
				salesAgentReferrals: {
					where: { status: "attributed" },
					select: { salesAgentReferralId: true },
				},
				lastModifiedBy: true,
				lockedUntil: true,
				loginAttempts: true,
				lastFailedLogin: true,
				tenantMemberships: {
					where: { isActive: true },
					select: {
						tenantId: true,
						tenantRole: true,
					},
					take: 1,
				},
			},
		}).then((users) =>
			users.map((user) => ({
				...user,
				tenantRole: user.tenantMemberships[0]?.tenantRole ?? null,
			})),
		);
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

		const existing = await prisma.user.findUnique({
			where: { userId },
			select: { userId: true },
		});
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

		await prisma.user.updateMany({
			where: { userId },
			data: updateData,
		});
		const updated = await prisma.user.findUnique({
			where: { userId },
			select: {
				userId: true,
				name: true,
				email: true,
				role: true,
				isActive: true,
				onboardingType: true,
				onboardingStatus: true,
				createdAt: true,
				updatedAt: true,
				activatedAt: true,
				expiresAt: true,
				avatar: true,
				lastModifiedBy: true,
				lockedUntil: true,
				loginAttempts: true,
				lastFailedLogin: true,
			},
		});
		revalidatePath("/admin");
		return updated;
	},
);

export const deleteUserAction = withAction(
	async (userId: string, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const existing = await prisma.user.findUnique({
			where: { userId },
			select: { userId: true },
		});
		if (!existing) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
		await prisma.user.deleteMany({ where: { userId } });
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
			select: { userId: true },
		});
		if (!existing) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
		await prisma.user.updateMany({
			where: { userId: parsed.userId },
			data: { lockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) },
		});
		const updated = await prisma.user.findUnique({
			where: { userId: parsed.userId },
			select: { userId: true, lockedUntil: true, loginAttempts: true },
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
			select: { userId: true },
		});
		if (!existing) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
		await prisma.user.updateMany({
			where: { userId: parsed.userId },
			data: { lockedUntil: null, loginAttempts: 0 },
		});
		const updated = await prisma.user.findUnique({
			where: { userId: parsed.userId },
			select: { userId: true, lockedUntil: true, loginAttempts: true },
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
						tenant: {
							select: { nombre: true },
						},
					},
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
				salesAgentProfile: u.salesAgentProfile,
				salesAgentBalance: u.salesAgentBalance,
				activeReferralCount: u.salesAgentReferrals.length,
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
			select: {
				userId: true,
				onboardingType: true,
				onboardingStatus: true,
				role: true,
				isActive: true,
			},
		});
		if (!targetUser)
			throw new ActionError("Usuario no encontrado", "NOT_FOUND");

		if (targetUser.onboardingType === "salesAgent") {
			const maxAttempts = 5;
			let approval:
				| {
						referralCode: string;
						alreadyApproved: boolean;
						deliveryId?: string;
				  }
				| undefined;

			for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
				try {
					approval = await prisma.$transaction(async (transaction) => {
						const profile = await transaction.salesAgentProfile.findUnique({
							where: { userId: input.userId },
							select: { referralCode: true, status: true },
						});
						if (!profile)
							throw new ActionError(
								"Perfil de ventas no encontrado",
								"NOT_FOUND",
							);

						if (
							profile.status === "active" &&
							profile.referralCode &&
							targetUser.role === "salesAgent" &&
							targetUser.isActive
						) {
							return {
								referralCode: profile.referralCode,
								alreadyApproved: true,
							};
						}
						if (
							targetUser.onboardingStatus !==
							"awaiting_sales_agent_approval"
						) {
							throw new ActionError(
								"El usuario no está esperando aprobación como Gestor de Ventas",
								"INVALID_ONBOARDING_STATUS",
							);
						}

						const referralCode = generateSalesAgentReferralCode();
						const activated = await transaction.salesAgentProfile.updateMany({
							where: {
								userId: input.userId,
								status: "pending_approval",
							},
							data: {
								status: "active",
								approvedAt: new Date(),
								approvedByAdminId: user.userId,
								referralCode,
							},
						});
						if (activated.count === 0) {
							const winner = await transaction.salesAgentProfile.findUnique({
								where: { userId: input.userId },
								select: { referralCode: true, status: true },
							});
							if (winner?.status === "active" && winner.referralCode) {
								return {
									referralCode: winner.referralCode,
									alreadyApproved: true,
								};
							}
							throw new ActionError(
								"No se pudo confirmar la aprobación",
								"APPROVAL_CONFLICT",
							);
						}

						await transaction.salesAgentBalance.upsert({
							where: { userId: input.userId },
							create: { userId: input.userId },
							update: {},
						});
						await transaction.tenantMembership.deleteMany({
							where: { userId: input.userId },
						});
						await transaction.user.update({
							where: { userId: input.userId },
							data: {
								role: "salesAgent",
								isActive: true,
								onboardingStatus: null,
							},
						});
						await AuditLogService.logStrict(
							{
								accion: "UPDATE",
								entidad: "SALES_AGENT_PROFILE",
								entidadId: input.userId,
								usuarioId: user.userId,
								detalles: {
									targetUserId: input.userId,
									referralCode,
									status: "active",
								},
							},
							transaction,
						);
						const deliveryId = await createSalesAgentEvent({
							tx: transaction,
							userId: input.userId,
							eventType: "sales_agent_approved",
							title: "Tu perfil fue aprobado",
							message:
								"Ya podés compartir tu código y gestionar tus referidos.",
							emailPayload: {},
						});

						return { referralCode, alreadyApproved: false, deliveryId };
					});
					break;
				} catch (error) {
					if (!isUniqueConstraintCollision(error) || attempt === maxAttempts - 1) {
						throw error;
					}
				}
			}

			if (!approval) {
				throw new ActionError(
					"No se pudo generar un código de referido único",
					"REFERRAL_CODE_COLLISION",
				);
			}
			if (approval.deliveryId) {
				await deliverSalesAgentEmails([approval.deliveryId]);
			}

			return {
				success: true,
				tenantCreated: false,
				referralCode: approval.referralCode,
				alreadyApproved: approval.alreadyApproved,
			};
		}

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
		const realTenantWhere = { licencias: { some: { isDemo: false } } };
		const tenants = await prisma.tenant.findMany({
			where: realTenantWhere,
			orderBy: { createdAt: "desc" },
			include: {
				_count: {
					select: { memberships: true, productos: true, almacenes: true },
				},
				licencias: {
					where: { activa: true, isDemo: false },
					orderBy: { createdAt: "desc" },
					take: 1,
					include: { plan: true },
				},
			},
		});
		return tenants.map((t) => ({
			...t,
			totalUsers: t._count.memberships,
			plan: t.licencias[0]?.plan?.nombre ?? null,
			planId: t.licencias[0]?.planId ?? null,
			licenseActive: t.licencias.length > 0,
		}));
	},
);


/**
 * Helper para agrupar datos por día.
 */
function groupByLastNDays<T extends { createdAt: Date }>(
  items: T[],
  valueExtractor: (item: T) => number,
  days: number,
  offsetDays = 0,
): Array<{ fecha: string; value: number }> {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i + offsetDays));
    const fecha = date.toISOString().split('T')[0];

    const value = items
      .filter((item) => item.createdAt.toISOString().split('T')[0] === fecha)
      .reduce((sum, item) => sum + valueExtractor(item), 0);

    return { fecha, value };
  });
}

export const getAdminSystemHealthAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const now = new Date();
		const realTenantWhere = { licencias: { some: { isDemo: false } } };
		const realUserWhere = {
			tenantMemberships: {
				some: {
					tenant: realTenantWhere,
				},
			},
		};
		const [users, tenants, sessions, licenses, licensesActive, expiringSoon] =
			await Promise.all([
				prisma.user.count({ where: realUserWhere }),
				prisma.tenant.count({ where: realTenantWhere }),
				prisma.userSession.count({
					where: {
						isActive: true,
						OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
						user: realUserWhere,
					},
				}),
				prisma.tenantLicense.count({ where: { isDemo: false } }),
				prisma.tenantLicense.count({ where: { activa: true, isDemo: false } }),
				prisma.tenantLicense.count({
					where: {
						activa: true,
						isDemo: false,
						expiracion: {
							lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
							gte: new Date(),
						},
					},
				}),
			]);
		const usersByRole = await prisma.user.groupBy({
			by: ["role"],
			where: realUserWhere,
			_count: true,
		});

		// Obtener nuevos usuarios de los últimos 14 días para comparar semanas
		const fourteenDaysAgo = new Date();
		fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);

		const usersHistoricos = await prisma.user.findMany({
			where: {
				createdAt: { gte: fourteenDaysAgo },
				...realUserWhere,
			},
			select: {
				createdAt: true,
			},
			orderBy: { createdAt: 'asc' },
			take: 10000, // Límite de seguridad
		});

		const usersTrendSeries = groupByLastNDays(usersHistoricos, () => 1, 14);
		const previousUsersTrend = usersTrendSeries.slice(0, 7);
		const usersTrend = usersTrendSeries.slice(-7).map(({ fecha, value }) => ({
			fecha,
			usuarios: value,
		}));
		const previous7DaysUsers = previousUsersTrend.reduce(
			(sum, day) => sum + day.value,
			0,
		);
		const current7DaysUsers = usersTrend.reduce(
			(sum, day) => sum + day.usuarios,
			0,
		);

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
			usersTrend,
			usersComparison: {
				current7DaysUsers,
				previous7DaysUsers,
			},
		};
	},
);

export const getAdminFinanceAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const realTenantWhere = { licencias: { some: { isDemo: false } } };
		const realTenantRelationWhere = { tenant: realTenantWhere };
		const [
			ventas,
			ventasServicios,
			gastos,
			cuentasPorCobrar,
			cuentasPorPagar,
			tenantCount,
		] = await Promise.all([
			prisma.venta.aggregate({
				where: { deletedAt: null, ...realTenantRelationWhere },
				_count: true,
				_sum: { total: true },
			}),
			prisma.ventaServicios.aggregate({
				where: realTenantRelationWhere,
				_count: true,
				_sum: { total: true },
			}),
			prisma.gastosDE.aggregate({
				where: realTenantRelationWhere,
				_count: true,
				_sum: { monto: true },
			}),
			prisma.cuentaPorCobrar.aggregate({
				where: realTenantRelationWhere,
				_count: true,
				_sum: { montoDeuda: true, montoPagado: true },
			}),
			prisma.cuentaPorPagar.aggregate({
				where: realTenantRelationWhere,
				_count: true,
				_sum: { saldoPendiente: true },
			}),
			prisma.tenant.count({ where: realTenantWhere }),
		]);
		// Obtener ingresos de los últimos 14 días para comparar semanas
		const fourteenDaysAgo = new Date();
		fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);

		const ventasHistoricas = await prisma.venta.findMany({
			where: {
				createdAt: { gte: fourteenDaysAgo },
				deletedAt: null,
				...realTenantRelationWhere,
			},
			select: {
				createdAt: true,
				total: true,
			},
			orderBy: { createdAt: 'asc' },
			take: 10000, // Límite de seguridad
		});

		const serviciosHistoricos = await prisma.ventaServicios.findMany({
			where: {
				createdAt: { gte: fourteenDaysAgo },
				...realTenantRelationWhere,
			},
			select: {
				createdAt: true,
				total: true,
			},
			orderBy: { createdAt: 'asc' },
			take: 10000, // Límite de seguridad
		});

		const revenueTrendSeries = groupByLastNDays(
			[
				...ventasHistoricas,
				...serviciosHistoricos,
			],
			(item) => Number(item.total),
			14,
		);
		const previousRevenueTrend = revenueTrendSeries.slice(0, 7);
		const revenueTrend = revenueTrendSeries.slice(-7).map(({ fecha, value }) => ({
			fecha,
			ingresos: value,
		}));
		const previous7DaysRevenue = previousRevenueTrend.reduce(
			(sum, day) => sum + day.value,
			0,
		);
		const current7DaysRevenue = revenueTrend.reduce(
			(sum, day) => sum + day.ingresos,
			0,
		);

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
			revenueTrend,
			revenueComparison: {
				current7DaysRevenue,
				previous7DaysRevenue,
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

export const getCloudinaryAssetsAction = withAction(
	async (input: CloudinaryAssetsQueryInput, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");

		const parsed = cloudinaryAssetsQuerySchema.parse(input ?? {});
		const where = {
			...(parsed.status !== "all" ? { status: parsed.status } : {}),
			...(parsed.ownerType ? { ownerType: parsed.ownerType } : {}),
			...(parsed.ownerId ? { ownerId: parsed.ownerId } : {}),
			...(parsed.slot ? { slot: parsed.slot } : {}),
			...(parsed.tenantId ? { tenantId: parsed.tenantId } : {}),
		};

		const [counts, assets] = await Promise.all([
			prisma.cloudinaryAsset.groupBy({
				by: ["status"],
				_count: { status: true },
			}),
			prisma.cloudinaryAsset.findMany({
				where,
				orderBy: [{ updatedAt: "asc" }, { createdAt: "asc" }],
				take: parsed.limit,
			}),
		]);

		const summary = counts.reduce<Record<string, number>>((acc, item) => {
			acc[item.status] = item._count.status;
			return acc;
		}, {});

		return {
			summary: {
				active: summary.active ?? 0,
				replaced: summary.replaced ?? 0,
				deleted: summary.deleted ?? 0,
			},
			assets,
		};
	},
);

export const cleanupCloudinaryAssetsAction = withAction(
	async (input: CloudinaryCleanupInput, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");

		const parsed = cloudinaryCleanupSchema.parse(input ?? {});
		const cutoff = new Date(
			Date.now() - parsed.olderThanDays * 24 * 60 * 60 * 1000,
		);

		const where =
			parsed.mode === "selected"
				? {
						assetId: { in: parsed.assetIds },
					}
				: {
						status: "replaced",
						deletedAt: null,
						updatedAt: { lte: cutoff },
						...(parsed.ownerType ? { ownerType: parsed.ownerType } : {}),
						...(parsed.ownerId ? { ownerId: parsed.ownerId } : {}),
						...(parsed.slot ? { slot: parsed.slot } : {}),
						...(parsed.tenantId ? { tenantId: parsed.tenantId } : {}),
					};

		const assets = await prisma.cloudinaryAsset.findMany({
			where,
			orderBy: [{ updatedAt: "asc" }, { createdAt: "asc" }],
			take: parsed.limit,
		});

		if (parsed.mode === "selected" && assets.length === 0) {
			throw new ActionError("No se encontraron assets para limpiar", "NOT_FOUND");
		}

		if (parsed.dryRun) {
			await AuditLogService.log({
				accion: "VALIDATE",
				entidad: "CLOUDINARY_ASSET",
				entidadId: parsed.mode === "selected" ? "selected" : "stale",
				usuarioId: user.userId,
				detalles: {
					mode: parsed.mode,
					matched: assets.length,
					olderThanDays: parsed.olderThanDays,
					tenantId: parsed.tenantId ?? null,
					ownerType: parsed.ownerType ?? null,
					ownerId: parsed.ownerId ?? null,
					slot: parsed.slot ?? null,
					assetIds: parsed.assetIds,
				},
			});
			return {
				dryRun: true,
				matched: assets.length,
				assets,
			};
		}

		let deleted = 0;
		const failed: Array<{ assetId: string; publicId: string; reason: string }> = [];

		for (const asset of assets) {
			try {
				const result = await destroyCloudinaryAsset({
					publicId: asset.publicId,
					resourceType:
						asset.resourceType === "raw" ? "raw" : "image",
				});

				if (result.result !== "ok" && result.result !== "not found") {
					throw new Error(`Cloudinary respondió ${result.result}`);
				}

				await prisma.cloudinaryAsset.update({
					where: { publicId: asset.publicId },
					data: {
						status: "deleted",
						deletedAt: new Date(),
					},
				});
				deleted += 1;
			} catch (error) {
				failed.push({
					assetId: asset.assetId,
					publicId: asset.publicId,
					reason: error instanceof Error ? error.message : "Error desconocido",
				});
			}
		}

		revalidatePath("/admin");
		await AuditLogService.log({
			accion: "EXECUTE",
			entidad: "CLOUDINARY_ASSET",
			entidadId: parsed.mode === "selected" ? "selected" : "stale",
			usuarioId: user.userId,
			detalles: {
				mode: parsed.mode,
				matched: assets.length,
				deleted,
				failed,
				olderThanDays: parsed.olderThanDays,
				tenantId: parsed.tenantId ?? null,
				ownerType: parsed.ownerType ?? null,
				ownerId: parsed.ownerId ?? null,
				slot: parsed.slot ?? null,
				assetIds: parsed.assetIds,
				publicIds: assets.map((asset) => asset.publicId),
			},
		});
		return {
			dryRun: false,
			matched: assets.length,
			deleted,
			failed,
		};
	},
);

// ─── Expiring Users ────────────────────────────────────────

export const getExpiringSoonAction = withAction(
	async (input: { days?: number } = {}, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const days = input.days || 7;
		const limit = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
		const users = await prisma.user.findMany({
			where: { expiresAt: { not: null, lte: limit }, isActive: true },
			orderBy: { expiresAt: "asc" },
		});
		const usersWithExpiry = users.map((u) => {
			const daysUntilExpiry = u.expiresAt
				? Math.ceil(
							(new Date(u.expiresAt).getTime() - Date.now()) /
								(1000 * 60 * 60 * 24),
					)
				: 0;
			return { ...u, daysUntilExpiry };
		});
		return { users: usersWithExpiry };
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

		// Activar usuario y cerrar el flujo de onboarding del worker
		await prisma.user.update({
			where: { userId: membership.userId },
			data: { isActive: true, onboardingStatus: null },
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
		const licenses = await prisma.tenantLicense.findMany({
			orderBy: { createdAt: "desc" },
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
		});

		const createdByIds = Array.from(
			new Set(
				licenses
					.map((license) => license.createdBy)
					.filter((value): value is string => Boolean(value)),
			),
		);

		if (createdByIds.length === 0) {
			return licenses;
		}

		const creators = await prisma.user.findMany({
			where: {
				userId: {
					in: createdByIds,
				},
			},
			select: {
				userId: true,
				name: true,
				email: true,
			},
		});

		const creatorsById = new Map(
			creators.map((creator) => [creator.userId, creator]),
		);

		return licenses.map((license) => ({
			...license,
			createdByUser: license.createdBy
				? creatorsById.get(license.createdBy) ?? null
				: null,
		}));
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

export const createDemoTenantAction = withAction(
	async (input: CreateDemoTenantInput, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");

		const parsed = createDemoTenantSchema.parse(input);

		const demo = await createDemoTenantForPlan({
			planId: parsed.planId,
			demoName: parsed.demoName,
			durationDays: parsed.durationDays,
			createdBy: user.userId,
		});

		await seedDemoTenantData({
			tenantId: demo.tenantId,
			planName: demo.planName,
		});

		revalidatePath("/admin/licencias");

		return demo;
	},
);

export const cleanupExpiredDemoLicenciasAction = withAction(
	async (
		input: CleanupExpiredDemoLicenciasInput | undefined,
		user: AuthenticatedUser,
	) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");

		const parsed = cleanupExpiredDemoLicenciasSchema.parse(input ?? {});
		const now = new Date();
		const expiredDemoLicenses = await prisma.tenantLicense.findMany({
			where: {
				isDemo: true,
				activa: true,
				expiracion: { lt: now },
			},
			select: {
				tenantLicenseId: true,
				tenantId: true,
				expiracion: true,
			},
		});

		if (!parsed.dryRun && expiredDemoLicenses.length > 0) {
			await prisma.tenantLicense.updateMany({
				where: {
					tenantLicenseId: {
						in: expiredDemoLicenses.map((license) => license.tenantLicenseId),
					},
				},
				data: { activa: false },
			});
			revalidatePath("/admin/licencias");
		}

		return {
			dryRun: parsed.dryRun,
			count: expiredDemoLicenses.length,
			licenses: expiredDemoLicenses,
		};
	},
);

export const convertDemoToPaidPlanAction = withAction(
	async (input: ConvertDemoToPaidPlanInput, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");

		const parsed = convertDemoToPaidPlanSchema.parse(input);
		const [license, plan] = await Promise.all([
			prisma.tenantLicense.findUnique({
				where: { tenantLicenseId: parsed.tenantLicenseId },
				include: {
					tenant: {
						include: {
							memberships: {
								where: { isActive: true },
								select: { userId: true },
							},
						},
					},
				},
			}),
			prisma.plan.findUnique({ where: { planId: parsed.planId } }),
		]);

		if (!license)
			throw new ActionError("Licencia demo no encontrada", "NOT_FOUND");
		if (!license.isDemo)
			throw new ActionError("La licencia ya no es demo", "INVALID_STATE");
		if (!plan)
			throw new ActionError("Plan no encontrado", "PLAN_NOT_FOUND");

		const now = new Date();
		const durationDays = parsed.durationDays ?? plan.duracionDias;
		const expiracion = new Date(now.getTime() + durationDays * 86400000);

		const updatedLicense = await prisma.tenantLicense.update({
			where: { tenantLicenseId: parsed.tenantLicenseId },
			data: {
				planId: plan.planId,
				isDemo: false,
				activa: true,
				inicio: now,
				expiracion,
				maxUsuarios: plan.maxUsuarios,
				maxAlmacenes: plan.maxAlmacenes,
				maxProductos: plan.maxProductos,
				maxClientes: plan.maxClientes,
				features: Prisma.JsonNull,
				featureOverrides: {},
			},
		});

		const userIds = license.tenant.memberships.map((membership) => membership.userId);
		if (userIds.length > 0) {
			await prisma.user.updateMany({
				where: { userId: { in: userIds } },
				data: { expiresAt: expiracion, isActive: true },
			});
		}

		revalidatePath("/admin/licencias");

		return {
			tenantId: license.tenantId,
			tenantLicenseId: updatedLicense.tenantLicenseId,
			planId: plan.planId,
			isDemo: false,
			expiresAt: expiracion,
		};
	},
);



export const changePlanAction = withAction(
	async (input: ChangePlanInput, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");

		const parsed = changePlanSchema.parse(input);

		const [license, newPlan] = await Promise.all([
			prisma.tenantLicense.findUnique({
				where: { tenantLicenseId: parsed.tenantLicenseId },
			}),
			prisma.plan.findUnique({ where: { planId: parsed.planId } }),
		]);

		if (!license)
			throw new ActionError("Licencia no encontrada", "NOT_FOUND");
		if (!newPlan)
			throw new ActionError("Plan no encontrado", "PLAN_NOT_FOUND");

		const updated = await prisma.tenantLicense.update({
			where: { tenantLicenseId: parsed.tenantLicenseId },
			data: {
				planId: newPlan.planId,
				maxUsuarios: newPlan.maxUsuarios,
				maxAlmacenes: newPlan.maxAlmacenes,
				maxProductos: newPlan.maxProductos,
				maxClientes: newPlan.maxClientes,
				features: Prisma.JsonNull,
				featureOverrides: {},
			},
		});

		await AuditLogService.log({
			accion: "UPDATE",
			entidad: "TENANT_LICENSE",
			entidadId: license.tenantLicenseId,
			usuarioId: user.userId,
			detalles: {
				tenantId: license.tenantId,
				previousPlanId: license.planId,
				newPlanId: newPlan.planId,
			},
		});

		revalidatePath("/admin/licencias");

		return {
			tenantLicenseId: updated.tenantLicenseId,
			planId: updated.planId,
			planName: newPlan.nombre,
		};
	},
);

export const updateLicenciaAction = withAction(
	async (input: UpdateLicenciaInput, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		const parsed = updateLicenciaSchema.parse(input);
		const { id, ...data } = parsed;
		const licencia = await prisma.tenantLicense.update({
			where: { tenantLicenseId: id },
			data,
		});
		revalidatePath("/admin");
		return licencia;
	},
);

export const updateLicenseAccountingOverridesAction = withAction(
	async (input: UpdateLicenseAccountingOverridesInput, user: AuthenticatedUser) => {
		if (user.role !== "admin") {
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		}

		const parsed = updateLicenseAccountingOverridesSchema.parse(input);
		const existingLicense = await prisma.tenantLicense.findUnique({
			where: { tenantLicenseId: parsed.id },
			select: {
				tenantLicenseId: true,
				featureOverrides: true,
			},
		});

		if (!existingLicense) {
			throw new ActionError("Licencia no encontrada", "NOT_FOUND");
		}

		const mergedOverrides = mergeAccountingFeatureOverrides(
			existingLicense.featureOverrides &&
				typeof existingLicense.featureOverrides === "object" &&
				!Array.isArray(existingLicense.featureOverrides)
				? (existingLicense.featureOverrides as Record<string, boolean>)
				: {},
			parsed.featureOverrides,
		);

		const licencia = await prisma.tenantLicense.update({
			where: { tenantLicenseId: parsed.id },
			data: {
				featureOverrides: mergedOverrides,
			},
		});

		revalidatePath("/admin/licencias");
		return licencia;
	},
);

export const deleteLicenciaAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		await prisma.tenantLicense.delete({
			where: { tenantLicenseId: id },
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

export const getAuditLogsAction = withAction(
	async (input: { limit?: number }, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");
		
		const limit = input?.limit || 100;
		
		const logs = await prisma.auditLog.findMany({
			orderBy: { createdAt: "desc" },
			take: limit,
		});

		// Obtener nombres de usuarios
		const userIds = [...new Set(logs.map(log => log.usuarioId))];
		const users = await prisma.user.findMany({
			where: { userId: { in: userIds } },
			select: { userId: true, name: true, email: true },
		});
		
		const userMap = new Map(users.map(u => [u.userId, u]));

		return logs.map((log) => {
			const user = userMap.get(log.usuarioId);
			return {
				id: log.id,
				userId: log.usuarioId,
				userName: user?.name || "Sistema",
				userEmail: user?.email || "",
				action: log.accion,
				entityType: log.entidad,
				entityId: log.entidadId,
				metadata: log.detalles,
				ip: log.ip,
				userAgent: log.userAgent,
				createdAt: log.createdAt.toISOString(),
			};
		});
	},
);


export const getAdminSubscriptionRevenueAction = withAction(
	async (input: { months?: number; startDate?: string; endDate?: string } | void, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");

		// Determinar rango de fechas
		const months = input?.months || 6;
		const endDate = input?.endDate ? new Date(input.endDate) : new Date();
		const startDate = input?.startDate 
			? new Date(input.startDate) 
			: new Date(new Date().setMonth(endDate.getMonth() - months));

		// Obtener todas las licencias con sus planes
		const allLicenses = await prisma.tenantLicense.findMany({
			where: {
				isDemo: false,
				isAdminTest: false,
				OR: [
					{ createdAt: { gte: startDate, lte: endDate } },
					{ updatedAt: { gte: startDate, lte: endDate } },
					{ activa: true },
				],
			},
			include: {
				plan: true,
				tenant: {
					select: {
						nombre: true,
						tenantId: true,
					},
				},
			},
		});

		const activeLicenses = allLicenses.filter((l) => l.activa);
		const inactiveLicenses = allLicenses.filter((l) => !l.activa);

		// Calcular MRR (Monthly Recurring Revenue)
		const mrr = activeLicenses.reduce((sum, license) => {
			if (!license.plan) return sum;
			const planPrecio = Number(license.plan.precio);
			// Normalizar a mensual según duración
			const monthlyPrice = planPrecio / (license.plan.duracionDias / 30);
			return sum + monthlyPrice;
		}, 0);

		// Calcular ARR (Annual Recurring Revenue)
		const arr = mrr * 12;

		// Distribución de ingresos por plan
		const revenueByPlanMap = new Map<string, { planId: string; nombre: string; tenants: number; mrr: number; precio: number }>();
		
		activeLicenses.forEach((license) => {
			if (!license.plan) return;
			const planId = license.planId!;
			const monthlyPrice = Number(license.plan.precio) / (license.plan.duracionDias / 30);
			
			if (revenueByPlanMap.has(planId)) {
				const existing = revenueByPlanMap.get(planId)!;
				existing.tenants += 1;
				existing.mrr += monthlyPrice;
			} else {
				revenueByPlanMap.set(planId, {
					planId,
					nombre: license.plan.nombre,
					tenants: 1,
					mrr: monthlyPrice,
					precio: Number(license.plan.precio),
				});
			}
		});

		const revenueByPlan = Array.from(revenueByPlanMap.values()).sort((a, b) => b.mrr - a.mrr);

		// Calcular Churn Rate (últimos 30 días)
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		
		const canceledLast30Days = inactiveLicenses.filter(
			(l) => l.updatedAt >= thirtyDaysAgo
		).length;
		
		const totalLicensesLast30Days = activeLicenses.length + canceledLast30Days;
		const churnRate = totalLicensesLast30Days > 0
			? (canceledLast30Days / totalLicensesLast30Days) * 100
			: 0;

		// Calcular LTV (Lifetime Value)
		// LTV = (Precio promedio mensual / Churn Rate) * 100
		// Si churn es 0, usar promedio de duración de licencias
		const avgMonthlyPrice = activeLicenses.length > 0 ? mrr / activeLicenses.length : 0;
		const avgLicenseDurationDays = activeLicenses.length > 0
			? activeLicenses.reduce((sum, l) => {
				const duration = (l.expiracion.getTime() - l.inicio.getTime()) / (1000 * 60 * 60 * 24);
				return sum + duration;
			}, 0) / activeLicenses.length
			: 30;
		
		const avgLifetimeMonths = avgLicenseDurationDays / 30;
		const ltv = churnRate > 0
			? (avgMonthlyPrice / churnRate) * 100
			: avgMonthlyPrice * avgLifetimeMonths;

		// Histórico de pagos (creación/renovación de licencias)
		const licenseHistory: Array<{ mes: string; nuevasLicencias: number; renovaciones: number; ingresos: number; mrr: number; licenciasActivas: number }> = [];
		
		// Calcular meses entre startDate y endDate
		const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1;
		const numMonths = Math.min(Math.max(monthsDiff, 1), 24); // Máximo 24 meses
		
		for (let i = 0; i < numMonths; i++) {
			const monthStart = new Date(endDate.getFullYear(), endDate.getMonth() - (numMonths - 1 - i), 1);
			const monthEnd = new Date(endDate.getFullYear(), endDate.getMonth() - (numMonths - 1 - i) + 1, 0, 23, 59, 59);
			
			const newLicenses = allLicenses.filter(
				(l) => l.createdAt >= monthStart && l.createdAt <= monthEnd
			);
			
			const renewals = allLicenses.filter(
				(l) => l.updatedAt >= monthStart && l.updatedAt <= monthEnd && l.createdAt < monthStart
			);
			
			const revenue = [
				...newLicenses,
				...renewals,
			]
				.filter((l) => l.plan)
				.reduce((sum, l) => sum + Number(l.plan!.precio), 0);
			
			// Calcular MRR al final de ese mes (licencias activas en ese momento)
			const activeAtMonthEnd = allLicenses.filter(
				(l) => l.inicio <= monthEnd && l.expiracion >= monthEnd && l.activa
			);
			
			const mrrAtMonthEnd = activeAtMonthEnd.reduce((sum, l) => {
				if (!l.plan) return sum;
				const monthlyPrice = Number(l.plan.precio) / (l.plan.duracionDias / 30);
				return sum + monthlyPrice;
			}, 0);
			
			licenseHistory.push({
				mes: monthStart.toISOString().slice(0, 7), // YYYY-MM
				nuevasLicencias: newLicenses.length,
				renovaciones: renewals.length,
				ingresos: revenue,
				mrr: Math.round(mrrAtMonthEnd * 100) / 100,
				licenciasActivas: activeAtMonthEnd.length,
			});
		}

		// Ingresos proyectados
		const now = new Date();
		const expiringThisMonth = activeLicenses.filter((l) => {
			const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
			return l.expiracion >= now && l.expiracion <= monthEnd;
		});

		const projectedRevenue = expiringThisMonth.reduce((sum, l) => {
			if (!l.plan) return sum;
			return sum + Number(l.plan.precio);
		}, 0);

		const newLicensesThisMonth = allLicenses.filter(
			(l) => l.createdAt >= new Date(now.getFullYear(), now.getMonth(), 1)
		).length;

		// Comparación mes a mes
		const currentMonth = licenseHistory[licenseHistory.length - 1];
		const previousMonth = licenseHistory[licenseHistory.length - 2];
		
		const comparison = previousMonth && currentMonth ? {
			mrrChange: currentMonth.mrr - previousMonth.mrr,
			mrrChangePercent: previousMonth.mrr > 0 
				? Math.round(((currentMonth.mrr - previousMonth.mrr) / previousMonth.mrr) * 10000) / 100
				: 0,
			revenueChange: currentMonth.ingresos - previousMonth.ingresos,
			revenueChangePercent: previousMonth.ingresos > 0
				? Math.round(((currentMonth.ingresos - previousMonth.ingresos) / previousMonth.ingresos) * 10000) / 100
				: 0,
			licensesChange: currentMonth.licenciasActivas - previousMonth.licenciasActivas,
		} : null;

		return {
			mrr: Math.round(mrr * 100) / 100,
			arr: Math.round(arr * 100) / 100,
			revenueByPlan,
			activeLicenses: activeLicenses.length,
			inactiveLicenses: inactiveLicenses.length,
			avgRevenuePerTenant: activeLicenses.length > 0 
				? Math.round((mrr / activeLicenses.length) * 100) / 100 
				: 0,
			churnRate: Math.round(churnRate * 100) / 100,
			ltv: Math.round(ltv * 100) / 100,
			licenseHistory,
			comparison,
			dateRange: {
				start: startDate.toISOString(),
				end: endDate.toISOString(),
				months: numMonths,
			},
			projectedRevenue: {
				fromExpiring: Math.round(projectedRevenue * 100) / 100,
				fromNew: newLicensesThisMonth,
				expiringCount: expiringThisMonth.length,
			},
		};
	},
);
