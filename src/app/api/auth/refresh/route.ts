import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { getJwtSecret, getRefreshJwtSecret } from '@/lib/secrets'

function parseCookies(cookieHeader: string): Record<string, string> {
  const map: Record<string, string> = {}
  if (!cookieHeader) return map
  cookieHeader.split(';').forEach(part => {
    const [k, v] = part.trim().split('=')
    if (k) map[k] = v ?? ''
  })
  return map
}

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const cookies = parseCookies(cookieHeader)
    const refreshToken = cookies['refreshToken']
    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token missing' }, { status: 401 })
    }

    // Verify refresh token
    const payload = jwt.verify(refreshToken, getRefreshJwtSecret()) as {
      userId: string;
      email: string;
      refreshId?: number;
    }
    const { userId, email } = payload

    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        isActive: true,
        expiresAt: true,
      },
    })

    if (!user || !user.isActive) {
      const res = NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 })
      res.cookies.set('refreshToken', '', { maxAge: 0, path: '/' })
      return res
    }

    if (user.expiresAt && new Date() > user.expiresAt) {
      await prisma.user.update({
        where: { userId: user.userId },
        data: { isActive: false },
      })
      const res = NextResponse.json({ error: 'Usuario expirado' }, { status: 403 })
      res.cookies.set('refreshToken', '', { maxAge: 0, path: '/' })
      return res
    }

    const activeSession = await prisma.userSession.findFirst({
      where: {
        userId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    })

    if (!activeSession) {
      const res = NextResponse.json({ error: 'Sesión no válida' }, { status: 401 })
      res.cookies.set('refreshToken', '', { maxAge: 0, path: '/' })
      return res
    }

    // Issue new tokens
    const newToken = jwt.sign({ userId, email }, getJwtSecret(), {
      expiresIn: '15m',
    })
    const newRefreshToken = jwt.sign(
      { userId, email, refreshId: Date.now() },
      getRefreshJwtSecret(),
      { expiresIn: '30d' }
    )

    // Delete old sessions
    await prisma.userSession.deleteMany({
      where: { userId },
    })

    // Create new session with refresh token
    await prisma.userSession.create({
      data: {
        userId,
        token: newRefreshToken,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    const res = NextResponse.json({ token: newToken })
    res.cookies.set('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })
    return res
  } catch (err) {
    console.error('Refresh token error:', err)
    // Clear cookie si hay problemas
    const res = NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
    res.cookies.set('refreshToken', '', { maxAge: 0 })
    return res
  }
}
