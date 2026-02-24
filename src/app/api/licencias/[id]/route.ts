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

    const licencia = await prisma.licencia.update({
      where: { licenciaId: id },
      data: {
        ...(activa !== undefined && { activa }),
        ...(expiracion && { expiracion: new Date(expiracion) }),
        ...(usuarioId && { usuarioId }),
      },
      include: {
        usuario: { select: { userId: true, name: true, email: true } },
        plan: true,
      },
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
