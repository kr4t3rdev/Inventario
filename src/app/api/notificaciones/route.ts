import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateUser } from "@/lib/auth-middleware"

export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    // Obtener todas las notificaciones del usuario
    const notificaciones = await prisma.notification.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
    })

    // Calcular resumen
    const resumen = {
      total: notificaciones.length,
      alta: notificaciones.filter((n: { prioridad: string }) => n.prioridad === "alta").length,
      media: notificaciones.filter((n: { prioridad: string }) => n.prioridad === "media").length,
      baja: notificaciones.filter((n: { prioridad: string }) => n.prioridad === "baja").length,
      noLeidas: notificaciones.filter((n: { isRead: boolean }) => !n.isRead).length,
    }

    return NextResponse.json({
      notificaciones,
      resumen,
    })
  } catch (error) {
    console.error("Error obteniendo notificaciones:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const body = await request.json()

    // Si es para marcar como leída
    if (body.id && body.leida !== undefined) {
      const notificacion = await prisma.notification.update({
        where: {
          id: body.id,
          userId: user.userId, // Solo puede marcar sus propias notificaciones
        },
        data: { isRead: body.leida },
      })

      return NextResponse.json({ success: true, notificacion })
    }

    // Si es para crear una nueva notificación (solo admins)
    if (user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const { title, message, type, prioridad, userId } = body

    const notificacion = await prisma.notification.create({
      data: {
        title,
        message,
        type: type || "info",
        prioridad: prioridad || "media",
        userId: userId || user.userId,
      },
    })

    return NextResponse.json(notificacion)
  } catch (error) {
    console.error("Error procesando notificación:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
