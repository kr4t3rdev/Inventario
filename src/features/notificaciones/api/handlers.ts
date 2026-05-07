import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateUser } from "@/lib/auth-middleware"
import { verificarStockBajo } from "@/lib/notificaciones-utils"

export async function getNotificacionesHandler(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const notificaciones = await prisma.notification.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
    })

    const resumen = {
      total: notificaciones.length,
      alta: notificaciones.filter((n: { prioridad: string }) => n.prioridad === "alta").length,
      media: notificaciones.filter((n: { prioridad: string }) => n.prioridad === "media").length,
      baja: notificaciones.filter((n: { prioridad: string }) => n.prioridad === "baja").length,
      noLeidas: notificaciones.filter((n: { isRead: boolean }) => !n.isRead).length,
    }

    return NextResponse.json({ notificaciones, resumen })
  } catch (error) {
    console.error("Error obteniendo notificaciones:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function createNotificacionHandler(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const body = await request.json()

    if (body.id && body.leida !== undefined) {
      const notificacion = await prisma.notification.update({
        where: { id: body.id, userId: user.userId },
        data: { isRead: body.leida },
      })
      return NextResponse.json({ success: true, notificacion })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const { title, message, type, prioridad, userId } = body
    const notificacion = await prisma.notification.create({
      data: { title, message, type: type || "info", prioridad: prioridad || "media", userId: userId || user.userId },
    })

    return NextResponse.json(notificacion)
  } catch (error) {
    console.error("Error procesando notificación:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function updateNotificacionHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const body = await request.json()
    const notificacion = await prisma.notification.update({
      where: { id, userId: user.userId },
      data: body,
    })

    return NextResponse.json(notificacion)
  } catch (error) {
    console.error("Error actualizando notificación:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function deleteNotificacionHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    await prisma.notification.delete({ where: { id, userId: user.userId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error eliminando notificación:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function verificarStockHandler(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const resultado = await verificarStockBajo()

    return NextResponse.json({
      success: true,
      mensaje: `Verificación completada. ${resultado.stockBajo} productos con stock bajo, ${resultado.sinStock} productos sin stock`,
      ...resultado,
    })
  } catch (error) {
    console.error("Error verificando stock:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
