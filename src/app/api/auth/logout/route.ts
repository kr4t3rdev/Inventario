import { NextResponse, NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from "@/lib/prisma"
import { verify_token } from "@/lib/auth-utils"

export async function POST(request: NextRequest) {
  try {
    const auth_user = await verify_token(request)
    const ipAddress = request.headers.get("x-forwarded-for") || null
    const userAgent = request.headers.get("user-agent") || null

    if (auth_user) {
      await prisma.userSession.updateMany({
        where: {
          userId: auth_user.userId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      })

      await prisma.userActivityLog.create({
        data: {
          userId: auth_user.userId,
          action: "logout",
          details: JSON.stringify({
            timestamp: new Date().toISOString(),
          }),
          ipAddress,
          userAgent,
          performedBy: auth_user.userId,
        },
      })
    }

    const response = NextResponse.json({ message: 'Logout exitoso' })
    response.cookies.delete('token')
    return response
  } catch (error) {
    console.error("Error en logout:", error)
    const response = NextResponse.json({ message: 'Logout exitoso' })
    response.cookies.delete('token')
    return response
  }
}