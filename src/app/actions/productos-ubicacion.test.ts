import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getProductosPorUbicacion } from './productos-ubicacion'
import { ServerActionError } from '@/lib/api/errors'

// Mock the fetcher
vi.mock('@/lib/api/productos-ubicacion', () => ({
  getProductosPorUbicacion: vi.fn(),
}))

import * as fetcher from '@/lib/api/productos-ubicacion'

describe('getProductosPorUbicacion (Server Action)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return products when fetcher succeeds', async () => {
    const mockProducts = [
      { id: 'prod-1', nombre: 'Producto 1', stockEnUbicacion: 5 },
    ]
    vi.mocked(fetcher.getProductosPorUbicacion).mockResolvedValue(
      mockProducts as any
    )

    const result = await getProductosPorUbicacion('pv-1')

    expect(result).toEqual(mockProducts)
    expect(fetcher.getProductosPorUbicacion).toHaveBeenCalledWith('pv-1')
  })

  it('should propagate ServerActionError from fetcher', async () => {
    const error = new ServerActionError(
      'getProductosPorUbicacion',
      'GET',
      404,
      'Ubicación no encontrada'
    )
    vi.mocked(fetcher.getProductosPorUbicacion).mockRejectedValue(error)

    try {
      await getProductosPorUbicacion('invalid')
      expect.unreachable('Should have thrown')
    } catch (err) {
      expect(err).toBe(error)
    }
  })

  it('should wrap unknown errors in ServerActionError', async () => {
    vi.mocked(fetcher.getProductosPorUbicacion).mockRejectedValue(
      new Error('DB connection failed')
    )

    try {
      await getProductosPorUbicacion('pv-1')
      expect.unreachable('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ServerActionError)
      expect((err as ServerActionError).status).toBe(500)
      expect((err as ServerActionError).message).toBe('DB connection failed')
    }
  })
})
