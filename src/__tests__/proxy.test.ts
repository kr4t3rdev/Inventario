/**
 * @description Regresión para asegurar que el proxy de Next no falle al importar
 * cuando faltan secretos de autenticación en el entorno.
 */

import { describe, expect, it } from 'vitest'

describe('proxy bootstrap', () => {
  it('imports without validating secrets at module load', async () => {
    const originalJwt = process.env.JWT_SECRET
    const originalRefreshJwt = process.env.REFRESH_JWT_SECRET

    try {
      delete process.env.JWT_SECRET
      delete process.env.REFRESH_JWT_SECRET

      const mod = await import('@/proxy')

      expect(typeof mod.proxy).toBe('function')
    } finally {
      if (originalJwt !== undefined) process.env.JWT_SECRET = originalJwt
      else delete process.env.JWT_SECRET

      if (originalRefreshJwt !== undefined) {
        process.env.REFRESH_JWT_SECRET = originalRefreshJwt
      } else {
        delete process.env.REFRESH_JWT_SECRET
      }
    }
  })
})
