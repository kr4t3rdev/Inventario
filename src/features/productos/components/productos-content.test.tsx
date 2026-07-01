import { describe, expect, it } from 'vitest'

import { canManageProducts } from './productos-content'

describe('canManageProducts', () => {
  it('permite gestión solo para manager', () => {
    expect(canManageProducts('manager')).toBe(true)
    expect(canManageProducts('dependiente')).toBe(false)
    expect(canManageProducts('economico')).toBe(false)
    expect(canManageProducts(undefined)).toBe(false)
  })
})
