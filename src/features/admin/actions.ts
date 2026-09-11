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
import { addDays } from "@/lib/date-utils";
import { createTenantForUser } from "@/lib/services/tenant-factory";
import { resolveLicenseDurationDays } from "@/lib/services/license-duration";
import {
	isTenantReferred,
	resolveLicensePricing,
} from "@/lib/services/plan-pricing";
import {
	generateSalesAgentReferralCode,
	isUniqueConstraintCollision,
} from "@/features/sales-agent/referral-code";
import {
	createSalesAgentEvent,
	deliverSalesAgentEmails,
} from "@/features/sales-agent/services/notification-service";
import { hasPermission } from "@/lib/services/tenant-scope";
import { computeAdminStatus, countEffectiveAdmins } from "@/lib/auth/last-admin-guard";
import { confirmSalesAgentTenantPayment } from "@/features/sales-agent/services/payment-service";
import { confirmReferredTenantPaymentAction } from "@/features/affiliate/actions";
import { createDemoTenantForPlan } from "@/lib/services/demo-tenant-factory";
import { prismaPlatform as prisma } from "@/lib/db/platform-prisma";
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
	renewLicenciaSchema,
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
	RenewLicenciaInput,
	UpdateLicenseAccountingOverridesInput,
	CreatePlanInput,
	UpdatePlanInput,
	UpdateTenantUserInput,
	GetLicenciasQueryInput,
} from "./schemas";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import { mergeAccountingFeatureOverrides } from "./license-feature-overrides";
import {
	approveAdminMembership,
	getAdminHealth,
	getAdminPendingMemberships,
	getAdminTenants,
	getAdminUsers,
	groupByLastNDays,
	lockAdminUser,
	rejectAdminMembership,
	unlockAdminUser,
} from "./server/admin-global-queries";

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
		if (parsed.tenantRole && adminTenantId && parsed.role !== "salesAgent") {
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

		// ── Crear perfil de Gestor de Ventas si el rol es salesAgent ──
		if (parsed.role === "salesAgent") {
			const referralCode = generateSalesAgentReferralCode();
			try {
				await prisma.salesAgentProfile.create({
					data: {
						userId: newUser.userId,
						status: "active",
						referralCode,
						approvedAt: new Date(),
						approvedByAdminId: user.userId,
					},
				});
				await prisma.salesAgentBalance.upsert({
					where: { userId: newUser.userId },
					create: { userId: newUser.userId },
					update: {},
				});
			} catch (error) {
				if (isUniqueConstraintCollision(error)) {
					throw new ActionError(
						"El código de referido generado colisionó. Intentá crear el usuario nuevamente",
						"REFERRAL_CODE_COLLISION",
					);
				}
				throw error;
			}
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

		// ── Crear perfil de Gestor de Ventas si se asigna ese rol ──
		if (data.role === "salesAgent") {
			// El gestor de ventas es tenantless: se limpian membresías previas.
			await prisma.tenantMembership.deleteMany({ where: { userId } });

			const existingProfile = await prisma.salesAgentProfile.findUnique({
				where: { userId },
				select: { salesAgentProfileId: true },
			});
			if (!existingProfile) {
				const referralCode = generateSalesAgentReferralCode();
				try {
					await prisma.salesAgentProfile.create({
						data: {
							userId,
							status: "active",
							referralCode,
							approvedAt: new Date(),
							approvedByAdminId: user.userId,
						},
					});
					await prisma.salesAgentBalance.upsert({
						where: { userId },
						create: { userId },
						update: {},
					});
				} catch (error) {
					if (isUniqueConstraintCollision(error)) {
						throw new ActionError(
							"El código de referido generado colisionó. Intentá guardar nuevamente",
							"REFERRAL_CODE_COLLISION",
						);
					}
					throw error;
				}
			}
		}
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
			select: {
				userId: true,
				role: true,
				salesAgentBalance: { select: { salesAgentBalanceId: true } },
				_count: {
					select: {
						salesAgentReferrals: true,
						salesAgentCommissions: true,
						salesAgentPayouts: true,
					},
				},
			},
		});
		if (!existing) throw new ActionError("Usuario no encontrado", "NOT_FOUND");

		const hasSalesAgentRecords =
			existing.salesAgentBalance !== null ||
			existing._count.salesAgentReferrals > 0 ||
			existing._count.salesAgentCommissions > 0 ||
			existing._count.salesAgentPayouts > 0;

		if (hasSalesAgentRecords) {
			throw new ActionError(
				"No se puede eliminar un Gestor de Ventas con registros asociados (balance, referidos, comisiones o pagos). Desactiva el usuario en su lugar",
				"SALES_AGENT_WITH_RECORDS",
			);
		}

		await prisma.user.deleteMany({ where: { userId } });
		revalidatePath("/admin");
		return { success: true, userId };
	},
);

export const lockUserAction = withAction(lockAdminUser);

export const unlockUserAction = withAction(unlockAdminUser);

// ─── Global Users ─────────────────────────────────────────

export const getGlobalUsersAction = withAction(getAdminUsers);

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
								"Ya puedes compartir tu código y gestionar tus referidos.",
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

		// Tipo "worker" o legacy: solo activar usuario y limpiar onboardingStatus.
		// Los workers se unen a un tenant existente; su expiración se sincroniza
		// con la licencia del tenant en renovación/conversión (renewLicenciaAction
		// y convertDemoToPaidPlanAction). Un override manual se valida y aplica.
		const workerExpiresAt =
			input.licenseDurationDays !== undefined
				? addDays(
						new Date(),
						resolveLicenseDurationDays(
							undefined,
							input.licenseDurationDays,
						)!,
					)
				: null;
		await prisma.user.update({
			where: { userId: input.userId },
			data: {
				isActive: true,
				onboardingStatus: null,
				expiresAt: workerExpiresAt,
			},
		});
		return { success: true, tenantCreated: false };
	},
);

// ─── Admin Dashboard Data ──────────────────────────────────

export const getAdminTenantsAction = withAction(getAdminTenants);


export const getAdminSystemHealthAction = withAction(getAdminHealth);

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

export const getPendingMembershipsAction = withAction(getAdminPendingMemberships);

export const approveMembershipAction = withAction(approveAdminMembership);

export const rejectMembershipAction = withAction(rejectAdminMembership);

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

		// Solo quien tiene permiso config.usuarios.gestionar en el tenant
		if (!hasPermission(user, "config.usuarios.gestionar")) {
			throw new ActionError(
				"Solo un usuario autorizado puede gestionar usuarios del tenant",
				"FORBIDDEN",
			);
		}

		if (!user.tenantId) {
			throw new ActionError("No tienes un tenant asignado", "FORBIDDEN");
		}

		// Verificar que el usuario pertenece al mismo tenant
		const membership = await prisma.tenantMembership.findFirst({
			where: { userId, tenantId: user.tenantId },
			select: { membershipId: true, tenantRole: true, isActive: true, customRoleId: true },
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
				"No puedes modificar tu propio usuario desde aquí",
				"FORBIDDEN",
			);
		}

		// Guarda de último admin (hallazgo #3): no degradar ni desactivar al
		// último administrador efectivo del tenant.
		const nextFixedRole = tenantRole ?? membership.tenantRole;
		const nextActive = isActive ?? membership.isActive;
		const wasAdmin = await computeAdminStatus({
			tenantId: user.tenantId,
			fixedRole: membership.tenantRole,
			isActive: membership.isActive,
			customRoleId: membership.customRoleId,
		});
		const willBeAdmin = await computeAdminStatus({
			tenantId: user.tenantId,
			fixedRole: nextFixedRole,
			isActive: nextActive,
			customRoleId: membership.customRoleId,
		});
		if (wasAdmin && !willBeAdmin && (await countEffectiveAdmins(user.tenantId)) <= 1) {
			throw new ActionError(
				"No se puede degradar o desactivar al último administrador de la empresa.",
				"LAST_MANAGER",
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
				data: {
					isActive,
					...(isActive ? { onboardingStatus: null } : {}),
				},
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
		const durationDays = resolveLicenseDurationDays(
			plan.duracionDias,
			parsed.durationDays,
		)!;
		const expiracion = addDays(now, durationDays);
		const referred = await isTenantReferred(license.tenantId);

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
				...resolveLicensePricing(Number(plan.precio), referred),
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

		const referred = await isTenantReferred(license.tenantId);

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
				...resolveLicensePricing(Number(newPlan.precio), referred),
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

/**
 * @description Renueva la vigencia de una TenantLicense, sumando los días del
 * plan a la expiración actual (preserva días pendientes). Puede cambiar de
 * plan y, opcionalmente, registrar el pago presencial. Si el tenant es
 * referido por un gestor de ventas, acredita la comisión correspondiente
 * (idempotente); si es referido por afiliado, registra el pago sin comisión
 * de renovación. Reactiva licencias inactivas, sincroniza el `expiresAt` de
 * los usuarios del tenant e inserta un AuditLog transaccional con el diff.
 * @remarks `updateLicenciaAction` acepta `expiracion` pero no expone renovación
 * con auditoría ni sincronización de usuarios; esta es la vía canónica.
 */
export const renewLicenciaAction = withAction(
	async (input: RenewLicenciaInput, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");

		const parsed = renewLicenciaSchema.parse(input);

		let referred = false;
		let salesAgentReferred = false;
		let affiliateReferred = false;
		if (parsed.registerPayment) {
			const peek = await prisma.tenantLicense.findUnique({
				where: { tenantLicenseId: parsed.tenantLicenseId },
				select: { tenantId: true },
			});
			if (peek) {
				const [salesAgentRef, affiliateRef] = await Promise.all([
					prisma.salesAgentReferral.findUnique({
						where: { referredTenantId: peek.tenantId },
						select: { salesAgentReferralId: true },
					}),
					prisma.affiliateReferral.findUnique({
						where: { referredTenantId: peek.tenantId },
						select: { referralId: true },
					}),
				]);
				salesAgentReferred = Boolean(salesAgentRef);
				affiliateReferred = Boolean(affiliateRef);
				referred = salesAgentReferred || affiliateReferred;
			}
		}

		const outcome = await prisma.$transaction(async (tx) => {
			const [license, newPlan, activeMembership] = await Promise.all([
				tx.tenantLicense.findUnique({
					where: { tenantLicenseId: parsed.tenantLicenseId },
					include: { plan: true },
				}),
				tx.plan.findUnique({ where: { planId: parsed.planId } }),
				tx.tenantMembership.findFirst({
					where: {
						tenant: { licencias: { some: { tenantLicenseId: parsed.tenantLicenseId } } },
						isActive: true,
						user: { isActive: true },
					},
					select: { membershipId: true, userId: true, tenantId: true },
				}),
			]);

			if (!license)
				throw new ActionError("Licencia no encontrada", "NOT_FOUND");
			if (!newPlan)
				throw new ActionError("Plan no encontrado", "PLAN_NOT_FOUND");
			if (!activeMembership)
				throw new ActionError(
					"El tenant no tiene miembros activos",
					"TENANT_NOT_ACTIVE",
				);

			const now = new Date();
			const baseExpiracion =
				license.expiracion.getTime() > now.getTime()
					? license.expiracion
					: now;
			const renewDurationDays = resolveLicenseDurationDays(
				newPlan.duracionDias,
			)!;
			const newExpiracion = addDays(baseExpiracion, renewDurationDays);

			const samePlan = newPlan.planId === license.planId;

			const updated = await tx.tenantLicense.update({
				where: { tenantLicenseId: license.tenantLicenseId },
				data: {
					planId: newPlan.planId,
					expiracion: newExpiracion,
					activa: true,
					maxUsuarios: newPlan.maxUsuarios,
					maxAlmacenes: newPlan.maxAlmacenes,
					maxProductos: newPlan.maxProductos,
					maxClientes: newPlan.maxClientes,
					features: samePlan ? (license.features as Prisma.InputJsonValue) : Prisma.JsonNull,
					featureOverrides: samePlan ? (license.featureOverrides ?? {}) : {},
					...resolveLicensePricing(Number(newPlan.precio), referred),
				},
			});

			await tx.user.updateMany({
				where: {
					tenantMemberships: { some: { tenantId: activeMembership.tenantId, isActive: true } },
					isActive: true,
				} as any,
				data: { expiresAt: newExpiracion, isActive: true },
			});

			let registeredPaymentId: string | null = null;
			let duplicate = false;

			if (parsed.registerPayment && !salesAgentReferred) {
				const expectedAmount = new Prisma.Decimal(
					updated.finalPriceUsd ?? updated.listPriceUsd ?? newPlan.precio ?? 0,
				).toDecimalPlaces(2);
				const paidAmount = parsed.amountPaidUsd !== undefined
					? new Prisma.Decimal(parsed.amountPaidUsd).toDecimalPlaces(2)
					: expectedAmount;
				if (!paidAmount.equals(expectedAmount)) {
					throw new ActionError(
						"El monto pagado no coincide con el monto exigible",
						"PAYMENT_AMOUNT_MISMATCH",
					);
				}
				const existingPayment = await tx.tenantLicensePayment.findUnique({
					where: { idempotencyKey: parsed.idempotencyKey as string },
					select: { tenantLicensePaymentId: true },
				});
				if (existingPayment) {
					registeredPaymentId = existingPayment.tenantLicensePaymentId;
					duplicate = true;
				} else {
					const payment = await tx.tenantLicensePayment.create({
						data: {
							tenantId: activeMembership.tenantId,
							tenantLicenseId: updated.tenantLicenseId,
							paymentKind: "renewal",
							expectedAmountUsd: expectedAmount,
							amountPaidUsd: paidAmount,
							idempotencyKey: parsed.idempotencyKey as string,
							immutableFingerprint: parsed.idempotencyKey as string,
							paymentCycleEndsAt: newExpiracion,
							licenseExpirationSnapshot: newExpiracion,
							confirmedByAdminId: user.userId,
							status: "confirmed",
						},
					});
					registeredPaymentId = payment.tenantLicensePaymentId;
				}
			}

			await AuditLogService.logStrict(
				{
					accion: "UPDATE",
					entidad: "TENANT_LICENSE",
					entidadId: updated.tenantLicenseId,
					usuarioId: user.userId,
					detalles: {
						tenantId: activeMembership.tenantId,
						previousExpiracion: license.expiracion.toISOString(),
						newExpiracion: newExpiracion.toISOString(),
						previousPlanId: license.planId,
						newPlanId: newPlan.planId,
						registerPayment: parsed.registerPayment,
						registeredPaymentId,
					},
				},
				tx,
			);

			return {
				tenantLicenseId: updated.tenantLicenseId,
				newExpiracion,
				newPlanId: newPlan.planId,
				registeredPaymentId,
				duplicate,
				previousExpiracion: license.expiracion,
				previousPlanId: license.planId ?? null,
			};
		});

		let commissionCredited = false;
		let duplicate = false;

		if (parsed.registerPayment && salesAgentReferred) {
			const license = await prisma.tenantLicense.findUnique({
				where: { tenantLicenseId: parsed.tenantLicenseId },
				select: {
					tenantId: true,
					finalPriceUsd: true,
					listPriceUsd: true,
					plan: { select: { precio: true } },
				},
			});
			const expectedAmount =
				license?.finalPriceUsd ?? license?.listPriceUsd ?? license?.plan?.precio ?? 0;
			const paidAmount =
				parsed.amountPaidUsd !== undefined ? parsed.amountPaidUsd : Number(expectedAmount);

			const paymentResult = await confirmSalesAgentTenantPayment({
				tenantId: license?.tenantId ?? "",
				tenantLicenseId: parsed.tenantLicenseId,
				idempotencyKey: parsed.idempotencyKey as string,
				amountPaidUsd: paidAmount,
				confirmedByAdminId: user.userId,
			});
			commissionCredited = paymentResult.credited;
			duplicate = paymentResult.duplicate;
		}

		revalidatePath("/admin/licencias");
		revalidatePath("/admin");

		return {
			...outcome,
			duplicate: Boolean(outcome.duplicate || duplicate),
			commissionCredited,
		};
	},
);

/**
 * @description Actualiza campos puntuales de una licencia de tenant.
 * @param {UpdateLicenciaInput} input - Datos a actualizar de la licencia.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<License>} Licencia actualizada.
 * @remarks Para renovar una licencia (extender expiración con cambio de plan
 * y pago opcional), usar `renewLicenciaAction` — que es la vía canónica y
 * sincroniza la expiración de los usuarios del tenant.
 */
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
 * Solo admins de plataforma (role=admin): otorga acceso a un tenant
 * arbitrario, por lo que ningún usuario de tenant puede auto-otorgarse
 * membresías aunque su plan incluya la feature `multitenantmembership`.
 */
export const addTenantMembershipAction = withAction(
	async (input: AddTenantMembershipInput, user: AuthenticatedUser) => {
		if (user.role !== "admin")
			throw new ActionError("Acceso restringido", "FORBIDDEN");

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

		// El usuario ya tiene acceso: cerrar cualquier onboarding pendiente
		await prisma.user.updateMany({
			where: { userId, onboardingStatus: { not: null } },
			data: { onboardingStatus: null },
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
