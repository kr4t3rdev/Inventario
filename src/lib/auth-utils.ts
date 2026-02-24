import type { NextRequest } from "next/server"
import * as jwt from "jsonwebtoken"
import { prisma } from "./prisma"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

export async function verify_token(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    let token = authHeader?.replace("Bearer ", "")

    if (!token) {
      token = request.cookies.get("token")?.value
    }

    if (!token) {
      return null
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }

    const session = await prisma.userSession.findUnique({
      where: { token },
      select: {
        isActive: true,
        expiresAt: true,
        userId: true,
      },
    })

    if (!session || !session.isActive) {
      return null
    }

    if (session.expiresAt && new Date() > session.expiresAt) {
      await prisma.userSession.update({
        where: { token },
        data: { isActive: false },
      })
      return null
    }

    const user = await prisma.user.findUnique({
      where: { userId: decoded.userId },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        isActive: true,
        expiresAt: true,
      },
    })

    if (!user || !user.isActive) {
      return null
    }

    if (user.expiresAt && new Date() > user.expiresAt) {
      await prisma.user.update({
        where: { userId: user.userId },
        data: { isActive: false },
      })
      return null
    }

    await prisma.userSession.update({
      where: { token },
      data: { lastActive: new Date() },
    })

    return user
  } catch (error) {
    return null
  }
}
