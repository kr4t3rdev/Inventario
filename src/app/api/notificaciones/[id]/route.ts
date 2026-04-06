import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateUser } from "@/lib/auth-middleware"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const body = await request.json()

    const notificacion = await prisma.notification.update({
      where: {
        id: id,
        userId: user.userId, // Solo puede actualizar sus propias notificaciones
      },
      data: body,
    })

    return NextResponse.json(notificacion)
  } catch (error) {
    console.error("Error actualizando notificación:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    await prisma.notification.delete({
      where: {
        id: id,
        userId: user.userId, // Solo puede eliminar sus propias notificaciones
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error eliminando notificación:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
