import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: (...args: any[]) => unknown) => handler,
  withAuthPost: (handler: (...args: any[]) => unknown) => handler,
}))
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: (user: { tenantId?: string }) => user.tenantId,
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    cliente: { findFirst: vi.fn(), findUnique: vi.fn() },
    equipoReparacion: { findMany: vi.fn(), findUnique: vi.fn() },
    empleado: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import prisma from '@/lib/prisma'

const tenantUser = { userId: 'u1', tenantId: 't1', role: 'admin' } as any
const validOrderData = {
  clienteId: 'c1',
  equipos: [
    { equipoTipoId: 'eq-1', marca: 'Marca A', problemaReportado: 'Falla A' },
    { equipoTipoId: 'eq-2', marca: 'Marca B', problemaReportado: 'Falla B' },
  ],
}

function makeRequest(data: unknown): NextRequest {
  return new NextRequest('http://localhost/api/reparaciones/ordenes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

describe('POST /api/reparaciones/ordenes tenant references', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
      clienteId: 'c1', nombre: 'Cliente local',
    } as any)
    vi.mocked(prisma.cliente.findUnique).mockResolvedValue({
      clienteId: 'c1', nombre: 'Cliente local',
    } as any)
    vi.mocked(prisma.equipoReparacion.findMany).mockResolvedValue([
      { id: 'eq-1', nombre: 'Equipo primario' },
      { id: 'eq-2', nombre: 'Equipo secundario' },
    ] as any)
    vi.mocked(prisma.equipoReparacion.findUnique).mockResolvedValue({
      id: 'eq-1', nombre: 'Equipo primario',
    } as any)
    vi.mocked(prisma.empleado.findFirst).mockResolvedValue({ empleadoId: 'e1' } as any)
  })

  it.each([
    ['foreign client', () => vi.mocked(prisma.cliente.findFirst).mockResolvedValueOnce(null)],
    [
      'foreign primary equipment type',
      () => vi.mocked(prisma.equipoReparacion.findMany).mockResolvedValueOnce([
        { id: 'eq-2', nombre: 'Equipo secundario' },
      ] as any),
    ],
    [
      'foreign secondary equipment type',
      () => vi.mocked(prisma.equipoReparacion.findMany).mockResolvedValueOnce([
        { id: 'eq-1', nombre: 'Equipo primario' },
      ] as any),
    ],
    ['foreign technician', () => vi.mocked(prisma.empleado.findFirst).mockResolvedValueOnce(null)],
  ])('rejects %s before creating an order or receipt', async (_name, invalidateReference) => {
    invalidateReference()

    const response = await POST(
      makeRequest({ ...validOrderData, tecnicoId: 'e1' }) as any,
      {},
      tenantUser,
    )

    expect(response.status).toBe(404)
    expect(prisma.cliente.findFirst).toHaveBeenCalledWith({
      where: { clienteId: 'c1', tenantId: 't1' },
      select: { clienteId: true, nombre: true },
    })
    expect(prisma.equipoReparacion.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['eq-1', 'eq-2'] }, tenantId: 't1' },
      select: { id: true, nombre: true },
    })
    expect(prisma.empleado.findFirst).toHaveBeenCalledWith({
      where: { empleadoId: 'e1', tenantId: 't1' },
      select: { empleadoId: true },
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('creates an own-tenant order with secondary equipment and no technician', async () => {
    const order = { id: 'orden-1', tenantId: 't1' }
    const receipt = { id: 'recibo-1', ordenId: 'orden-1', clienteNombre: 'Cliente local' }
    const tx = {
      ordenReparacion: { create: vi.fn().mockResolvedValue(order) },
      reciboOrdenReparacion: { create: vi.fn().mockResolvedValue(receipt) },
    }
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))

    const response = await POST(makeRequest(validOrderData) as any, {}, tenantUser)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ success: true, orden: order, recibo: receipt })
    expect(tx.ordenReparacion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 't1', clienteId: 'c1', equipoTipoId: 'eq-1' }),
    }))
    expect(tx.reciboOrdenReparacion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ordenId: 'orden-1', clienteNombre: 'Cliente local' }),
    }))
    expect(tx.ordenReparacion.create.mock.calls[0][0].data.equipos.create).toHaveLength(2)
    expect(prisma.empleado.findFirst).not.toHaveBeenCalled()
  })
})
