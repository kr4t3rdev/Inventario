import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { licenciaQuerySchema, licenciaSchema } from '@/lib/admin/schemas-licencias'
import { Prisma } from '@/generated/prisma'

/**
 * @description Lista licencias con paginación, filtros y ordenamiento
 * @param request NextRequest
 * @returns NextResponse
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = licenciaQuerySchema.safeParse({
      planId: searchParams.get('planId') ?? undefined,
      activa: searchParams.get('activa') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      sortBy: searchParams.get('sortBy') ?? undefined,
      sortOrder: searchParams.get('sortOrder') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { planId, activa, search, page, limit, sortBy, sortOrder } = parsed.data

    const where: Prisma.LicenciaWhereInput = {
      ...(planId ? { planId } : {}),
      ...(activa !== undefined ? { activa: activa === 'true' } : {}),
      ...(search
        ? {
            OR: [
              { clave: { contains: search, mode: 'insensitive' as const } },
              {
                usuario: {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { email: { contains: search, mode: 'insensitive' as const } },
                  ],
                },
              },
            ],
          }
        : {}),
    }

    const orderBy: Prisma.LicenciaOrderByWithRelationInput = {}
    if (sortBy === 'expiracion' || sortBy === 'createdAt') {
      orderBy[sortBy] = sortOrder
    } else {
      orderBy.createdAt = sortOrder
    }

    const [licencias, total] = await Promise.all([
      prisma.licencia.findMany({
        where,
        include: {
          usuario: { select: { userId: true, name: true, email: true } },
          plan: true,
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.licencia.count({ where }),
    ])

    return NextResponse.json({
      licencias,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    })
  } catch (error) {
    console.error('Error fetching licencias:', error)
    return NextResponse.json(
      { error: 'Error obteniendo licencias' },
      { status: 500 }
    )
  }
})

/**
 * @description Crea una nueva licencia manual
 * @param request NextRequest
 * @returns NextResponse
 */
export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: any) => {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = licenciaSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { clave, usuarioId, planId, duracionDias } = parsed.data

    const plan = await prisma.plan.findUnique({ where: { planId } })
    if (!plan) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
    }

    const usuario = await prisma.user.findUnique({ where: { userId: usuarioId } })
    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const expiracion = new Date()
    expiracion.setDate(expiracion.getDate() + (duracionDias || plan.duracionDias))

    const licenseKey =
      typeof clave === 'string' && clave.trim().length > 0
        ? clave.trim()
        : generarClave()

    const licencia = await prisma.$transaction(async (tx) => {
      const nuevaLicencia = await tx.licencia.create({
        data: {
          clave: licenseKey,
          usuarioId,
          planId,
          expiracion,
        },
        include: {
          usuario: { select: { userId: true, name: true, email: true } },
          plan: true,
        },
      })

      await tx.user.update({
        where: { userId: usuarioId },
        data: { expiresAt: expiracion },
      })

      await tx.licenciaAudit.create({
        data: {
          licenciaId: nuevaLicencia.licenciaId,
          accion: 'CREACION',
          realizadoPor: user.userId,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          detalles: JSON.stringify({
            plan: plan.nombre,
            duracionDias: duracionDias || plan.duracionDias,
            expiracion: expiracion.toISOString(),
            tipo: 'manual',
          }),
        },
      })

      return nuevaLicencia
    })

    return NextResponse.json(licencia, { status: 201 })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as any).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'La clave de licencia ya existe' },
        { status: 409 }
      )
    }
    console.error('Error creando licencia:', error)
    return NextResponse.json(
      { error: 'Error creando licencia' },
      { status: 500 }
    )
  }
})

function generarClave(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = 4
  const len = 5
  const parts: string[] = []

  for (let s = 0; s < seg; s++) {
    let segmento = ''
    for (let i = 0; i < len; i++) {
      segmento += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    parts.push(segmento)
  }

  return parts.join('-')
}
