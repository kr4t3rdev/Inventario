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
  // cliente
  // compras
  // configuracion
  '/api/configuracion/cuentas-bancarias',
  '/api/configuracion/series/next',
  '/api/configuracion/sistema/contratos',
  // contabilidad
  '/api/contabilidad/anticipos',
  '/api/contabilidad/anticipos/disponibles',
  '/api/contabilidad/anticipos/reportes/cliente',
  '/api/contabilidad/deudas-cash',
  '/api/contabilidad/deudas-cash/stats',
  '/api/contabilidad/exchange/alert-history',
  '/api/contabilidad/exchange/convertir',
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
  '/api/contabilidad/transferencias',
  // contratos
  // cuadre-diario
  // dashboard
  '/api/dashboard/stats',
  '/api/dashboard/wanda',
  // defectaciones
  '/api/defectaciones',
  // empleados
  '/api/empleados/asistencia',
  '/api/empleados/nomina',
  '/api/empleados/vacaciones',
  '/api/empleados/vacaciones/acumulacion',
  '/api/empleados/work-schedules',
  // exchange
  '/api/exchange',
  // facturas
  // gastosDE
  // image
  '/api/image',
  // licencias
  // listas-precios
  // mermas
  // metrics
  '/api/metrics',
  // mi-empresa (migrado a Server Action)
  // notificaciones
  // ofertas
  // pago-salario
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
  // reparaciones
  '/api/reparaciones/catalogo/config',
  '/api/reparaciones/defectaciones',
  '/api/reparaciones/equipos',
  '/api/reparaciones/ordenes',
  '/api/reparaciones/piezas',
  // reportes-financieros
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
  // servicios
  // sugerencias
  '/api/sugerencias/ingresos-por-edades',
  // transferencias
  // unidades
  // upload
  '/api/upload',
  // vendors
  // venta-servicios
  // ventas
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
  { path: '/api/contratos', body: {} },
  { path: '/api/defectaciones', body: {} },
  { path: '/api/mermas', body: {} },
  { path: '/api/notificaciones', body: {} },
  { path: '/api/restaurante/comandas', body: {} },
  { path: '/api/restaurante/mesas', body: {} },
  { path: '/api/restaurante/recetas', body: {} },
  { path: '/api/transferencias', body: {} },
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

  it('GET /api/contratos → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/contratos', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/mermas → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/mermas', authToken)
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

  it('GET /api/metrics → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/metrics', authToken)
    expect([200, 204]).toContain(res.status)
  })

  it('GET /api/defectaciones → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/defectaciones', authToken)
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

  it('GET /api/resumen → 200 con token', async () => {
    if (!authToken) return
    const res = await get('/api/resumen', authToken)
    expect([200, 204]).toContain(res.status)
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
