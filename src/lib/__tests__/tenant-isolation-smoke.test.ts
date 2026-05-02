/**
 * @description Smoke tests de aislamiento multi-tenant.
 * Verifica que los mecanismos de scoping, roles y límites
 * impidan fugas entre empresas.
 */
import { describe, expect, it } from 'vitest'
import { scopedWhere, assertTenantAccess, requireTenant } from '@/lib/services/tenant-scope'
import { hasTenantPermission, checkTenantApiPermission } from '@/lib/permissions'
import { isTenantAdminRole } from '@/lib/auth/roles'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

describe('aislamiento multi-tenant', () => {
  describe('scoping de datos', () => {
    it('tenant A no puede leer datos de tenant B via scopedWhere', () => {
      const tenantAQuery = scopedWhere('tenant-A', { categoriaId: 'cat-1' })
      const tenantBQuery = scopedWhere('tenant-B', { categoriaId: 'cat-1' })

      expect(tenantAQuery.tenantId).toBe('tenant-A')
      expect(tenantBQuery.tenantId).toBe('tenant-B')
      // Si un query de tenant-A se ejecuta con tenantId de tenant-B, falla
      expect(tenantAQuery.tenantId).not.toBe(tenantBQuery.tenantId)
    })

    it('scopedWhere siempre incluye tenantId incluso sin filtros adicionales', () => {
      const query = scopedWhere('t-1')
      expect(query).toHaveProperty('tenantId')
      expect(Object.keys(query).length).toBe(1)
    })

    it('assertTenantAccess rechaza acceso de tenant A a recurso de tenant B', () => {
      expect(() => assertTenantAccess('tenant-B', 'tenant-A', 'Producto'))
        .toThrow('Acceso denegado: Producto no pertenece al tenant actual')
    })

    it('assertTenantAccess permite acceso cuando tenants coinciden', () => {
      expect(() => assertTenantAccess('tenant-A', 'tenant-A', 'Producto')).not.toThrow()
    })

    it('requireTenant rechaza usuarios sin membresía', () => {
      const userWithoutTenant = { userId: 'u-1' } as AuthenticatedUser
      expect(() => requireTenant(userWithoutTenant)).toThrow(
        'Se requiere una membresía de empresa activa'
      )
    })
  })

  describe('RBAC por tenant', () => {
    it('dependiente no puede acceder a admin de usuarios', () => {
      const result = checkTenantApiPermission('dependiente', '/api/admin/users', 'GET')
      expect(result).not.toBeNull()
      expect(result!.status).toBe(403)
    })

    it('director puede acceder a cualquier ruta', () => {
      const result = checkTenantApiPermission('director', '/api/admin/users', 'GET')
      expect(result).toBeNull()
    })

    it('sin contexto tenant se rechaza con 403', () => {
      const result = checkTenantApiPermission(undefined, '/api/productos', 'GET')
      expect(result).not.toBeNull()
      expect(result!.status).toBe(403)
    })

    it('isTenantAdminRole retorna false para dependiente', () => {
      expect(isTenantAdminRole('dependiente')).toBe(false)
    })
  })

  describe('límites del plan', () => {
    it('hasTenantPermission para dependiente es restrictivo', () => {
      // Dependiente NO tiene acceso a lo que no le corresponde
      expect(hasTenantPermission('dependiente', '/api/contabilidad/reportes')).toBe(false)
      expect(hasTenantPermission('dependiente', '/api/admin/users')).toBe(false)
      expect(hasTenantPermission('dependiente', '/api/productos', 'POST')).toBe(false)
    })

    it('economico solo ve finanzas, no admin operativo', () => {
      expect(hasTenantPermission('economico', '/api/reportes-financieros')).toBe(true)
      expect(hasTenantPermission('economico', '/api/admin/users')).toBe(false)
      expect(hasTenantPermission('economico', '/api/ventas', 'POST')).toBe(false)
    })

    it('admin y director tienen acceso irrestricto', () => {
      expect(hasTenantPermission('admin', '/api/cualquier/recurso')).toBe(true)
      expect(hasTenantPermission('director', '/api/cualquier/recurso')).toBe(true)
    })
  })
})
