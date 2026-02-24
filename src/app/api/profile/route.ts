import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
//import { verify_token } from "@/lib/auth-utils"

import { verify_token } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  try {   
    const user = await verify_token(request)
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const profile = await prisma.user.findMany({
      where: { userId: user.userId },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        isActive: true,
        activatedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
         
    return NextResponse.json(profile)
  } catch (error) {
    console.error("Error obteniendo perfil:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verify_token(request)
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { name, avatar } = await request.json()

    const updatedUser = await prisma.user.update({
      where: { userId: user.userId },
      data: { name, avatar },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        isActive: true,
        activatedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error("Error actualizando perfil:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
