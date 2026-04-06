import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { authenticateUser } from '../auth-middleware'
import { prisma } from '../prisma'
import jwt from 'jsonwebtoken'

vi.mock('../prisma', () => ({
  prisma: {
    userSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('jsonwebtoken')

describe('authenticateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return error if no authorization header', async () => {
    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test')
    )

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should return error if Bearer token missing', async () => {
    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: 'Invalid token' },
      })
    )

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should return error if JWT format invalid', async () => {
    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: 'Bearer invalid.token' },
      })
    )

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should return user if authentication successful', async () => {
    const mockUser = {
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin' as const,
      isActive: true,
    }

    const mockToken = 'valid.jwt.token'

    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: `Bearer ${mockToken}` },
      })
    )

    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-1',
      email: 'test@example.com',
    } as any)

    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      isActive: true,
      expiresAt: new Date(Date.now() + 1000000),
      userId: 'user-1',
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      throw new Error('Expected user object, got error response')
    }

    expect(result.user).toEqual(mockUser)
  })

  it('should return error if session is inactive', async () => {
    const mockToken = 'valid.jwt.token'

    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: `Bearer ${mockToken}` },
      })
    )

    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-1',
      email: 'test@example.com',
    } as any)

    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      isActive: false,
      expiresAt: new Date(Date.now() + 1000000),
      userId: 'user-1',
    } as any)

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should return error if session expired', async () => {
    const mockToken = 'valid.jwt.token'

    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: `Bearer ${mockToken}` },
      })
    )

    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-1',
      email: 'test@example.com',
    } as any)

    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      isActive: true,
      expiresAt: new Date(Date.now() - 1000), // Expired
      userId: 'user-1',
    } as any)

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should return error if user not found', async () => {
    const mockToken = 'valid.jwt.token'

    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: `Bearer ${mockToken}` },
      })
    )

    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-1',
      email: 'test@example.com',
    } as any)

    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      isActive: true,
      expiresAt: new Date(Date.now() + 1000000),
      userId: 'user-1',
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should return error if user is inactive', async () => {
    const mockToken = 'valid.jwt.token'

    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: `Bearer ${mockToken}` },
      })
    )

    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-1',
      email: 'test@example.com',
    } as any)

    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      isActive: true,
      expiresAt: new Date(Date.now() + 1000000),
      userId: 'user-1',
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      isActive: false,
    } as any)

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      expect(result.status).toBe(403)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should handle JWT errors gracefully', async () => {
    const mockToken = 'invalid.jwt.token'

    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: `Bearer ${mockToken}` },
      })
    )

    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new jwt.JsonWebTokenError('Invalid token')
    })

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })
})
