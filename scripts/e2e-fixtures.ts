import type { PrismaClient } from '../src/generated/prisma'

export const E2E_TENANT_ID = 'e2e-tenant'

type TenantUpsertInput = Parameters<PrismaClient['tenant']['upsert']>[0]

export interface E2eTenantClient {
  tenant: {
    upsert(input: TenantUpsertInput): Promise<unknown>
  }
}

/**
 * @description Garantiza el tenant determinístico usado por las pruebas E2E sin sobrescribirlo.
 * @param {E2eTenantClient} prisma - Cliente Prisma con acceso al modelo Tenant.
 * @returns {Promise<void>} Promesa resuelta cuando el tenant queda disponible.
 */
export async function ensureE2eTenant(prisma: E2eTenantClient): Promise<void> {
  await prisma.tenant.upsert({
    where: { tenantId: E2E_TENANT_ID },
    update: {},
    create: {
      tenantId: E2E_TENANT_ID,
      nombre: 'Tenant E2E Producción',
    },
  })
}
