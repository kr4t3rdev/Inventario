import { describe, expect, it, vi } from 'vitest'

import { E2E_TENANT_ID, ensureE2eTenant } from './e2e-fixtures'

describe('ensureE2eTenant', () => {
  it('creates the deterministic tenant when it does not exist', async () => {
    const upsert = vi.fn().mockResolvedValue({ tenantId: E2E_TENANT_ID })

    await ensureE2eTenant({ tenant: { upsert } })

    expect(upsert).toHaveBeenCalledWith({
      where: { tenantId: E2E_TENANT_ID },
      update: {},
      create: {
        tenantId: E2E_TENANT_ID,
        nombre: 'Tenant E2E Producción',
      },
    })
  })

  it('does not overwrite an existing tenant during repeated runs', async () => {
    const upsert = vi.fn().mockResolvedValue({ tenantId: E2E_TENANT_ID })

    await ensureE2eTenant({ tenant: { upsert } })
    await ensureE2eTenant({ tenant: { upsert } })

    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsert).toHaveBeenNthCalledWith(2, {
      where: { tenantId: E2E_TENANT_ID },
      update: {},
      create: {
        tenantId: E2E_TENANT_ID,
        nombre: 'Tenant E2E Producción',
      },
    })
  })
})
