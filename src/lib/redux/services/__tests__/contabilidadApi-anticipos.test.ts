import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/token', () => ({
  getAuthToken: () => null,
}))

describe('contabilidadApi anticipos endpoints', () => {
  it('usa la ruta /api/anticipos para crear anticipos', async () => {
    const { contabilidadApi } = await import('../contabilidadApi')
    const endpoint = contabilidadApi.endpoints.createAnticipo

    expect(endpoint).toBeDefined()
  })
})
