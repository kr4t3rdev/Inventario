import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOrdenesReparacion, getOrdenReparacion, addOrdenReparacion, updateOrdenReparacion, deleteOrdenReparacion } from './ordenes'
import { ServerActionError } from '../errors'

vi.mock('@/lib/api/client', () => ({
  getAuthenticatedContext: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    ordenReparacion: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    cliente: { findFirst: vi.fn(), findUnique: vi.fn() },
    equipoReparacion: { findMany: vi.fn(), findUnique: vi.fn() },
    empleado: { findFirst: vi.fn() },
    cloudinaryAsset: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { getAuthenticatedContext } from '@/lib/api/client'
import prisma from '@/lib/prisma'

describe('reparaciones/ordenes fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthenticatedContext).mockResolvedValue({ userId: 'u1', tenantId: 't1', tenantRole: 'admin' })
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: 'c1', nombre: 'Cliente local' } as any)
    vi.mocked(prisma.cliente.findUnique).mockResolvedValue({ clienteId: 'c1', nombre: 'Cliente local' } as any)
    vi.mocked(prisma.equipoReparacion.findMany).mockResolvedValue([
      { id: 'eq-1', nombre: 'Equipo primario' },
      { id: 'eq-2', nombre: 'Equipo secundario' },
    ] as any)
    vi.mocked(prisma.equipoReparacion.findUnique).mockResolvedValue({
      id: 'eq-1', nombre: 'Equipo primario',
    } as any)
    vi.mocked(prisma.empleado.findFirst).mockResolvedValue({ empleadoId: 'e1' } as any)
  })

  it('getOrdenesReparacion should return list', async () => {
    vi.mocked(prisma.ordenReparacion.findMany).mockResolvedValue([{ id: 'o1', numeroOrden: 1 }] as any)
    const result = await getOrdenesReparacion()
    expect(result).toHaveLength(1)
    expect(prisma.ordenReparacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1' } })
    )
  })

  it('getOrdenReparacion should return single order', async () => {
    vi.mocked(prisma.ordenReparacion.findUnique).mockResolvedValue({ id: 'o1', cliente: {} } as any)
    vi.mocked(prisma.cloudinaryAsset.findMany).mockResolvedValue([] as any)
    const result = await getOrdenReparacion('o1')
    expect(result.id).toBe('o1')
  })

  it('getOrdenReparacion should throw 404 when not found', async () => {
    vi.mocked(prisma.ordenReparacion.findUnique).mockResolvedValue(null)
    try {
      await getOrdenReparacion('invalid')
      expect.unreachable()
    } catch (e) {
      expect((e as ServerActionError).status).toBe(404)
    }
  })

  it('deleteOrdenReparacion should reject non-admin', async () => {
    vi.mocked(getAuthenticatedContext).mockResolvedValue({ userId: 'u2', tenantId: 't1', tenantRole: 'dependiente' })
    try {
      await deleteOrdenReparacion('o1')
      expect.unreachable()
    } catch (e) {
      expect((e as ServerActionError).status).toBe(403)
    }
  })

  const validOrderData = {
    clienteId: 'c1',
    equipos: [
      { equipoTipoId: 'eq-1', marca: 'Marca A', problemaReportado: 'Falla A' },
      { equipoTipoId: 'eq-2', marca: 'Marca B', problemaReportado: 'Falla B' },
    ],
  }

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
  ])('rejects %s before starting an order transaction', async (_name, invalidateReference) => {
    invalidateReference()

    await expect(addOrdenReparacion({ ...validOrderData, tecnicoId: 'e1' } as any))
      .rejects.toMatchObject({ status: 404 })

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
    const order = { id: 'orden-1', tenantId: 't1', equipos: [{ id: 'orden-eq-1' }, { id: 'orden-eq-2' }] }
    const receipt = { id: 'recibo-1', ordenId: 'orden-1', clienteNombre: 'Cliente local' }
    const tx = {
      ordenReparacion: { create: vi.fn().mockResolvedValue(order) },
      reciboOrdenReparacion: { create: vi.fn().mockResolvedValue(receipt) },
    }
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))

    const result = await addOrdenReparacion(validOrderData as any)

    expect(result).toMatchObject({ success: true, orden: order, recibo: receipt })
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
