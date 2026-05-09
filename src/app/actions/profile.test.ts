import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getProfile, updateProfile } from './profile'
import { ServerActionError } from '@/lib/api/errors'

vi.mock('@/lib/api/profile', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

import * as fetcher from '@/lib/api/profile'
import { revalidateTag } from 'next/cache'

describe('profile Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getProfile', () => {
    it('should return profile from fetcher', async () => {
      const mockProfile = [{
        userId: 'user-1',
        name: 'Test',
        email: 'test@test.com',
        role: 'admin',
      }]
      vi.mocked(fetcher.getProfile).mockResolvedValue(mockProfile as any)

      const result = await getProfile()

      expect(result).toEqual(mockProfile)
      expect(fetcher.getProfile).toHaveBeenCalledOnce()
    })

    it('should throw ServerActionError on fetcher error', async () => {
      vi.mocked(fetcher.getProfile).mockRejectedValue(
        new ServerActionError('getProfile', 'GET', 401, 'No autenticado')
      )

      try {
        await getProfile()
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ServerActionError)
        expect((error as ServerActionError).status).toBe(401)
      }
    })
  })

  describe('updateProfile', () => {
    it('should update profile and revalidate cache', async () => {
      const mockUpdated = {
        userId: 'user-1',
        name: 'Updated',
        email: 'test@test.com',
        role: 'admin',
        avatar: null,
      }
      vi.mocked(fetcher.updateProfile).mockResolvedValue(mockUpdated as any)

      const result = await updateProfile({ name: 'Updated' })

      expect(result).toEqual(mockUpdated)
      expect(fetcher.updateProfile).toHaveBeenCalledWith({ name: 'Updated' })
      expect(revalidateTag).toHaveBeenCalledWith('Profile')
    })

    it('should throw ServerActionError on update failure', async () => {
      vi.mocked(fetcher.updateProfile).mockRejectedValue(
        new Error('DB error')
      )

      try {
        await updateProfile({ name: 'New' })
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ServerActionError)
        expect((error as ServerActionError).status).toBe(500)
      }
    })
  })
})
