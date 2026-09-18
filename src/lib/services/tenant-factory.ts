/**
 * @description Crea un Tenant, TenantMembership y TenantLicense para un usuario tipo "company".
 * Usado por approveGlobalUserAction cuando se aprueba un usuario que se registró como empresa.
 *
 * @module lib/services/tenant-factory
 */

import { Prisma } from '@/generated/prisma'
import { addDays } from '@/lib/date-utils'
import { prismaPlatform as prisma } from '@/lib/db/platform-prisma'
import { ActionError } from '@/lib/server-actions'
import { resolveLicenseDurationDays } from '@/lib/services/license-duration'
import { resolveLicensePricing } from '@/lib/services/plan-pricing'
import { recordAccountingPolicyProvisioningCommitted } from '@/lib/metrics'
import { provisionTenantAccountingPolicyInTransaction } from '@/features/contabilidad/services/tenant-accounting-policy-service'

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

interface ReferralOwner {
  domain: 'affiliate' | 'salesAgent'
  ownerId: string
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
  const { userId, planId, tenantName, licenseDurationDays } = input

  // 1. Validar usuario
  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      name: true,
      onboardingStatus: true,
      pendingReferralCode: true,
      pendingFunctionalCurrencyCode: true,
    }
  })
  if (!user) throw new ActionError('Usuario no encontrado', 'NOT_FOUND')

  // Un retry posterior a un commit exitoso debe converger al mismo resultado.
  const existingMembership = await prisma.tenantMembership.findFirst({
    where: { userId, isActive: true },
    select: {
      membershipId: true,
      tenantId: true,
      tenant: {
        select: {
          accountingPolicy: { select: { tenantId: true } },
          licencias: {
            where: { activa: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { tenantLicenseId: true },
          },
        },
      },
    },
  })
  const existingLicense = existingMembership?.tenant?.licencias[0]
  if (existingMembership?.tenant?.accountingPolicy && existingLicense) {
    return {
      tenantId: existingMembership.tenantId,
      membershipId: existingMembership.membershipId,
      licenseId: existingLicense.tenantLicenseId,
    }
  }

  if (user.onboardingStatus !== 'awaiting_global_approval') {
    throw new ActionError(
      'El usuario no está en estado de aprobación global',
      'INVALID_ONBOARDING_STATUS'
    )
  }
  const functionalCurrencyCode = user.pendingFunctionalCurrencyCode
  if (!functionalCurrencyCode) {
    throw new ActionError(
      'La empresa debe confirmar su moneda funcional contable antes de la aprobación',
      'ACCOUNTING_POLICY_REQUIRED',
    )
  }

  // 2. Rechazar membresías parciales o ajenas al alta actual.
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
    if (!plan) throw new ActionError('No hay planes disponibles. Crea al menos un plan primero.', 'NO_PLANS')
  }

  // 5b. Resolver duración de la licencia: override explícito o la duración del plan
  const durationDays = resolveLicenseDurationDays(plan!.duracionDias, licenseDurationDays)
  if (durationDays === undefined) {
    throw new ActionError(
      'La duración de la licencia debe ser mayor que cero',
      'VALIDATION_ERROR',
    )
  }

  const referralOwner = await resolveReferralOwner(user.pendingReferralCode)

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

    const policyResult = await provisionTenantAccountingPolicyInTransaction(tx, {
      tenantId: tenant.tenantId,
      functionalCurrencyCode,
      actorUserId: userId,
      origin: 'ONBOARDING',
      reason: 'Moneda funcional confirmada durante el alta de la empresa',
      correlationId: `onboarding-${userId}`,
    })
    if (!policyResult || !['CREATED', 'NO_OP'].includes(policyResult.result)) {
      throw new ActionError(
        'No se pudo establecer la política contable de la empresa',
        'ACCOUNTING_POLICY_REQUIRED',
      )
    }

    const license = await tx.tenantLicense.create({
      data: {
        tenantId: tenant.tenantId,
        planId: plan!.planId,
        activa: true,
        inicio: new Date(),
        expiracion: addDays(new Date(), durationDays),
        maxUsuarios: plan!.maxUsuarios,
        maxAlmacenes: plan!.maxAlmacenes,
        maxProductos: plan!.maxProductos,
        maxClientes: plan!.maxClientes,
        features: Prisma.JsonNull,
        featureOverrides: {},
        ...resolveLicensePricing(
          Number(plan!.precio),
          Boolean(referralOwner),
        ),
      }
    })

    if (referralOwner?.domain === 'salesAgent') {
      // Restricción cross-table no expresable en Prisma/PostgreSQL con estas dos
      // tablas. La transacción reduce el riesgo; una carrera entre dominios aún
      // requiere migrar a una entidad unificada de atribución para garantía absoluta.
      const [residualMembership, existingAffiliate, existingSalesAgent] =
        await Promise.all([
          tx.tenantMembership.findFirst({
            where: {
              tenantId: tenant.tenantId,
              userId: referralOwner.ownerId,
            },
            select: { membershipId: true },
          }),
          tx.affiliateReferral.findUnique({
            where: { referredTenantId: tenant.tenantId },
            select: { referralId: true },
          }),
          tx.salesAgentReferral.findUnique({
            where: { referredTenantId: tenant.tenantId },
            select: { salesAgentReferralId: true },
          }),
        ])
      if (residualMembership) {
        throw new ActionError(
          'El Gestor no puede referir un tenant al que pertenece',
          'SALES_AGENT_SELF_REFERRAL',
        )
      }
      if (existingAffiliate || existingSalesAgent) {
        throw new ActionError(
          'El tenant ya tiene una atribución',
          'REFERRAL_ALREADY_LINKED',
        )
      }
      await tx.salesAgentReferral.create({
        data: {
          salesAgentUserId: referralOwner.ownerId,
          referredTenantId: tenant.tenantId,
          status: 'attributed',
        },
      })
    }

    if (
      referralOwner?.domain === 'affiliate' &&
      referralOwner.ownerId !== tenant.tenantId
    ) {
      await tx.affiliateReferral.create({
        data: {
          referrerTenantId: referralOwner.ownerId,
          referredTenantId: tenant.tenantId,
          referredPlanId: plan!.planId,
          status: 'registered',
        },
      })
    }

    // Actualizar usuario
    await tx.user.update({
      where: { userId },
      data: {
        isActive: true,
        expiresAt: license.expiracion,
        onboardingStatus: null,
        pendingReferralCode: null,
        pendingFunctionalCurrencyCode: null,
      }
    })

    return {
      tenantId: tenant.tenantId,
      membershipId: membership.membershipId,
      licenseId: license.tenantLicenseId,
      policyResult,
    }
  }, { isolationLevel: 'Serializable' })

  try {
    recordAccountingPolicyProvisioningCommitted('ONBOARDING', result.policyResult.result)
  } catch (error) {
    console.error('No se pudo registrar la métrica de provisioning después del commit', {
      origin: 'ONBOARDING',
      result: result.policyResult.result,
      error: error instanceof Error ? error.message : 'Error de telemetría desconocido',
    })
  }
  const { policyResult: _policyResult, ...createdTenant } = result
  return createdTenant
}

/**
 * @description Resuelve un código activo de exactamente uno de los dos dominios.
 * @param {string | null} referralCode - Código pendiente capturado en registro.
 * @returns {Promise<ReferralOwner | null>} Propietario interno sin exponerlo al cliente.
 */
async function resolveReferralOwner(
  referralCode: string | null,
): Promise<ReferralOwner | null> {
  if (!referralCode) return null

  const [affiliate, salesAgent] = await Promise.all([
    prisma.affiliateProfile.findUnique({
      where: { referralCode },
      select: { tenantId: true, isEligible: true, status: true },
    }),
    prisma.salesAgentProfile.findUnique({
      where: { referralCode },
      select: { userId: true, status: true },
    }),
  ])
  const activeAffiliate = affiliate?.isEligible === true &&
    affiliate.status === 'active'
  const activeSalesAgent = salesAgent?.status === 'active'

  if (activeAffiliate && activeSalesAgent) {
    throw new ActionError(
      'El código de referido no puede atribuirse',
      'REFERRAL_CODE_COLLISION',
    )
  }
  if (activeSalesAgent) {
    return { domain: 'salesAgent', ownerId: salesAgent.userId }
  }
  if (activeAffiliate) {
    return { domain: 'affiliate', ownerId: affiliate.tenantId }
  }
  return null
}
