import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { updateLicenciaSchema } from '@/lib/admin/schemas-licencias'

/**
 * @description Obtiene una licencia por ID
 * @param request NextRequest
 * @param params { id: string }
 * @returns NextResponse
 */
export const GET = withAuthGet(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const licencia = await prisma.licencia.findUnique({
      where: { licenciaId: id },
      include: {
        usuario: { select: { userId: true, name: true, email: true } },
        plan: true,
      },
    })

    if (!licencia) {
      return NextResponse.json(
        { error: 'Licencia no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(licencia)
  }
)

/**
 * @description Actualiza una licencia (activar/revocar/extender)
 * @param request NextRequest
 * @param params { id: string }
 * @returns NextResponse
 */
export const PUT = withAuthPost(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
    user: any
  ) => {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = updateLicenciaSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { activa, expiracion, usuarioId } = parsed.data

    const licenciaActual = await prisma.licencia.findUnique({
      where: { licenciaId: id },
      select: { usuarioId: true, expiracion: true, activa: true },
    })

    if (!licenciaActual) {
      return NextResponse.json(
        { error: 'Licencia no encontrada' },
        { status: 404 }
      )
    }

    const nuevaExpiracion = expiracion
      ? new Date(expiracion)
      : licenciaActual.expiracion

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
        if (targetUserId) {
          await tx.user.update({
            where: { userId: targetUserId },
            data: { expiresAt: nuevaExpiracion },
          })
        }
      }

      // Auditoría
      const accion = activa === false
        ? 'REVOCACION'
        : activa === true
          ? 'ACTIVACION'
          : expiracion
            ? 'EXTENSION'
            : 'MODIFICACION'

      await tx.licenciaAudit.create({
        data: {
          licenciaId: id,
          accion,
          realizadoPor: user.userId,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          detalles: JSON.stringify({
            cambios: { activa, expiracion, usuarioId },
            estadoAnterior: {
              activa: licenciaActual.activa,
              expiracion: licenciaActual.expiracion,
            },
          }),
        },
      })

      return licUpdated
    })

    return NextResponse.json(licencia)
  }
)

/**
 * @description Elimina una licencia
 * @param request NextRequest
 * @param params { id: string }
 * @returns NextResponse
 */
export const DELETE = withAuthPost(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
    user: any
  ) => {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params

    const licencia = await prisma.licencia.findUnique({
      where: { licenciaId: id },
      select: { usuarioId: true },
    })

    if (!licencia) {
      return NextResponse.json(
        { error: 'Licencia no encontrada' },
        { status: 404 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.licenciaAudit.create({
        data: {
          licenciaId: id,
          accion: 'ELIMINACION',
          realizadoPor: user.userId,
          ip: _request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: _request.headers.get('user-agent') || 'unknown',
          detalles: JSON.stringify({ usuarioId: licencia.usuarioId }),
        },
      })

      await tx.licencia.delete({ where: { licenciaId: id } })
    })

    return NextResponse.json({ message: 'Licencia eliminada' })
  }
)
