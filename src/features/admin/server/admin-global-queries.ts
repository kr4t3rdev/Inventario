/**
 * @description Consultas y mutaciones de administración global reutilizables.
 *
 * Lógica extraída de las Server Actions admin (features/admin/actions.ts y
 * actions-licencias.ts) para que las rutas mobile REST puedan reusarla con
 * autenticación Bearer sin depender del contexto de cookies web.
 *
 * @module features/admin/server/admin-global-queries
 */

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { ActionError } from "@/lib/server-actions";
import { hasPermission } from "@/lib/services/tenant-scope";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import { prismaPlatform as prisma } from "@/lib/db/platform-prisma";
import { normalizeUserRole } from "@/lib/auth/roles";
import { signOnboardingToken } from "@/lib/auth/onboarding";
import { getConfiguredPublicAppUrl } from "@/features/sales-agent/public-url";
import {
  sendEmailVerificationLink,
  sendPasswordResetEmail,
} from "@/lib/email";
import {
  generateSalesAgentReferralCode,
  isUniqueConstraintCollision,
} from "@/features/sales-agent/referral-code";
import {
	lockUnlockSchema,
	getLicenciasQuerySchema,
	licenciasStatsQuerySchema,
	adminUserIdSchema,
	adminUpdateUserSchema,
	adminAssignTenantSchema,
	adminChangeTenantRoleSchema,
} from "../schemas";
import type {
	GetLicenciasQueryInput,
	LicenciasStatsQueryInput,
	LockUnlockInput,
	AdminUserIdInput,
	AdminUpdateUserInput,
	AdminAssignTenantInput,
	AdminChangeTenantRoleInput,
} from "../schemas";

/**
 * @description Agrupa elementos por los últimos N días.
 * @param {T[]} items - Elementos con fecha de creación.
 * @param {(item: T) => number} valueExtractor - Extractora de valor por día.
 * @param {number} days - Ventana de días a agrupar.
 * @param {number} offsetDays - Desplazamiento desde hoy.
 * @returns {Array<{ fecha: string; value: number }>} Serie por fecha.
 */
export function groupByLastNDays<T extends { createdAt: Date }>(
  items: T[],
  valueExtractor: (item: T) => number,
  days: number,
  offsetDays = 0,
): Array<{ fecha: string; value: number }> {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i + offsetDays));
    const fecha = date.toISOString().split("T")[0];

    const value = items
      .filter((item) => item.createdAt.toISOString().split("T")[0] === fecha)
      .reduce((sum, item) => sum + valueExtractor(item), 0);

    return { fecha, value };
  });
}

/**
 * @description Construye la cláusula WHERE de Prisma a partir de los filtros de licencias.
 * @param {{ search?: string; planFilter?: string; statusFilter?: string; typeFilter?: string }} params - Filtros opcionales.
 * @returns {Prisma.TenantLicenseWhereInput} Cláusula WHERE tipada.
 */
function buildLicenciasWhere(params: {
  search?: string;
  planFilter?: string;
  statusFilter?: string;
  typeFilter?: string;
}): Prisma.TenantLicenseWhereInput {
  const { search, planFilter, statusFilter, typeFilter } = params;
  const where: Prisma.TenantLicenseWhereInput = {};

  if (planFilter && planFilter !== "all") where.planId = planFilter;
  if (statusFilter && statusFilter !== "all") {
    where.activa = statusFilter === "true";
  }
  if (typeFilter && typeFilter !== "all") {
    if (typeFilter === "demo") {
      where.isDemo = true;
    } else if (typeFilter === "admin_test") {
      where.isAdminTest = true;
    } else if (typeFilter === "standard") {
      where.isDemo = false;
      where.isAdminTest = false;
    }
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { tenantLicenseId: { contains: q, mode: "insensitive" } },
      { tenant: { nombre: { contains: q, mode: "insensitive" } } },
      {
        tenant: {
          memberships: {
            some: { user: { name: { contains: q, mode: "insensitive" } } },
          },
        },
      },
      {
        tenant: {
          memberships: {
            some: { user: { email: { contains: q, mode: "insensitive" } } },
          },
        },
      },
    ] as Prisma.TenantLicenseWhereInput[];
  }

  return where;
}

/**
 * @description Devuelve métricas globales de salud del sistema (usuarios, tenants, sesiones, licencias).
 * @param {void} _input - Sin entrada.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Métricas globales.
 */
export async function getAdminHealth(
  _input: void,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
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
    orderBy: { createdAt: "asc" },
    take: 10000,
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
}

/**
 * @description Lista usuarios globales (admin) o de un tenant (manager).
 * @param {{ tenantId?: string; limit?: number }} input - Filtros opcionales.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Lista de usuarios y total.
 */
export async function getAdminUsers(
  input: { tenantId?: string; limit?: number } = {},
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  const isPlatformAdmin = user.role === "admin";
  const canManageUsers = hasPermission(user, "config.usuarios.gestionar");

  if (!isPlatformAdmin && !canManageUsers) {
    throw new ActionError("Acceso restringido", "FORBIDDEN");
  }

  let tenantId: string | undefined;
  if (isPlatformAdmin) {
    tenantId = input.tenantId || user.tenantId;
  } else {
    if (input.tenantId && input.tenantId !== user.tenantId) {
      throw new ActionError(
        "No tienes permisos para ver usuarios de otra empresa",
        "FORBIDDEN",
      );
    }
    tenantId = user.tenantId;
  }

  if (tenantId) {
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
      membershipCount: (m.user as { _count?: { tenantMemberships: number } })
        ._count?.tenantMemberships ?? 1,
    }));

    return { users, total: users.length };
  }

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
}

/**
 * @description Bloquea un usuario por 24 horas.
 * @param {LockUnlockInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Usuario actualizado y mensaje.
 */
export async function lockAdminUser(
  input: LockUnlockInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
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
}

/**
 * @description Desbloquea un usuario y reinicia sus intentos de login.
 * @param {LockUnlockInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Usuario actualizado y mensaje.
 */
export async function unlockAdminUser(
  input: LockUnlockInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
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
}

/**
 * @description Lista las empresas (tenants reales) con su plan y conteo de usuarios.
 * @param {void} _input - Sin entrada.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object[]>} Lista de tenants.
 */
export async function getAdminTenants(
  _input: void,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>[]> {
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
}

/**
 * @description Lista licencias paginadas con filtros y ordenamiento.
 * @param {GetLicenciasQueryInput} input - Paginación, filtros y orden.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Licencias, total y página.
 */
export async function getAdminLicenses(
  input: GetLicenciasQueryInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  if (user.role !== "admin")
    throw new ActionError("Acceso restringido", "FORBIDDEN");

  const parsed = getLicenciasQuerySchema.parse(input ?? {});
  const { page, limit, sortBy, sortOrder, search, planFilter, statusFilter, typeFilter } =
    parsed;
  const skip = (page - 1) * limit;

  const where = buildLicenciasWhere({ search, planFilter, statusFilter, typeFilter });

  let orderBy: Prisma.TenantLicenseOrderByWithRelationInput = {
    createdAt: sortOrder,
  };
  if (sortBy === "tenantId") {
    orderBy = { tenant: { nombre: sortOrder } };
  } else if (sortBy === "planId") {
    orderBy = { plan: { nombre: sortOrder } };
  } else {
    orderBy = { [sortBy]: sortOrder } as Record<string, "asc" | "desc">;
  }

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
}

/**
 * @description Devuelve métricas agregadas de licencias respetando los filtros.
 * @param {LicenciasStatsQueryInput} input - Filtros comunes.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Métricas de licencias.
 */
export async function getAdminLicenseStats(
  input: LicenciasStatsQueryInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  if (user.role !== "admin")
    throw new ActionError("Acceso restringido", "FORBIDDEN");

  const parsed = licenciasStatsQuerySchema.parse(input ?? {});
  const { search, planFilter, statusFilter, typeFilter } = parsed;

  const baseWhere = buildLicenciasWhere({ search, planFilter, statusFilter, typeFilter });
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [total, activas, expiradas, demos, porVencer, adminTest] =
    await Promise.all([
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
      prisma.tenantLicense.count({
        where: {
          AND: [baseWhere, { isAdminTest: true }],
        },
      }),
    ]);

  return { total, activas, expiradas, demos, porVencer, adminTest };
}

/**
 * @description Lista membresías pendientes de aprobación.
 * @param {void} _input - Sin entrada.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<PendingMembership[]>} Membresías pendientes.
 */
const pendingMembershipInclude = {
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
} satisfies Prisma.TenantMembershipInclude;

export type PendingMembership = Prisma.TenantMembershipGetPayload<{
  include: typeof pendingMembershipInclude;
}>;

export async function getAdminPendingMemberships(
  _input: void,
  user: AuthenticatedUser,
): Promise<PendingMembership[]> {
  const isPlatformAdmin = user.role === "admin";
  const canManageUsers = hasPermission(user, "config.usuarios.gestionar");

  if (!isPlatformAdmin && !canManageUsers) {
    throw new ActionError("Acceso restringido", "FORBIDDEN");
  }

  const where = isPlatformAdmin
    ? { isActive: false }
    : { isActive: false, tenantId: user.tenantId };

  return prisma.tenantMembership.findMany({
    where,
    include: pendingMembershipInclude,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * @description Aprueba una membresía pendiente, activa al usuario y crea su empleado si falta.
 * @param {{ membershipId: string; tenantRole: string }} input - Membresía y rol a asignar.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Resultado de la aprobación.
 */
export async function approveAdminMembership(
  input: { membershipId: string; tenantRole: string },
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  const { membershipId, tenantRole } = input;

  if (!tenantRole || typeof tenantRole !== "string") {
    throw new ActionError("El rol del tenant es requerido", "VALIDATION");
  }

  const validRoles = ["manager", "economico", "dependiente"];
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
  const canManageUsers =
    user.tenantId === membership.tenantId &&
    hasPermission(user, "config.usuarios.gestionar");

  if (!isPlatformAdmin && !canManageUsers) {
    throw new ActionError(
      "No tienes permisos para aprobar esta solicitud",
      "FORBIDDEN",
    );
  }

  await prisma.tenantMembership.update({
    where: { membershipId },
    data: { isActive: true, tenantRole },
  });

  await prisma.user.update({
    where: { userId: membership.userId },
    data: { isActive: true, onboardingStatus: null },
  });

  const nameParts = membership.user.name.trim().split(" ");
  const nombre = nameParts[0];
  const apellido = nameParts.slice(1).join(" ") || nombre;

  const cargoMap: Record<string, string> = {
    manager: "Director / Manager",
    economico: "Económico",
    dependiente: "Dependiente",
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
}

/**
 * @description Rechaza una membresía pendiente y restablece el onboarding del usuario.
 * @param {{ membershipId: string }} input - Identificador de la membresía.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Resultado del rechazo.
 */
export async function rejectAdminMembership(
  input: { membershipId: string },
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  const membership = await prisma.tenantMembership.findUnique({
    where: { membershipId: input.membershipId },
    select: { membershipId: true, tenantId: true, userId: true },
  });

  if (!membership)
    throw new ActionError("Solicitud no encontrada", "NOT_FOUND");

  const isPlatformAdmin = user.role === "admin";
  const canManageUsers =
    user.tenantId === membership.tenantId &&
    hasPermission(user, "config.usuarios.gestionar");

  if (!isPlatformAdmin && !canManageUsers) {
    throw new ActionError("Acceso restringido", "FORBIDDEN");
  }

  await prisma.tenantMembership.delete({
    where: { membershipId: input.membershipId },
  });

  await prisma.user.updateMany({
    where: {
      userId: membership.userId,
      onboardingStatus: "awaiting_manager_approval",
    },
    data: { onboardingStatus: "selecting_tenant" },
  });
  revalidatePath("/busy/configuracion/usuarios");
  return { success: true };
}

// ─── Gestión individual de usuarios ──────────────────────────────────

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * @description Verifica que el usuario autenticado sea administrador de plataforma.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 */
function assertPlatformAdmin(user: AuthenticatedUser): void {
  if (user.role !== "admin")
    throw new ActionError("Acceso restringido", "FORBIDDEN");
}

/**
 * @description Registra una acción administrativa en el log de actividad.
 * @param {{ userId: string; action: string; performedBy: string; details?: Record<string, unknown> }} params - Datos del registro.
 * @returns {Promise<void>}
 */
async function logAdminUserAction(params: {
  userId: string;
  action: string;
  performedBy: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await prisma.userActivityLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      details: params.details ? JSON.stringify(params.details) : undefined,
      performedBy: params.performedBy,
    },
  });
}

/**
 * @description Evita dejar la plataforma sin administradores activos.
 * @param {string} userId - Usuario que perdería el rol/estado de admin.
 * @returns {Promise<void>}
 */
async function assertNotLastPlatformAdmin(userId: string): Promise<void> {
  const remaining = await prisma.user.count({
    where: { role: "admin", isActive: true, userId: { not: userId } },
  });
  if (remaining === 0) {
    throw new ActionError(
      "No se puede completar la acción: debe existir al menos un administrador activo en la plataforma",
      "CONFLICT",
    );
  }
}

const adminUserDetailSelect = {
  userId: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  onboardingType: true,
  onboardingStatus: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
  activatedAt: true,
  expiresAt: true,
  avatar: true,
  lockedUntil: true,
  loginAttempts: true,
  lastFailedLogin: true,
} satisfies Record<string, boolean>;

/**
 * @description Obtiene la ficha individual de un usuario sin descargar la lista completa.
 * @param {AdminUserIdInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Detalle del usuario con membresías y sesiones activas.
 */
export async function getAdminUserDetail(
  input: AdminUserIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUserIdSchema.parse(input ?? {});

  const detail = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: {
      ...adminUserDetailSelect,
      tenantMemberships: {
        select: {
          membershipId: true,
          tenantId: true,
          tenantRole: true,
          isActive: true,
          createdAt: true,
          tenant: {
            select: { tenantId: true, nombre: true, slug: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!detail) throw new ActionError("Usuario no encontrado", "NOT_FOUND");

  const activeSessions = await prisma.userSession.count({
    where: { userId: parsed.userId, isActive: true },
  });

  return { user: { ...detail, activeSessions } };
}

/**
 * @description Edita el nombre, email o rol de plataforma de un usuario.
 * @param {AdminUpdateUserInput} input - Campos a actualizar.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Usuario actualizado y mensaje.
 */
export async function updateAdminUser(
  input: AdminUpdateUserInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUpdateUserSchema.parse(input ?? {});

  const target = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true, role: true, email: true },
  });
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  if (parsed.name !== undefined) data.name = parsed.name.trim();
  if (parsed.email !== undefined) {
    const email = parsed.email.trim().toLowerCase();
    const conflict = await prisma.user.findUnique({
      where: { email },
      select: { userId: true },
    });
    if (conflict && conflict.userId !== parsed.userId) {
      throw new ActionError(
        "El email ya está en uso por otro usuario",
        "CONFLICT",
      );
    }
    data.email = email;
    // El nuevo correo aún no está verificado.
    if (email !== target.email) data.emailVerifiedAt = null;
  }
  if (parsed.role !== undefined) {
    const normalized = normalizeUserRole(parsed.role);
    if (!normalized)
      throw new ActionError(`Rol inválido: ${parsed.role}`, "VALIDATION");
    if (parsed.userId === user.userId) {
      throw new ActionError("No puedes cambiar tu propio rol", "FORBIDDEN");
    }
    if (target.role === "admin" && normalized !== "admin") {
      await assertNotLastPlatformAdmin(parsed.userId);
    }
    data.role = normalized;
  }

  if (Object.keys(data).length === 0) {
    throw new ActionError("Sin cambios para aplicar", "VALIDATION");
  }

  await prisma.user.update({ where: { userId: parsed.userId }, data });

  // El gestor de ventas es tenantless: se limpian membresías y se asegura su perfil.
  if (parsed.role === "salesAgent" && target.role !== "salesAgent") {
    await prisma.tenantMembership.deleteMany({
      where: { userId: parsed.userId },
    });
    const existingProfile = await prisma.salesAgentProfile.findUnique({
      where: { userId: parsed.userId },
      select: { salesAgentProfileId: true },
    });
    if (!existingProfile) {
      try {
        await prisma.salesAgentProfile.create({
          data: {
            userId: parsed.userId,
            status: "active",
            referralCode: generateSalesAgentReferralCode(),
            approvedAt: new Date(),
            approvedByAdminId: user.userId,
          },
        });
        await prisma.salesAgentBalance.upsert({
          where: { userId: parsed.userId },
          create: { userId: parsed.userId },
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
    where: { userId: parsed.userId },
    select: adminUserDetailSelect,
  });

  await logAdminUserAction({
    userId: parsed.userId,
    action: "admin.user.update",
    performedBy: user.userId,
    details: { changes: Object.keys(data) },
  });
  revalidatePath("/admin");
  return { user: updated, message: "Usuario actualizado correctamente" };
}

/**
 * @description Activa un usuario desactivado.
 * @param {AdminUserIdInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Estado actualizado y mensaje.
 */
export async function activateAdminUser(
  input: AdminUserIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUserIdSchema.parse(input ?? {});

  const target = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true, isActive: true },
  });
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
  if (target.isActive) {
    throw new ActionError("El usuario ya está activo", "CONFLICT");
  }

  await prisma.user.update({
    where: { userId: parsed.userId },
    data: { isActive: true, lockedUntil: null, loginAttempts: 0 },
  });

  await logAdminUserAction({
    userId: parsed.userId,
    action: "admin.user.activate",
    performedBy: user.userId,
  });
  revalidatePath("/admin");
  return {
    user: { userId: parsed.userId, isActive: true, lockedUntil: null },
    message: "Usuario activado correctamente",
  };
}

/**
 * @description Desactiva un usuario y revoca sus sesiones activas.
 * @param {AdminUserIdInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Estado actualizado y mensaje.
 */
export async function deactivateAdminUser(
  input: AdminUserIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUserIdSchema.parse(input ?? {});

  if (parsed.userId === user.userId) {
    throw new ActionError("No puedes desactivar tu propio usuario", "FORBIDDEN");
  }

  const target = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true, isActive: true, role: true },
  });
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
  if (!target.isActive) {
    throw new ActionError("El usuario ya está desactivado", "CONFLICT");
  }
  if (target.role === "admin") {
    await assertNotLastPlatformAdmin(parsed.userId);
  }

  const [revoked, deactivated] = await prisma.$transaction([
    prisma.userSession.updateMany({
      where: { userId: parsed.userId, isActive: true },
      data: { isActive: false },
    }),
    prisma.user.update({
      where: { userId: parsed.userId },
      data: { isActive: false },
      select: { userId: true, isActive: true, lockedUntil: true },
    }),
  ]);

  await logAdminUserAction({
    userId: parsed.userId,
    action: "admin.user.deactivate",
    performedBy: user.userId,
    details: { revokedSessions: revoked.count },
  });
  revalidatePath("/admin");
  return {
    user: deactivated,
    message: "Usuario desactivado y sesiones revocadas",
  };
}

/**
 * @description Elimina permanentemente un usuario de la plataforma.
 * @param {AdminUserIdInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Confirmación de eliminación.
 */
export async function deleteAdminUser(
  input: AdminUserIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUserIdSchema.parse(input ?? {});

  if (parsed.userId === user.userId) {
    throw new ActionError("No puedes eliminar tu propio usuario", "FORBIDDEN");
  }

  const target = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: {
      userId: true,
      name: true,
      email: true,
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
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");

  if (target.role === "admin") {
    await assertNotLastPlatformAdmin(parsed.userId);
  }

  const hasSalesAgentRecords =
    target.salesAgentBalance !== null ||
    target._count.salesAgentReferrals > 0 ||
    target._count.salesAgentCommissions > 0 ||
    target._count.salesAgentPayouts > 0;

  if (hasSalesAgentRecords) {
    throw new ActionError(
      "No se puede eliminar un Gestor de Ventas con registros asociados (balance, referidos, comisiones o pagos). Desactiva el usuario en su lugar",
      "SALES_AGENT_WITH_RECORDS",
    );
  }

  // El log se asocia al admin ejecutor: el borrado en cascada eliminaría
  // un registro asociado al usuario objetivo.
  await logAdminUserAction({
    userId: user.userId,
    action: "admin.user.delete",
    performedBy: user.userId,
    details: {
      deletedUserId: target.userId,
      deletedEmail: target.email,
      deletedName: target.name,
    },
  });

  await prisma.user.deleteMany({ where: { userId: parsed.userId } });
  revalidatePath("/admin");
  return { success: true, userId: parsed.userId };
}

/**
 * @description Envía al usuario un enlace temporal para restablecer su contraseña.
 * @param {AdminUserIdInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Confirmación del envío.
 */
export async function resetAdminUserPassword(
  input: AdminUserIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUserIdSchema.parse(input ?? {});

  const target = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true, name: true, email: true },
  });
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");

  const token = signOnboardingToken(
    { userId: target.userId, email: target.email, purpose: "password-reset" },
    "1h",
  );

  await prisma.user.update({
    where: { userId: target.userId },
    data: {
      resetPasswordToken: token,
      resetPasswordExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const origin = getConfiguredPublicAppUrl();
  if (!origin) {
    throw new Error("El servicio de recuperación no está disponible");
  }
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  await sendPasswordResetEmail(target.email, resetUrl, target.name);

  await logAdminUserAction({
    userId: target.userId,
    action: "admin.user.reset-password",
    performedBy: user.userId,
  });
  revalidatePath("/admin");
  return {
    success: true,
    message: `Enlace de restablecimiento enviado a ${target.email}`,
  };
}

/**
 * @description Marca manualmente el email de un usuario como verificado.
 * @param {AdminUserIdInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Estado de verificación y mensaje.
 */
export async function verifyAdminUserEmail(
  input: AdminUserIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUserIdSchema.parse(input ?? {});

  const target = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true, email: true, emailVerifiedAt: true },
  });
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");

  if (target.emailVerifiedAt) {
    return {
      user: {
        userId: target.userId,
        email: target.email,
        emailVerifiedAt: target.emailVerifiedAt,
      },
      alreadyVerified: true,
      message: "El email ya estaba verificado",
    };
  }

  const updated = await prisma.user.update({
    where: { userId: parsed.userId },
    data: { emailVerifiedAt: new Date() },
    select: { userId: true, email: true, emailVerifiedAt: true },
  });

  await logAdminUserAction({
    userId: parsed.userId,
    action: "admin.user.verify-email",
    performedBy: user.userId,
  });
  revalidatePath("/admin");
  return {
    user: updated,
    alreadyVerified: false,
    message: "Email marcado como verificado",
  };
}

/**
 * @description Reenvía el email de verificación al correo del usuario.
 * @param {AdminUserIdInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Confirmación del envío.
 */
export async function resendAdminUserVerification(
  input: AdminUserIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUserIdSchema.parse(input ?? {});

  const target = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true, name: true, email: true, emailVerifiedAt: true },
  });
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
  if (target.emailVerifiedAt) {
    throw new ActionError(
      "El email de este usuario ya está verificado",
      "CONFLICT",
    );
  }

  const verificationToken = signOnboardingToken({
    userId: target.userId,
    email: target.email,
    purpose: "email-verification",
  });

  const origin = getConfiguredPublicAppUrl();
  if (!origin) {
    throw new Error("El servicio de verificación no está disponible");
  }
  const verificationUrl = `${origin}/verify-email?token=${encodeURIComponent(verificationToken)}`;
  await sendEmailVerificationLink(target.email, verificationUrl, target.name);

  await logAdminUserAction({
    userId: target.userId,
    action: "admin.user.resend-verification",
    performedBy: user.userId,
  });
  revalidatePath("/admin");
  return {
    success: true,
    message: `Email de verificación reenviado a ${target.email}`,
  };
}

/**
 * @description Asigna un usuario a una empresa o lo cambia de empresa.
 * @param {AdminAssignTenantInput} input - Usuario, empresa, rol y cambio de empresa.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Membresía resultante y mensaje.
 */
export async function assignAdminUserTenant(
  input: AdminAssignTenantInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminAssignTenantSchema.parse(input ?? {});

  const [target, tenant] = await Promise.all([
    prisma.user.findUnique({
      where: { userId: parsed.userId },
      select: { userId: true },
    }),
    prisma.tenant.findUnique({
      where: { tenantId: parsed.tenantId },
      select: { tenantId: true, nombre: true },
    }),
  ]);
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
  if (!tenant) throw new ActionError("Empresa no encontrada", "NOT_FOUND");

  if (parsed.deactivateOthers) {
    await prisma.tenantMembership.updateMany({
      where: {
        userId: parsed.userId,
        tenantId: { not: parsed.tenantId },
        isActive: true,
      },
      data: { isActive: false },
    });
  }

  const membership = await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: { tenantId: parsed.tenantId, userId: parsed.userId },
    },
    create: {
      tenantId: parsed.tenantId,
      userId: parsed.userId,
      tenantRole: parsed.tenantRole,
      isActive: true,
    },
    update: { tenantRole: parsed.tenantRole, isActive: true },
    include: {
      tenant: { select: { tenantId: true, nombre: true } },
    },
  });

  await logAdminUserAction({
    userId: parsed.userId,
    action: "admin.user.assign-tenant",
    performedBy: user.userId,
    details: {
      tenantId: parsed.tenantId,
      tenantRole: parsed.tenantRole,
      deactivateOthers: parsed.deactivateOthers,
    },
  });
  revalidatePath("/admin");
  return {
    membership,
    message: `Usuario asignado a ${tenant.nombre} como ${parsed.tenantRole}`,
  };
}

/**
 * @description Cambia el rol de un usuario dentro de una empresa.
 * @param {AdminChangeTenantRoleInput} input - Usuario, empresa y nuevo rol.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Membresía actualizada y mensaje.
 */
export async function changeAdminUserTenantRole(
  input: AdminChangeTenantRoleInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminChangeTenantRoleSchema.parse(input ?? {});

  const membership = await prisma.tenantMembership.findUnique({
    where: {
      tenantId_userId: { tenantId: parsed.tenantId, userId: parsed.userId },
    },
    select: { membershipId: true, tenantRole: true },
  });
  if (!membership) {
    throw new ActionError(
      "El usuario no tiene membresía en esta empresa. Usa asignar empresa primero",
      "NOT_FOUND",
    );
  }

  const updated = await prisma.tenantMembership.update({
    where: { membershipId: membership.membershipId },
    data: { tenantRole: parsed.tenantRole },
    include: {
      tenant: { select: { tenantId: true, nombre: true } },
    },
  });

  await logAdminUserAction({
    userId: parsed.userId,
    action: "admin.user.change-tenant-role",
    performedBy: user.userId,
    details: {
      tenantId: parsed.tenantId,
      previousRole: membership.tenantRole,
      newRole: parsed.tenantRole,
    },
  });
  revalidatePath("/admin");
  return {
    membership: updated,
    message: `Rol actualizado a ${parsed.tenantRole} en ${updated.tenant.nombre}`,
  };
}

/**
 * @description Revoca todas las sesiones activas de un usuario.
 * @param {AdminUserIdInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Cantidad revocada y mensaje.
 */
export async function revokeAdminUserSessions(
  input: AdminUserIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUserIdSchema.parse(input ?? {});

  const target = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true },
  });
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");

  const result = await prisma.userSession.updateMany({
    where: { userId: parsed.userId, isActive: true },
    data: { isActive: false },
  });

  await logAdminUserAction({
    userId: parsed.userId,
    action: "admin.user.revoke-sessions",
    performedBy: user.userId,
    details: { revoked: result.count },
  });
  revalidatePath("/admin");
  return {
    revoked: result.count,
    message:
      result.count === 0
        ? "El usuario no tenía sesiones activas"
        : `Se revocaron ${result.count} sesiones activas`,
  };
}
