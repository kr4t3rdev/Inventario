import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { canAccessFichaCosto, canAccessFichaCostoBulk } from '../lib/access'

const tenant = (value?: boolean) => ({
  role: 'regularUser',
  tenantId: 'tenant-1',
  planFeatures: value === undefined ? {} : { 'ficha-costo': value },
})

describe('Ficha de Costo server page access', () => {
  it.each([
    ['missing', tenant(), false],
    ['false', tenant(false), false],
    ['true', tenant(true), true],
    ['global admin with Basic tenant', { role: 'admin', tenantId: 'tenant-admin', planFeatures: {} }, false],
    ['global admin with Enterprise tenant', {
      role: 'admin',
      tenantId: 'tenant-admin',
      planFeatures: { 'ficha-costo': true },
    }, true],
    ['global admin without tenant', { role: 'admin', tenantId: null, planFeatures: {} }, false],
  ])('resolves base access for %s', (_case, user, expected) => {
    expect(canAccessFichaCosto(user)).toBe(expected)
  })

  it('requires base and bulk subfeature for the bulk page', () => {
    expect(canAccessFichaCostoBulk({ role: 'regularUser', tenantId: 'tenant-1', planFeatures: {
      'ficha-costo': true,
      'ficha-costo-bulk': false,
    } })).toBe(false)
    expect(canAccessFichaCostoBulk({ role: 'regularUser', tenantId: 'tenant-1', planFeatures: {
      'ficha-costo': true,
      'ficha-costo-bulk': true,
    } })).toBe(true)
    expect(canAccessFichaCostoBulk({ role: 'admin', tenantId: 'tenant-admin', planFeatures: {} })).toBe(false)
    expect(canAccessFichaCostoBulk({ role: 'admin', tenantId: 'tenant-admin', planFeatures: {
      'ficha-costo': true,
      'ficha-costo-bulk': true,
    } })).toBe(true)
    expect(canAccessFichaCostoBulk({ role: 'admin', tenantId: null, planFeatures: {} })).toBe(false)
  })

  it('uses the shared access policy in all three server pages', () => {
    const pages = [
      'src/app/busy/ficha-costo/page.tsx',
      'src/app/busy/ficha-costo/[id]/page.tsx',
      'src/app/busy/ficha-costo/bulk/page.tsx',
    ].map((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8'))
    expect(pages[0]).toContain('canAccessFichaCosto(user)')
    expect(pages[1]).toContain('canAccessFichaCosto(user)')
    expect(pages[2]).toContain('canAccessFichaCostoBulk(user)')
    for (const page of pages) {
      expect(page).toContain("if (user.role === 'admin' && !user.tenantId) redirect('/admin')")
    }
  })
})
