import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getProfile, updateProfile } from './profile'
import { ServerActionError } from './errors'

// Mocks
vi.mock('@/lib/api/client', () => ({
  getAuthenticatedContext: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { getAuthenticatedContext } from '@/lib/api/client'
import prisma from '@/lib/prisma'

describe('profile fetchers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthenticatedContext).mockResolvedValue({ userId: 'user-1' })
  })

  describe('getProfile', () => {
    it('should return profile array for authenticated user', async () => {
      const mockUser = {
        userId: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        avatar: null,
        isActive: true,
        activatedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser])

      const result = await getProfile()

      expect(result).toHaveLength(1)
      expect(result[0].userId).toBe('user-1')
      expect(result[0].name).toBe('Test User')
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
        })
      )
    })

    it('should throw ServerActionError when prisma fails', async () => {
      vi.mocked(prisma.user.findMany).mockRejectedValue(
        new Error('DB error')
      )

      try {
        await getProfile()
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ServerActionError)
        expect((error as ServerActionError).status).toBe(500)
      }
    })

    it('should return empty array for non-existent user', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([])

      const result = await getProfile()
      expect(result).toEqual([])
    })
  })

  describe('updateProfile', () => {
    it('should update and return user profile', async () => {
      const mockUpdated = {
        userId: 'user-1',
        name: 'Updated Name',
        email: 'test@example.com',
        role: 'admin',
        avatar: 'https://avatar.com/1',
        isActive: true,
        activatedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(prisma.user.update).mockResolvedValue(mockUpdated)

      const result = await updateProfile({
        name: 'Updated Name',
        avatar: 'https://avatar.com/1',
      })

      expect(result.userId).toBe('user-1')
      expect(result.name).toBe('Updated Name')
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          data: {
            name: 'Updated Name',
            avatar: 'https://avatar.com/1',
          },
        })
      )
    })

    it('should throw ServerActionError on update failure', async () => {
      vi.mocked(prisma.user.update).mockRejectedValue(
        new Error('Update failed')
      )

      try {
        await updateProfile({ name: 'New Name' })
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ServerActionError)
        expect((error as ServerActionError).status).toBe(500)
        expect((error as ServerActionError).message).toBe('Update failed')
      }
    })
  })
})
