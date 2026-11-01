/**
 * @description Regresión para asegurar que el proxy de Next no falle al importar
 * cuando faltan secretos de autenticación en el entorno, y que las rutas
 * públicas necesarias para el reporte de errores sigan accesibles sin token.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { proxy } from '@/proxy'

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

describe('proxy rutas públicas', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('permite POST /api/errors sin token para registrar errores de render', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const request = new NextRequest('http://localhost/api/errors', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Fallo' }),
    })

    const response = await proxy(request)

    expect(response.status).toBe(200)
  })

  it('sigue exigiendo token en rutas API protegidas', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const request = new NextRequest('http://localhost/api/ventas', {
      method: 'GET',
    })

    const response = await proxy(request)

    expect(response.status).toBe(401)
  })
})
