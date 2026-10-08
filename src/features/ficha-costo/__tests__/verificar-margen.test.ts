import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verificarMargenBajoAction } from '../actions-alertas'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: {
      findMany: vi.fn(),
    },
    notification: {
      findFirst: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/server-actions/get-current-user')

vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-1'),
  requireFeature: vi.fn(),
}))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

const mockUser: AuthenticatedUser = {
  userId: 'user-1',
  name: 'Test',
  email: 'test@test.com',
  role: 'regularUser',
  isActive: true,
  tenantId: 'tenant-1',
  planFeatures: { 'ficha-costo': true, 'ficha-costo-bulk': true },
}

describe('verificarMargenBajoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
  })

  it('crea notificación para producto con margen < 10%', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', nombre: 'Producto A', precioVenta: 100, precioCosto: 95 },
    ] as any)
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 } as any)

    const data = await verificarMargenBajoAction({})

    expect(data.success).toBe(true)
    if (!data.success) expect.unreachable('Se esperaba que la accion tuviera exito')
    expect(data.data.notificacionesCreadas).toBeGreaterThan(0)
  })

  it('no notifica si ya fue notificado en 24h', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', nombre: 'Producto A', precioVenta: 100, precioCosto: 95 },
    ] as any)
    vi.mocked(prisma.notification.findFirst).mockResolvedValue({ id: 'notif-1' } as any)

    const data = await verificarMargenBajoAction({})

    expect(data.success).toBe(true)
    if (!data.success) expect.unreachable('Se esperaba que la accion tuviera exito')
    expect(data.data.notificacionesCreadas).toBe(0)
  })

  it('no notifica productos con margen ≥ 10%', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', nombre: 'Producto A', precioVenta: 100, precioCosto: 60 },
    ] as any)

    const data = await verificarMargenBajoAction({})

    expect(data.success).toBe(true)
    if (!data.success) expect.unreachable('Se esperaba que la accion tuviera exito')
    expect(data.data.notificacionesCreadas).toBe(0)
    expect(data.success).toBe(true)
    if (!data.success) expect.unreachable('Se esperaba que la accion tuviera exito')
    expect(data.data.productosMargenBajo).toBe(0)
  })

  it('notifica múltiples productos en una sola llamada', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', nombre: 'A', precioVenta: 100, precioCosto: 95 },
      { id: 'prod-2', nombre: 'B', precioVenta: 100, precioCosto: 92 },
    ] as any)
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 } as any)

    const data = await verificarMargenBajoAction({})

    expect(data.success).toBe(true)
    if (!data.success) expect.unreachable('Se esperaba que la accion tuviera exito')
    expect(data.data.productosMargenBajo).toBe(2)
    expect(data.success).toBe(true)
    if (!data.success) expect.unreachable('Se esperaba que la accion tuviera exito')
    expect(data.data.notificacionesCreadas).toBeGreaterThan(0)
  })
})
