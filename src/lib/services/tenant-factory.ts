/**
 * @description Crea un Tenant, TenantMembership y TenantLicense para un usuario tipo "company".
 * Usado por approveGlobalUserAction cuando se aprueba un usuario que se registró como empresa.
 *
 * @module lib/services/tenant-factory
 */

import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'
import { ActionError } from '@/lib/server-actions'

export interface CreateTenantForUserInput {
  userId: string
  planId?: string
  tenantName?: string
  licenseDurationDays?: number
}

export interface CreateTenantForUserResult {
  tenantId: string
  membershipId: string
  licenseId: string
}

/**
 * @description Crea un Tenant, TenantMembership y TenantLicense para un usuario tipo "company".
 *
 * Flujo:
 * 1. Valida que el usuario exista y esté en estado "awaiting_global_approval"
 * 2. Resuelve nombre del tenant (input o "Empresa de {name}")
 * 3. Genera slug único del tenant
 * 4. Resuelve plan (input o el más barato disponible)
 * 5. Transacción: Tenant + TenantMembership(manager, activa) + TenantLicense + update User
 * 6. Limpia onboardingStatus a null
 *
 * @param {CreateTenantForUserInput} input - Datos para la creación
 * @returns {Promise<CreateTenantForUserResult>} IDs del tenant, membership y license creados
 * @throws {ActionError} Si validaciones fallan
 */
export async function createTenantForUser(
  input: CreateTenantForUserInput
): Promise<CreateTenantForUserResult> {
  const { userId, planId, tenantName, licenseDurationDays = 365 } = input

  // 1. Validar usuario
  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      name: true,
      onboardingStatus: true,
      pendingReferralCode: true,
    }
  })
  if (!user) throw new ActionError('Usuario no encontrado', 'NOT_FOUND')
  if (user.onboardingStatus !== 'awaiting_global_approval') {
    throw new ActionError(
      'El usuario no está en estado de aprobación global',
      'INVALID_ONBOARDING_STATUS'
    )
  }

  // 2. Validar que no tenga membership activa ya
  const existingMembership = await prisma.tenantMembership.findFirst({
    where: { userId, isActive: true }
  })
  if (existingMembership) {
    throw new ActionError('El usuario ya tiene una empresa activa', 'ALREADY_MEMBER')
  }

  // 3. Resolver nombre del tenant
  const companyName = tenantName || `Empresa de ${user.name}`

  // 4. Generar slug único
  const baseSlug = companyName
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // sacar acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)

  let slug = baseSlug
  let counter = 1
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`
  }

  // 5. Resolver plan
  let plan
  if (planId) {
    plan = await prisma.plan.findUnique({ where: { planId } })
    if (!plan) throw new ActionError('Plan no encontrado', 'PLAN_NOT_FOUND')
  } else {
    plan = await prisma.plan.findFirst({ orderBy: { precio: 'asc' } })
    if (!plan) throw new ActionError('No hay planes disponibles. Creá al menos un plan primero.', 'NO_PLANS')
  }

  // 6. Transacción: crear todo
  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        nombre: companyName,
        slug,
      }
    })

    const membership = await tx.tenantMembership.create({
      data: {
        tenantId: tenant.tenantId,
        userId,
        tenantRole: 'manager',
        isActive: true,
      }
    })

    const license = await tx.tenantLicense.create({
      data: {
        tenantId: tenant.tenantId,
        planId: plan!.planId,
        activa: true,
        inicio: new Date(),
        expiracion: new Date(Date.now() + licenseDurationDays * 86400000),
        maxUsuarios: plan!.maxUsuarios,
        maxAlmacenes: plan!.maxAlmacenes,
        maxProductos: plan!.maxProductos,
        maxClientes: plan!.maxClientes,
        features: Prisma.JsonNull,
        featureOverrides: {},
      }
    })

    // Actualizar usuario
    await tx.user.update({
      where: { userId },
      data: {
        isActive: true,
        expiresAt: license.expiracion,
        onboardingStatus: null,
        pendingReferralCode: null,
      }
    })

    return {
      tenantId: tenant.tenantId,
      membershipId: membership.membershipId,
      licenseId: license.tenantLicenseId,
    }
  })

  if (user.pendingReferralCode) {
    const referralProfile = await prisma.affiliateProfile.findUnique({
      where: { referralCode: user.pendingReferralCode },
      select: {
        tenantId: true,
        isEligible: true,
        status: true,
      },
    })

    if (
      referralProfile &&
      referralProfile.isEligible === true &&
      referralProfile.status === 'active' &&
      referralProfile.tenantId !== result.tenantId
    ) {
      const existingReferral = await prisma.affiliateReferral.findUnique({
        where: { referredTenantId: result.tenantId },
        select: { referralId: true },
      })

      if (!existingReferral) {
        await prisma.affiliateReferral.create({
          data: {
            referrerTenantId: referralProfile.tenantId,
            referredTenantId: result.tenantId,
            referredPlanId: plan!.planId,
            status: 'registered',
          },
        })
      }
    }
  }

  return result
}
