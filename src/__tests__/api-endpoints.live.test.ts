/**
 * @vitest-environment node
 *
 * Tests de integración para todos los endpoints del proyecto.
 *
 * Estrategia:
 * 1. Endpoints públicos → 2xx (sin token)
 * 2. Endpoints protegidos → 401 (sin token)
 * 3. Endpoints representativos → 2xx con token válido (si hay credenciales disponibles)
 */

import { describe, it, expect, beforeAll } from 'vitest'

const BASE = 'http://localhost:3000'

// ─── helpers ────────────────────────────────────────────────────────────────

async function get(path: string, token?: string) {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${BASE}${path}`, { headers })
}

async function post(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

// ─── estado global ───────────────────────────────────────────────────────────

let authToken: string | undefined

// ─── setup ───────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Intentar login para obtener un token real (opcional)
  try {
    const res = await post('/api/auth/login', {
      email: process.env.TEST_EMAIL ?? '',
      password: process.env.TEST_PASSWORD ?? '',
    })
    if (res.ok) {
      const data = await res.json()
      authToken = data.token ?? data.accessToken
    }
  } catch {
    // Servidor no disponible o credenciales no configuradas — solo se ejecutan tests de 401
  }
}, 20_000)

// ─── 1. Endpoints públicos ────────────────────────────────────────────────────

describe('Endpoints públicos (sin autenticación)', () => {
  it('GET /api/health → 200', async () => {
    const res = await get('/api/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('status')
  })

  it('GET /api/planes → 200', async () => {
    const res = await get('/api/planes')
    expect([200, 204]).toContain(res.status)
  })

  it('POST /api/auth/login sin cuerpo → 400 (no 401/500)', async () => {
    const res = await post('/api/auth/login', {})
    expect(res.status).toBe(400)
  })

  it('GET /api/auth/me sin token → 200 o 401', async () => {
    const res = await get('/api/auth/me')
    expect([200, 401, 403]).toContain(res.status)
  })

  it('GET /api/licencias/validar → no es 500', async () => {
    const res = await get('/api/licencias/validar')
    expect(res.status).not.toBe(500)
  })

  it('POST /api/auth/refresh sin body → 400 o 401 (ruta pública, solo POST)', async () => {
    const res = await post('/api/auth/refresh', {})
    expect([400, 401, 403]).toContain(res.status)
  })
})

// ─── 2. Protección 401 – todos los endpoints protegidos ──────────────────────

const protectedGets: string[] = [
  // admin
  '/api/admin/activity-logs',
  '/api/admin/sessions',
  '/api/admin/users',
  '/api/admin/users/expiring-soon',
  '/api/admin/users/export',
  '/api/admin/users/user-metrics',
  // almacenes
  '/api/almacenes',
  // catalog / categorias
  '/api/categorias',
  '/api/categorias/hierarchy',
  '/api/categorias/validate',
  // cliente
  '/api/cliente',
  // compras
  '/api/compras-productos',
  '/api/compras-productos/export',
  '/api/compras-servicios',
  // configuracion
  '/api/configuracion/cuentas-bancarias',
  '/api/configuracion/series/next',
  '/api/configuracion/sistema/contratos',
  // contabilidad
  '/api/contabilidad/ajustes',
  '/api/contabilidad/anticipos',
  '/api/contabilidad/anticipos/disponibles',
  '/api/contabilidad/anticipos/reportes/cliente',
  '/api/contabilidad/anticipos/reportes/proveedor',
  '/api/contabilidad/anticipos/reportes/resumen',
  '/api/contabilidad/balance-financiero',
  '/api/contabilidad/capital',
  '/api/contabilidad/cierres',
  '/api/contabilidad/cuentas-por-cobrar',
  '/api/contabilidad/cuentas-por-pagar',
  '/api/contabilidad/cuentas',
  '/api/contabilidad/deudas-cash',
  '/api/contabilidad/deudas-cash/stats',
  '/api/contabilidad/exchange/alert-history',
  '/api/contabilidad/exchange/convertir',
  '/api/contabilidad/exchange/cost-impact',
  '/api/contabilidad/exchange/debt-exposure',
  '/api/contabilidad/exchange/export',
  '/api/contabilidad/exchange/kpis',
  '/api/contabilidad/exchange/monedas',
  '/api/contabilidad/exchange/payment-efficiency',
  '/api/contabilidad/exchange/report-history',
  '/api/contabilidad/exchange/scenarios',
  '/api/contabilidad/exchange/scheduled-reports',
  '/api/contabilidad/exchange/tasas',
  '/api/contabilidad/exchange/tasas/historial',
  '/api/contabilidad/logs',
  '/api/contabilidad/performance',
  '/api/contabilidad/prestamos-cash',
  '/api/contabilidad/prestamos-cash/stats',
  '/api/contabilidad/reconciliacion/gastos',
  '/api/contabilidad/reconciliacion/gastos/historial',
  '/api/contabilidad/reconciliacion/servicios',
  '/api/contabilidad/reconciliacion/servicios/historial',
  '/api/contabilidad/reconciliacion/stats',
  '/api/contabilidad/reconciliacion/ventas',
  '/api/contabilidad/reconciliacion/ventas/historial',
  '/api/contabilidad/reportes/exchange',
  '/api/contabilidad/reportes/exchange-impact',
  '/api/contabilidad/reportes/movimientos',
  '/api/contabilidad/reportes/resumen',
  '/api/contabilidad/reportes/transferencias',
  '/api/contabilidad/tipos-pago',
  '/api/contabilidad/tipos-pago/cuentas-disponibles',
  '/api/contabilidad/tipos-pago/validar',
  '/api/contabilidad/transferencias',
  // contratos
  '/api/contratos',
  // cuadre-diario
  '/api/cuadre-diario',
  // dashboard
  '/api/dashboard/stats',
  '/api/dashboard/wanda',
  // defectaciones
  '/api/defectaciones',
  // empleados
  '/api/empleados',
  '/api/empleados/asistencia',
  '/api/empleados/nomina',
  '/api/empleados/vacaciones',
  '/api/empleados/vacaciones/acumulacion',
  '/api/empleados/work-schedules',
  // exchange
  '/api/exchange',
  // facturas
  '/api/facturas',
  // gastosDE
  '/api/gastosDE',
  // image
  '/api/image',
  // licencias
  '/api/licencias',
  '/api/licencias/generar',
  // listas-precios
  '/api/listas-precios',
  // mermas
  '/api/mermas',
  '/api/mermas/stats',
  // metrics
  '/api/metrics',
  // mi-empresa
  '/api/mi-empresa',
  // notificaciones
  '/api/notificaciones',
  '/api/notificaciones/verificar-stock',
  // ofertas
  '/api/ofertas',
  // pago-salario
  '/api/pago-salario',
  // produccion
  '/api/produccion/conceptos',
  '/api/produccion/ordenes',
  '/api/produccion/recetas',
  '/api/produccion/vales',
  // productos
  '/api/productos',
  '/api/productos/restock',
  '/api/productos/stock-ubicacion',
  // profile
  '/api/profile',
  // reparaciones
  '/api/reparaciones/catalogo/config',
  '/api/reparaciones/defectaciones',
  '/api/reparaciones/equipos',
  '/api/reparaciones/ordenes',
  '/api/reparaciones/piezas',
  // reportes-financieros
  '/api/reportes-financieros',
  // restaurante
  '/api/restaurante/caja/cierres',
  '/api/restaurante/caja/turnos',
  '/api/restaurante/comandas',
  '/api/restaurante/kds',
  '/api/restaurante/mesas',
  '/api/restaurante/platos',
  '/api/restaurante/produccion',
  '/api/restaurante/recetas',
  // resumen
  '/api/resumen',
  // series-facturacion
  '/api/series-facturacion',
  // servicios
  '/api/servicios',
  // sugerencias
  '/api/sugerencias/ingresos-por-edades',
  // transferencias
  '/api/transferencias',
  // unidades
  '/api/unidades',
  // upload
  '/api/upload',
  // vendors
  '/api/vendors',
  // venta-servicios
  '/api/venta-servicios',
  // ventas
  '/api/ventas',
  '/api/ventas/stats',
  // puntosDeVenta / catalog
  '/api/catalog',
]

describe('Protección 401 – GET sin token', () => {
  for (const path of protectedGets) {
    it(`GET ${path} → 401`, async () => {
      const res = await get(path)
      expect(res.status).toBe(401)
    })
  }
})

const protectedPosts: Array<{ path: string; body: unknown }> = [
  { path: '/api/almacenes', body: {} },
  { path: '/api/categorias', body: {} },
  { path: '/api/cliente', body: {} },
  { path: '/api/compras-productos', body: {} },
  { path: '/api/compras-servicios', body: {} },
  { path: '/api/contratos', body: {} },
  { path: '/api/defectaciones', body: {} },
  { path: '/api/empleados', body: {} },
  { path: '/api/facturas', body: {} },
  { path: '/api/gastosDE', body: {} },
  { path: '/api/listas-precios', body: {} },
  { path: '/api/mermas', body: {} },
  { path: '/api/notificaciones', body: {} },
  { path: '/api/ofertas', body: {} },
  { path: '/api/pago-salario', body: {} },
  { path: '/api/productos', body: {} },
  { path: '/api/restaurante/comandas', body: {} },
  { path: '/api/restaurante/mesas', body: {} },
  { path: '/api/restaurante/recetas', body: {} },
  { path: '/api/series-facturacion', body: {} },
  { path: '/api/servicios', body: {} },
  { path: '/api/transferencias', body: {} },
  { path: '/api/unidades', body: {} },
  { path: '/api/vendors', body: {} },
  { path: '/api/venta-servicios', body: {} },
  { path: '/api/ventas', body: {} },
  { path: '/api/contabilidad/transferencias', body: {} },
  { path: '/api/contabilidad/cuentas', body: {} },
  { path: '/api/contabilidad/anticipos', body: {} },
  { path: '/api/contabilidad/prestamos-cash', body: {} },
  { path: '/api/contabilidad/deudas-cash', body: {} },
  { path: '/api/contabilidad/exchange/monedas', body: {} },
  { path: '/api/contabilidad/exchange/tasas', body: {} },
  { path: '/api/contabilidad/exchange/scenarios', body: {} },
  { path: '/api/contabilidad/exchange/scheduled-reports', body: {} },
  { path: '/api/contabilidad/tipos-pago', body: {} },
  { path: '/api/licencias', body: {} },
  { path: '/api/produccion/ordenes', body: {} },
  { path: '/api/produccion/recetas', body: {} },
  { path: '/api/produccion/vales', body: {} },
  { path: '/api/reparaciones/equipos', body: {} },
  { path: '/api/reparaciones/ordenes', body: {} },
  { path: '/api/reparaciones/piezas', body: {} },
  { path: '/api/reparaciones/defectaciones', body: {} },
]

describe('Protección 401 – POST sin token', () => {
  for (const { path, body } of protectedPosts) {
    it(`POST ${path} → 401`, async () => {
      const res = await post(path, body)
      expect(res.status).toBe(401)
    })
  }
})

// ─── 3. Endpoints autenticados (solo si hay token disponible) ─────────────────

describe('Endpoints con autenticación (requiere TEST_EMAIL + TEST_PASSWORD)', () => {
  it('GET /api/productos → 200 con token', async () => {
    if (!authToken) {
      console.log('[skip] Sin token de autenticación — define TEST_EMAIL y TEST_PASSWORD')
      return
    }
    const res = await get('/api/productos', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/ventas → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/ventas', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/categorias → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/categorias', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/clientes → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/cliente', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/almacenes → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/almacenes', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/unidades → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/unidades', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/servicios → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/servicios', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/vendors → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/vendors', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/empleados → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/empleados', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/facturas → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/facturas', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/ofertas → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/ofertas', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/contabilidad/cuentas → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/contabilidad/cuentas', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/contabilidad/exchange/monedas → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/contabilidad/exchange/monedas', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/dashboard/stats → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/dashboard/stats', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/admin/users → 200 con token admin', async () => {
    if (!authToken) return
    const res = await get('/api/admin/users', authToken)
    expect([200, 403]).toContain(res.status) // 403 si el usuario no es admin
  })

  it('GET /api/notificaciones → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/notificaciones', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/contratos → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/contratos', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/listas-precios → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/listas-precios', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/mermas → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/mermas', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/transferencias → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/transferencias', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/series-facturacion → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/series-facturacion', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/restaurante/mesas → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/restaurante/mesas', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/restaurante/recetas → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/restaurante/recetas', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/produccion/ordenes → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/produccion/ordenes', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/reparaciones/ordenes → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/reparaciones/ordenes', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/mi-empresa → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/mi-empresa', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/profile → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/profile', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/metrics → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/metrics', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/gastosDE → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/gastosDE', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/defectaciones → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/defectaciones', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/pago-salario → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/pago-salario', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/contabilidad/transferencias → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/contabilidad/transferencias', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/contabilidad/anticipos → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/contabilidad/anticipos', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/contabilidad/cuentas-por-cobrar → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/contabilidad/cuentas-por-cobrar', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/contabilidad/cuentas-por-pagar → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/contabilidad/cuentas-por-pagar', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/contabilidad/prestamos-cash → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/contabilidad/prestamos-cash', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/contabilidad/deudas-cash → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/contabilidad/deudas-cash', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/contabilidad/tipos-pago → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/contabilidad/tipos-pago', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/contabilidad/balance-financiero → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/contabilidad/balance-financiero', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/resumen → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/resumen', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/cuadre-diario → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/cuadre-diario', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/reportes-financieros → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/reportes-financieros', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/licencias → 200 con token admin', async () => {
    if (!authToken) return
    const res = await get('/api/licencias', authToken)
    expect([200, 403]).toContain(res.status)
  })

  it('GET /api/exchange → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/exchange', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/compras-productos → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/compras-productos', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/compras-servicios → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/compras-servicios', authToken)
    expect([200, 204]).toContain(res.status)
  })
})
