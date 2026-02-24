import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verify_token } from "@/lib/auth-utils"
import { isAdminRole } from '@/lib/auth/roles';

/**
 * @description Obtiene el historial de login de un usuario específico para el panel de administración.
 * @param {NextRequest} request Solicitud HTTP entrante con los encabezados de autenticación.
 * @param {{ params: Promise<{ id: string }> }} context Parámetros dinámicos con el identificador del usuario.
 * @returns {Promise<NextResponse>} Respuesta JSON con el historial de login o el error correspondiente.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const auth_user = await verify_token(request)
    if (!auth_user || !isAdminRole(auth_user.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const { id } = await context.params

    const user = await prisma.user.findUnique({
      where: { userId: id },
      select: {
        userId: true,
        name: true,
        email: true,
        loginAttempts: true,
        lockedUntil: true,
        lastFailedLogin: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    const logs = await prisma.userActivityLog.findMany({
      where: {
        userId: id,
        action: { in: ["login_failed", "unlock_user"] },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    const failedAttempts = await prisma.userActivityLog.findMany({
      where: {
        userId: id,
        action: "login_failed",
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    return NextResponse.json({
      user,
      logs,
      failedAttempts,
      totalFailedAttempts: failedAttempts.length,
    })
  } catch (error) {
    console.error("Error obteniendo historial de intentos:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
