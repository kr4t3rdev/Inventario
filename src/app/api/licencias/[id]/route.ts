import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuthGet, withAuthPost } from "@/lib/auth-middleware"

export const GET = withAuthGet(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const licencia = await prisma.licencia.findUnique({
      where: { licenciaId: id },
      include: {
        usuario: { select: { userId: true, name: true, email: true } },
        plan: true,
      },
    })

    if (!licencia) {
      return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 })
    }

    return NextResponse.json(licencia)
  }
)

export const PUT = withAuthPost(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }, user: any) => {
    if (user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { activa, expiracion, usuarioId } = body

    const licenciaActual = await prisma.licencia.findUnique({
      where: { licenciaId: id },
      select: { usuarioId: true, expiracion: true },
    })

    if (!licenciaActual) {
      return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 })
    }

    const nuevaExpiracion = expiracion ? new Date(expiracion) : licenciaActual.expiracion

    const licencia = await prisma.$transaction(async (tx) => {
      const licUpdated = await tx.licencia.update({
        where: { licenciaId: id },
        data: {
          ...(activa !== undefined && { activa }),
          ...(expiracion && { expiracion: nuevaExpiracion }),
          ...(usuarioId && { usuarioId }),
        },
        include: {
          usuario: { select: { userId: true, name: true, email: true } },
          plan: true,
        },
      })

      if (activa === true || expiracion) {
        const targetUserId = usuarioId || licenciaActual.usuarioId
        await tx.user.update({
          where: { userId: targetUserId },
          data: { expiresAt: nuevaExpiracion },
        })
      }

      return licUpdated
    })

    return NextResponse.json(licencia)
  }
)

export const DELETE = withAuthPost(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }, user: any) => {
    if (user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const { id } = await params
    await prisma.licencia.delete({ where: { licenciaId: id } })

    return NextResponse.json({ message: "Licencia eliminada" })
  }
)
