import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { updatePlanSchema } from '@/lib/admin/schemas-licencias'

/**
 * @description Obtiene un plan por ID
 * @param request NextRequest
 * @param params { id: string }
 * @returns NextResponse
 */
export const GET = withAuthGet(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const plan = await prisma.plan.findUnique({
      where: { planId: id },
    })

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(plan)
  }
)

/**
 * @description Actualiza un plan
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
    const parsed = updatePlanSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { nombre, descripcion, precio, duracionDias, maxUsuarios, maxAlmacenes, maxProductos } =
      parsed.data

    const plan = await prisma.plan.update({
      where: { planId: id },
      data: {
        ...(nombre && { nombre }),
        ...(descripcion !== undefined && { descripcion }),
        ...(precio !== undefined && { precio }),
        ...(duracionDias && { duracionDias }),
        ...(maxUsuarios && { maxUsuarios }),
        ...(maxAlmacenes && { maxAlmacenes }),
        ...(maxProductos && { maxProductos }),
      },
    })

    return NextResponse.json(plan)
  }
)

/**
 * @description Elimina un plan
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

    const licenciasCount = await prisma.licencia.count({
      where: { planId: id },
    })

    if (licenciasCount > 0) {
      return NextResponse.json(
        {
          error: 'No se puede eliminar un plan con licencias asociadas',
          licenciasCount,
        },
        { status: 400 }
      )
    }

    await prisma.plan.delete({ where: { planId: id } })

    return NextResponse.json({ message: 'Plan eliminado' })
  }
)
