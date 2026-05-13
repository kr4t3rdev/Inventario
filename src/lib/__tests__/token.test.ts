import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('token helper', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('no instala un interceptor global de fetch al importarse', async () => {
    const originalFetch = window.fetch

    await import('@/lib/token')

    expect(window.fetch).toBe(originalFetch)
  })
})
