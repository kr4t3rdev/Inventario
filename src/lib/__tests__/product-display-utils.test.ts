import { describe, expect, it } from 'vitest'

import { getProductDisplayIdentifier } from '@/lib/product-display-utils'

describe('getProductDisplayIdentifier', () => {
  it('returns codigoInterno when available', () => {
    const result = getProductDisplayIdentifier({
      id: 'prod-1',
      nombre: 'Producto X',
      codigoInterno: '12345678901',
    })

    expect(result).toBe('12345678901')
  })

  it('falls back to nombre when codigoInterno is missing', () => {
    const result = getProductDisplayIdentifier({
      id: 'prod-1',
      nombre: 'Producto X',
      codigoInterno: null,
    })

    expect(result).toBe('Producto X')
  })

  it('falls back to id when codigoInterno and nombre are missing', () => {
    const result = getProductDisplayIdentifier({
      id: 'prod-1',
      nombre: '',
      codigoInterno: '',
    })

    expect(result).toBe('prod-1')
  })

  it('returns default label when all values are missing', () => {
    const result = getProductDisplayIdentifier({})

    expect(result).toBe('Sin identificar')
  })
})

