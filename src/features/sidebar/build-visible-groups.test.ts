import { describe, expect, it } from 'vitest'
import { SIDEBAR_CONFIG } from './sidebar-config'
import { buildVisibleSidebarGroups } from './build-visible-groups'
import { getDefaultPermissionsForRole } from '@/lib/auth/permission-registry'
import type { SidebarAccessContext } from './types'

function makeCtx(overrides: Partial<SidebarAccessContext>): SidebarAccessContext {
  return {
    role: null,
    tenantRole: null,
    tenantId: null,
    planFeatures: {},
    planName: null,
    isBusyRoute: true,
    ...overrides,
  }
}

interface GroupCount {
  title: string
  itemCount: number
}

function toSummary(result: ReturnType<typeof buildVisibleSidebarGroups>): GroupCount[] {
  return result.map((g) => ({ title: g.title, itemCount: g.items.length }))
}

// Kitchen-sink planFeatures so all items pass the feature gate.
const FULL_FEATURES = {
  'ficha-costo': true,
  'empleados': true,
  'asistencia': true,
  'vacaciones': true,
  'nomina': true,
  'contabilidad': true,
  'cuentas-cobrar': true,
  'cuentas-pagar': true,
  'anticipos': true,
  'prestamos-cash': true,
  'deudas-cash': true,
  'transferencias-bancarias': true,
  'ajustes-bancarios': true,
  'multi-moneda': true,
  'inyeccion-capital': true,
  'analisis-estado-cuenta': true,
  'facturas-vencidas': true,
  'clientes': true,
  'produccion': true,
  'facturacion': true,
  'listas-precios': true,
  'contratos': true,
  'ofertas': true,
  'servicios': true,
  'reportes-financieros': true,
  'cuadre-diario': true,
  'turnos-pos': true,
  'rentabilidad-compra': true,
} as const

describe('buildVisibleSidebarGroups', () => {
  describe('admin role', () => {
    it('admin with full features sees every group and item', () => {
      const ctx = makeCtx({
        role: 'admin',
        tenantRole: 'manager',
        tenantId: 't1',
        planFeatures: FULL_FEATURES,
      })
      const summary = toSummary(buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx))

      expect(summary).toContainEqual({ title: 'Gestión', itemCount: 7 })
      expect(summary).toContainEqual({ title: 'Acciones', itemCount: 18 })
      expect(summary).toContainEqual({ title: 'Configuración', itemCount: 8 })
      expect(summary).toContainEqual({ title: 'Contabilidad', itemCount: 19 })
      expect(summary).toContainEqual({ title: 'Reportes', itemCount: 7 })
    })

    it('admin without tenantId does NOT see Ficha de Costo', () => {
      const ctx = makeCtx({
        role: 'admin',
        tenantRole: 'manager',
        tenantId: null,
        planFeatures: FULL_FEATURES,
      })
      const result = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)
      const allTitles = result.flatMap((g) => g.items.flatMap((i) => [i.title, ...(i.subItems?.map((s) => s.title) ?? [])]))

      expect(allTitles).not.toContain('Ficha de Costo')
      expect(allTitles).toContain('Licencias')
      expect(allTitles).toContain('Planes')
    })

    it('admin sees Licencias and Planes (admin-only items)', () => {
      const ctx = makeCtx({
        role: 'admin',
        tenantRole: 'manager',
        tenantId: 't1',
        planFeatures: FULL_FEATURES,
      })
      const result = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)
      const config = result.find((g) => g.title === 'Configuración')

      expect(config?.items.find((i) => i.title === 'Licencias')).toBeDefined()
      expect(config?.items.find((i) => i.title === 'Planes')).toBeDefined()
    })
  })

  describe('manager role', () => {
    it('manager with full features sees all role-mapped items', () => {
      const ctx = makeCtx({
        role: 'regularUser',
        tenantRole: 'manager',
        tenantId: 't1',
        planFeatures: FULL_FEATURES,
      })
      const result = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)

      const gestionTitles = result.find((g) => g.title === 'Gestión')?.items.map((i) => i.title) ?? []
      expect(gestionTitles).toContain('Productos')
      expect(gestionTitles).toContain('Categorías')
      expect(gestionTitles).toContain('Unidades')

      const config = result.find((g) => g.title === 'Configuración')
      expect(config?.items.find((i) => i.title === 'Usuarios')).toBeDefined()
    })

    it('manager does NOT see Licencias or Planes (admin-only)', () => {
      const ctx = makeCtx({
        role: 'regularUser',
        tenantRole: 'manager',
        tenantId: 't1',
        planFeatures: FULL_FEATURES,
      })
      const result = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)
      const config = result.find((g) => g.title === 'Configuración')

      expect(config?.items.find((i) => i.title === 'Licencias')).toBeUndefined()
      expect(config?.items.find((i) => i.title === 'Planes')).toBeUndefined()
    })

    it('manager without contabilidad feature has reduced Contabilidad visibility', () => {
      const ctx = makeCtx({
        role: 'regularUser',
        tenantRole: 'manager',
        tenantId: 't1',
        planFeatures: { empleados: true },
      })
      const result = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)
      const allTitles = result.flatMap((g) => g.items.flatMap((i) => [i.title, ...(i.subItems?.map((s) => s.title) ?? [])]))

      // Items gated by 'contabilidad' feature key are hidden.
      expect(allTitles).not.toContain('Dashboard')
      expect(allTitles).not.toContain('Cuentas Bancarias')
      expect(allTitles).not.toContain('Reconciliación')
      expect(allTitles).not.toContain('Balance y Resultados')
      expect(allTitles).not.toContain('Reportes Contables')
      // Items with explicit feature keys (multi-moneda, inyeccion-capital, etc.) are also hidden.
      expect(allTitles).not.toContain('Exchange')
      expect(allTitles).not.toContain('Inyección Capital')
      // Cuentas por Cobrar uses 'cuentas-cobrar' feature key (not 'contabilidad'), so it's gated differently.
      // Without that feature, it's still visible because the only filter is `planFeatures?.[key] === false`.
    })
  })

  describe('economico role', () => {
    it('economico with contabilidad feature sees full Contabilidad', () => {
      const ctx = makeCtx({
        role: 'regularUser',
        tenantRole: 'economico',
        tenantId: 't1',
        planFeatures: { ...FULL_FEATURES, contabilidad: true },
      })
      const result = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)
      const allTitles = result.flatMap((g) => g.items.flatMap((i) => [i.title, ...(i.subItems?.map((s) => s.title) ?? [])]))

      expect(allTitles).toContain('Dashboard')
      expect(allTitles).toContain('Cuentas Bancarias')
      expect(allTitles).toContain('Empleados')
      expect(allTitles).toContain('Asistencia')
      expect(allTitles).toContain('Vacaciones')
      expect(allTitles).toContain('Nómina')
      expect(allTitles).toContain('Gastos DE')
    })

    it('economico does NOT see Categorías, Almacenes, Compras (manager-only)', () => {
      const ctx = makeCtx({
        role: 'regularUser',
        tenantRole: 'economico',
        tenantId: 't1',
        planFeatures: { ...FULL_FEATURES, contabilidad: true },
      })
      const result = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)
      const gestionTitles = result.find((g) => g.title === 'Gestión')?.items.map((i) => i.title) ?? []

      expect(gestionTitles).not.toContain('Categorías')
      expect(gestionTitles).not.toContain('Almacenes')
      expect(gestionTitles).not.toContain('Compras de Productos')
    })
  })

  describe('dependiente role', () => {
    it('dependiente sees only Productos, Ventas, Servicios, Configuración minima, Reportes, Cuadres POS', () => {
      const ctx = makeCtx({
        role: 'regularUser',
        tenantRole: 'dependiente',
        tenantId: 't1',
        planFeatures: {},
      })
      const result = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)
      const summary = toSummary(result)
      const allTitles = result.flatMap((g) => g.items.map((i) => i.title))

      expect(summary.find((g) => g.title === 'Contabilidad')).toBeUndefined()
      expect(summary.find((g) => g.title === 'Acciones')?.itemCount).toBe(2)
      expect(summary.find((g) => g.title === 'Gestión')?.itemCount).toBe(1)
      expect(summary.find((g) => g.title === 'Configuración')?.itemCount).toBe(2)

      expect(allTitles).toContain('Productos')
      expect(allTitles).toContain('Ventas')
      expect(allTitles).toContain('Servicios')
      expect(allTitles).toContain('Mi Empresa')
      expect(allTitles).toContain('Reportes')
      expect(allTitles).toContain('Cuadres POS')
    })
  })

  describe('plan feature gating', () => {
    it('muestra CxC y CxP cuando el plan Profesional las habilita', () => {
      const ctx = makeCtx({
        role: 'regularUser',
        tenantRole: 'manager',
        tenantId: 't1',
        planName: 'Profesional',
        planFeatures: {
          contabilidad: true,
          'cuentas-cobrar': true,
          'cuentas-pagar': true,
        },
      })
      const result = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)
      const titles = result.flatMap((group) => group.items.map((item) => item.title))

      expect(titles).toContain('Cuentas por Cobrar')
      expect(titles).toContain('Cuentas por Pagar')
    })

    it('hides items whose plan feature is explicitly false', () => {
      const ctx = makeCtx({
        role: 'regularUser',
        tenantRole: 'manager',
        tenantId: 't1',
        planFeatures: { ...FULL_FEATURES, 'listas-precios': false, clientes: false },
      })
      const result = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)
      const gestionTitles = result.find((g) => g.title === 'Gestión')?.items.map((i) => i.title) ?? []

      expect(gestionTitles).not.toContain('Listas de Precios')
      expect(gestionTitles).not.toContain('Clientes')
    })

    it('enforces plan restrictions on Básico plan', () => {
      const ctx = makeCtx({
        role: 'regularUser',
        tenantRole: 'manager',
        tenantId: 't1',
        planName: 'Básico',
        planFeatures: { contabilidad: true, empleados: true },
      })
      const result = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)
      const allTitles = result.flatMap((g) => g.items.flatMap((i) => [i.title, ...(i.subItems?.map((s) => s.title) ?? [])]))

      expect(allTitles).not.toContain('Transferencias Bancarias')
      expect(allTitles).not.toContain('Exchange')
      expect(allTitles).not.toContain('Inyección Capital')
      expect(allTitles).not.toContain('Analisis Estado Cuenta')
      expect(allTitles).not.toContain('Facturas Vencidas')
      expect(allTitles).not.toContain('Reconciliación Servicios')
      expect(allTitles).not.toContain('Nómina')
      expect(allTitles).not.toContain('Vacaciones')
      expect(allTitles).not.toContain('Asistencia')
    })
  })

  describe('custom role (permissions)', () => {
    it('filters by effective permissions, not fixed tenantRole', () => {
      const ctx = makeCtx({
        role: 'regularUser',
        tenantRole: 'dependiente',
        tenantId: 't1',
        planFeatures: FULL_FEATURES,
        permissions: ['ventas.venta.registrar', 'operaciones.pos.gestionar'],
      })
      const result = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)
      const allTitles = result.flatMap((g) => g.items.flatMap((i) => [i.title, ...(i.subItems?.map((s) => s.title) ?? [])]))

      expect(allTitles).toContain('Ventas')
      expect(allTitles).toContain('Puntos de Venta')
      expect(allTitles).not.toContain('Usuarios')
      expect(allTitles).not.toContain('Roles')
      expect(allTitles).not.toContain('Empleados')
      expect(allTitles).not.toContain('Dashboard')
      expect(allTitles).not.toContain('Productos')
    })

    it('keeps fixed-role behavior when permissions equal the role defaults', () => {
      const ctx = makeCtx({
        role: 'regularUser',
        tenantRole: 'dependiente',
        tenantId: 't1',
        planFeatures: {},
        permissions: [...getDefaultPermissionsForRole('dependiente')],
      })
      const result = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)
      const summary = toSummary(result)

      expect(summary.find((g) => g.title === 'Contabilidad')).toBeUndefined()
      expect(summary.find((g) => g.title === 'Acciones')?.itemCount).toBe(2)
    })
  })

  describe('tenantless user (no tenantRole)', () => {
    it('returns nothing on /busy route', () => {
      const ctx = makeCtx({
        role: 'regularUser',
        tenantRole: null,
        tenantId: null,
        isBusyRoute: true,
      })
      const result = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)
      expect(result.length).toBe(0)
    })

    it('shows only public items off /busy', () => {
      const ctx = makeCtx({
        role: 'regularUser',
        tenantRole: null,
        tenantId: null,
        isBusyRoute: false,
      })
      const result = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)
      const allTitles = result.flatMap((g) => g.items.map((i) => i.title))

      expect(allTitles).toContain('Productos')
      expect(allTitles).toContain('Ventas')
      expect(allTitles).toContain('Mi Empresa')
      expect(allTitles).not.toContain('Clientes')
      expect(allTitles).not.toContain('Servicios')
      expect(allTitles).not.toContain('Categorías')
    })
  })

  describe('purity contract', () => {
    it('does not mutate original config groups or items', () => {
      const originalItemsLengths = SIDEBAR_CONFIG.groups.map((g) => g.items.map((i) => i.subItems?.length ?? 0))

      const ctx = makeCtx({
        role: 'regularUser',
        tenantRole: 'dependiente',
        tenantId: 't1',
        planFeatures: {},
      })
      buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)

      SIDEBAR_CONFIG.groups.forEach((g, gi) => {
        g.items.forEach((i, ii) => {
          expect(i.subItems?.length ?? 0).toBe(originalItemsLengths[gi][ii])
        })
      })
    })

    it('returns consistent output for same input', () => {
      const ctx = makeCtx({
        role: 'regularUser',
        tenantRole: 'manager',
        tenantId: 't1',
        planFeatures: { ...FULL_FEATURES, contabilidad: true },
      })
      const a = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)
      const b = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)

      expect(a).toEqual(b)
    })

    it('removed subItems yield to a new parent object, not a mutation', () => {
      const ctx = makeCtx({
        role: 'regularUser',
        tenantRole: 'manager',
        tenantId: 't1',
        planFeatures: { ...FULL_FEATURES, empleados: false },
      })
      const result = buildVisibleSidebarGroups(SIDEBAR_CONFIG, ctx)
      const acciones = result.find((g) => g.title === 'Acciones')
      const empleados = acciones?.items.find((i) => i.title === 'Empleados')

      // Empleados subitem has 4 children, all require empleados feature.
      // With empleados=false, the parent should be filtered out entirely.
      expect(empleados).toBeUndefined()
    })
  })
})
