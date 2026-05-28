import { describe, expect, it } from 'vitest'

import {
  globalUsersQuerySchema,
  createUserBodySchema,
  updateUserBodySchema,
} from '@/lib/admin/schemas'

describe('globalUsersQuerySchema', () => {
  it('acepta parámetros válidos', () => {
    const valid = {
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      search: 'john',
      isActive: 'true',
      page: 1,
      limit: 10,
      sortBy: 'name' as const,
      sortOrder: 'asc' as const,
    }

    const result = globalUsersQuerySchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('acepta todos los parámetros opcionales', () => {
    const result = globalUsersQuerySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rechaza page negativo', () => {
    const result = globalUsersQuerySchema.safeParse({ page: -1 })
    expect(result.success).toBe(false)
  })

  it('rechaza limit fuera de rango', () => {
    expect(globalUsersQuerySchema.safeParse({ limit: 0 }).success).toBe(false)
    expect(globalUsersQuerySchema.safeParse({ limit: 101 }).success).toBe(false)
  })

  it('rechaza sortOrder inválido', () => {
    const result = globalUsersQuerySchema.safeParse({ sortOrder: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('acepta role como string cualquiera (filtro flexible)', () => {
    const result = globalUsersQuerySchema.safeParse({ role: 'cualquier-role' })
    expect(result.success).toBe(true)
  })

  it('rechaza tenantId vacío', () => {
    const result = globalUsersQuerySchema.safeParse({ tenantId: '' })
    expect(result.success).toBe(false)
  })

  it('rechaza search muy largo', () => {
    const result = globalUsersQuerySchema.safeParse({ search: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })
})

describe('createUserBodySchema', () => {
  it('acepta datos válidos mínimos', () => {
    const valid = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'admin',
    }

    const result = createUserBodySchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('acepta tenantRole opcional', () => {
    const valid = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'admin',
      tenantRole: 'manager',
    }

    const result = createUserBodySchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rechaza email inválido', () => {
    const result = createUserBodySchema.safeParse({
      name: 'Test',
      email: 'invalid-email',
      password: 'password123',
      role: 'admin',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza password muy corta', () => {
    const result = createUserBodySchema.safeParse({
      name: 'Test',
      email: 'test@example.com',
      password: 'short',
      role: 'admin',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza role inválido', () => {
    const result = createUserBodySchema.safeParse({
      name: 'Test',
      email: 'test@example.com',
      password: 'password123',
      role: 'superadmin',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateUserBodySchema', () => {
  it('acepta datos válidos parciales', () => {
    const valid = {
      name: 'Updated Name',
    }

    const result = updateUserBodySchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('acepta tenantRole opcional', () => {
    const valid = {
      tenantRole: 'economico',
    }

    const result = updateUserBodySchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('acepta isActive', () => {
    const valid = { isActive: false }
    const result = updateUserBodySchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rechaza email inválido si se proporciona', () => {
    const result = updateUserBodySchema.safeParse({ email: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('rechaza tenantRole inválido', () => {
    const result = updateUserBodySchema.safeParse({ tenantRole: 'superadmin' })
    expect(result.success).toBe(false)
  })
})
