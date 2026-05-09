import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getEquiposReparacion, getEquipoReparacion, createEquipoReparacion, updateEquipoReparacion, deleteEquipoReparacion } from './equipos'
import { ServerActionError } from '../errors'

vi.mock('@/lib/api/client', () => ({
  getAuthenticatedContext: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    equipoReparacion: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { getAuthenticatedContext } from '@/lib/api/client'
import prisma from '@/lib/prisma'

describe('reparaciones/equipos fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthenticatedContext).mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1', tenantRole: 'admin' })
  })

  describe('getEquiposReparacion', () => {
    it('should return all equipos scoped to tenant', async () => {
      const mockEquipos = [{ id: '1', nombre: 'Equipo 1', tenantId: 'tenant-1', piezas: [] }]
      vi.mocked(prisma.equipoReparacion.findMany).mockResolvedValue(mockEquipos as any)

      const result = await getEquiposReparacion()

      expect(result).toEqual(mockEquipos)
      expect(prisma.equipoReparacion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-1' } })
      )
    })

    it('should throw when tenant not found', async () => {
      vi.mocked(getAuthenticatedContext).mockResolvedValue({ userId: 'user-1' })

      try {
        await getEquiposReparacion()
        expect.unreachable()
      } catch (e) {
        expect(e).toBeInstanceOf(ServerActionError)
        expect((e as ServerActionError).status).toBe(403)
      }
    })
  })

  describe('getEquipoReparacion', () => {
    it('should return equipo by id', async () => {
      const mockEquipo = { id: '1', nombre: 'Test', piezas: [] }
      vi.mocked(prisma.equipoReparacion.findUnique).mockResolvedValue(mockEquipo as any)

      const result = await getEquipoReparacion('1')
      expect(result).toEqual(mockEquipo)
    })

    it('should throw 404 when not found', async () => {
      vi.mocked(prisma.equipoReparacion.findUnique).mockResolvedValue(null)

      try {
        await getEquipoReparacion('not-found')
        expect.unreachable()
      } catch (e) {
        expect(e).toBeInstanceOf(ServerActionError)
        expect((e as ServerActionError).status).toBe(404)
      }
    })
  })

  describe('createEquipoReparacion', () => {
    it('should create equipo for admin user', async () => {
      vi.mocked(prisma.equipoReparacion.create).mockResolvedValue({ id: 'new-1', nombre: 'Nuevo', tenantId: 'tenant-1' } as any)

      const result = await createEquipoReparacion({ nombre: 'Nuevo' })
      expect(result.id).toBe('new-1')
    })

    it('should reject creation for dependiente', async () => {
      vi.mocked(getAuthenticatedContext).mockResolvedValue({ userId: 'user-2', tenantId: 'tenant-1', tenantRole: 'dependiente' })

      try {
        await createEquipoReparacion({ nombre: 'Nuevo' })
        expect.unreachable()
      } catch (e) {
        expect(e).toBeInstanceOf(ServerActionError)
        expect((e as ServerActionError).status).toBe(403)
      }
    })
  })

  describe('updateEquipoReparacion', () => {
    it('should update equipo', async () => {
      vi.mocked(prisma.equipoReparacion.update).mockResolvedValue({ id: '1', nombre: 'Updated' } as any)

      const result = await updateEquipoReparacion('1', { nombre: 'Updated' })
      expect(result.id).toBe('1')
    })
  })

  describe('deleteEquipoReparacion', () => {
    it('should delete equipo', async () => {
      vi.mocked(prisma.equipoReparacion.delete).mockResolvedValue({ id: '1' } as any)

      const result = await deleteEquipoReparacion('1')
      expect(result.success).toBe(true)
      expect(result.id).toBe('1')
    })
  })
})
