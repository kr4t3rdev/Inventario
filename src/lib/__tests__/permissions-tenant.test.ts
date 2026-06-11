import { describe, expect, it } from 'vitest';
import { hasTenantPermission } from '@/lib/permissions'

describe('hasTenantPermission', () => {
  describe('manager', () => {
    it('tiene acceso a todo', () => {
      expect(hasTenantPermission('manager', '/api/admin/users')).toBe(true)
      expect(hasTenantPermission('manager', '/api/ventas')).toBe(true)
      expect(hasTenantPermission('manager', '/api/cualquier-cosa')).toBe(true)
    })
  })

  describe('economico', () => {
    it('tiene acceso a rutas financieras', () => {
      expect(hasTenantPermission('economico', '/api/reportes-financieros')).toBe(true)
      expect(hasTenantPermission('economico', '/api/ventas/stats')).toBe(true)
      expect(hasTenantPermission('economico', '/api/contabilidad/reportes')).toBe(true)
    })

    it('NO tiene acceso a admin de usuarios', () => {
      expect(hasTenantPermission('economico', '/api/admin/users')).toBe(false)
    })

    it('NO tiene acceso a ventas operativas', () => {
      expect(hasTenantPermission('economico', '/api/ventas', 'POST')).toBe(false)
    })
  })

  describe('dependiente', () => {
    it('tiene acceso a ventas GET y POST', () => {
      expect(hasTenantPermission('dependiente', '/api/ventas', 'GET')).toBe(true)
      expect(hasTenantPermission('dependiente', '/api/ventas', 'POST')).toBe(true)
    })

    it('tiene acceso lectura a productos', () => {
      expect(hasTenantPermission('dependiente', '/api/productos', 'GET')).toBe(true)
    })

    it('tiene acceso a restaurante', () => {
      expect(hasTenantPermission('dependiente', '/api/restaurante/mesas')).toBe(true)
    })

    it('NO tiene acceso a admin', () => {
      expect(hasTenantPermission('dependiente', '/api/admin/users')).toBe(false)
    })

    it('NO tiene acceso a contabilidad', () => {
      expect(hasTenantPermission('dependiente', '/api/contabilidad/reportes')).toBe(false)
    })

    it('tiene acceso GET a productos', () => {
      expect(hasTenantPermission('dependiente', '/api/productos', 'GET')).toBe(true)
    })
  })
})
