import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuthPost } from '@/lib/auth-middleware'
import { planSchema, planQuerySchema } from '@/lib/admin/schemas-licencias'
import { Prisma } from '@/generated/prisma'

/**
 * @description Lista planes con paginación
 * @param request NextRequest
 * @returns NextResponse
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = planQuerySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { page, limit, search } = parsed.data

    const where: Prisma.PlanWhereInput = search
      ? {
          OR: [
            { nombre: { contains: search, mode: 'insensitive' as const } },
            { descripcion: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [planes, total] = await Promise.all([
      prisma.plan.findMany({
        where,
        orderBy: { precio: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.plan.count({ where }),
    ])

    // Agregar conteo de licencias por plan
    const planesConConteo = await Promise.all(
      planes.map(async (plan) => {
        const licenciasCount = await prisma.licencia.count({
          where: { planId: plan.planId },
        })
        return { ...plan, licenciasCount }
      })
    )

    return NextResponse.json({
      planes: planesConConteo,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    })
  } catch (error) {
    console.error('Error fetching planes:', error)
    return NextResponse.json(
      { error: 'Error obteniendo planes' },
      { status: 500 }
    )
  }
}

/**
 * @description Crea un nuevo plan
 * @param request NextRequest
 * @returns NextResponse
 */
export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: any) => {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = planSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { nombre, descripcion, precio, duracionDias, maxUsuarios, maxAlmacenes, maxProductos } =
      parsed.data

    const plan = await prisma.plan.create({
      data: {
        nombre,
        descripcion,
        precio: precio || 0,
        duracionDias,
        maxUsuarios: maxUsuarios || 1,
        maxAlmacenes: maxAlmacenes || 1,
        maxProductos: maxProductos || 100,
      },
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error('Error creando plan:', error)
    return NextResponse.json(
      { error: 'Error creando plan' },
      { status: 500 }
    )
  }
})
