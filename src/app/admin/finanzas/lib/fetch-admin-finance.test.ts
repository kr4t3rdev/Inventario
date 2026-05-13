import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
})

import { fetchAdminFinance } from './fetch-admin-finance'

describe('fetchAdminFinance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes the HTTP status when the finance API responds with an error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'No autorizado' }),
    })

    await expect(fetchAdminFinance()).rejects.toThrow('401')
  })

  it('rejects invalid finance payloads with a clear contract error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ tenantCount: '7' }),
    })

    await expect(fetchAdminFinance()).rejects.toThrow('Invalid finance payload')
  })

  it('rejects malformed finance JSON with a clear parse error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => { throw new Error('Unexpected token') },
    })

    await expect(fetchAdminFinance()).rejects.toThrow('Invalid finance response JSON')
  })
})
