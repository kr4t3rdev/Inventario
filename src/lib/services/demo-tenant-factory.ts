/**
 * @description Provisiona un tenant demo usando un plan real y una licencia demo
 *              con duración corta. Crea usuario demo, tenant, membership manager
 *              y `TenantLicense` marcada como demo.
 *
 * @module lib/services/demo-tenant-factory
 */

import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { addDays } from '@/lib/date-utils';
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';

const DEFAULT_DEMO_DURATION_DAYS = 6;
const DEMO_EMAIL_DOMAIN = 'demo.local';

export interface CreateDemoTenantForPlanInput {
  planId: string;
  demoName?: string;
  durationDays?: number;
  createdBy?: string;
}

export interface CreateDemoTenantForPlanResult {
  tenantId: string;
  membershipId: string;
  licenseId: string;
  userId: string;
  email: string;
  password: string;
  expiresAt: Date;
  planName: string;
  isDemo: true;
  createdBy: string | null;
}

/**
 * @description Normaliza un nombre legible a slug base para tenant/email.
 * @param {string} value - Nombre fuente.
 * @returns {string} Slug base normalizado.
 */
function toSlugBase(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40) || 'demo';
}

/**
 * @description Genera una contraseña temporal para acceso demo.
 * @returns {string} Contraseña temporal.
 */
function createTemporaryPassword(): string {
  return `Demo-${randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

/**
 * @description Crea un tenant demo completo usando un plan real y una licencia
 *              demo de 6 días por defecto.
 * @param {CreateDemoTenantForPlanInput} input - Configuración de la demo.
 * @returns {Promise<CreateDemoTenantForPlanResult>} Resultado con IDs y credenciales demo.
 */
export async function createDemoTenantForPlan(
  input: CreateDemoTenantForPlanInput,
): Promise<CreateDemoTenantForPlanResult> {
  const durationDays = input.durationDays ?? DEFAULT_DEMO_DURATION_DAYS;

  if (durationDays <= 0) {
    throw new ActionError('La duración de la demo debe ser mayor que cero', 'VALIDATION_ERROR');
  }

  const plan = await prisma.plan.findUnique({
    where: { planId: input.planId },
  });

  if (!plan) {
    throw new ActionError('Plan no encontrado', 'PLAN_NOT_FOUND');
  }

  const demoName = input.demoName?.trim() || `Demo ${plan.nombre}`;
  const temporaryPassword = createTemporaryPassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

  const result = await prisma.$transaction(async (tx) => {
    const slugBase = toSlugBase(demoName);
    const suffix = randomUUID().slice(0, 8).toLowerCase();
    const tenantSlug = `${slugBase}-${suffix}`.substring(0, 50);
    const email = `${slugBase}.${suffix}@${DEMO_EMAIL_DOMAIN}`;
    const now = new Date();
    const expiresAt = addDays(now, durationDays);

    const existingEmail = await tx.user.findUnique({
      where: { email },
      select: { userId: true },
    });

    if (existingEmail) {
      throw new ActionError(
        'Conflicto generando credenciales demo. Intente nuevamente.',
        'EMAIL_CONFLICT',
      );
    }

    const user = await tx.user.create({
      data: {
        name: `${demoName} Admin`,
        email,
        password: hashedPassword,
        role: 'regularUser',
        onboardingType: null,
        onboardingStatus: null,
        emailVerifiedAt: now,
        activatedAt: now,
        expiresAt,
        isActive: true,
      },
    });

    const tenant = await tx.tenant.create({
      data: {
        nombre: demoName,
        slug: tenantSlug,
      },
    });

    const membership = await tx.tenantMembership.create({
      data: {
        tenantId: tenant.tenantId,
        userId: user.userId,
        tenantRole: 'manager',
        isActive: true,
      },
    });

    const license = await tx.tenantLicense.create({
      data: {
        tenantId: tenant.tenantId,
        planId: plan.planId,
        isDemo: true,
        activa: true,
        inicio: now,
        expiracion: expiresAt,
        maxUsuarios: plan.maxUsuarios,
        maxAlmacenes: plan.maxAlmacenes,
        maxProductos: plan.maxProductos,
        maxClientes: plan.maxClientes,
        features: undefined,
        featureOverrides: {},
        createdBy: input.createdBy ?? null,
      },
    });

    return {
      tenantId: tenant.tenantId,
      membershipId: membership.membershipId,
      licenseId: license.tenantLicenseId,
      userId: user.userId,
      email,
      password: temporaryPassword,
      expiresAt,
      planName: plan.nombre,
      isDemo: true as const,
      createdBy: input.createdBy ?? null,
    };
  });

  return result;
}
