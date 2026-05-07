import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function listPlanes(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    const skip = (page - 1) * limit

    const [planes, total] = await Promise.all([
      prisma.plan.findMany({ skip, take: limit, orderBy: { precio: 'asc' } }),
      prisma.plan.count(),
    ])

    return NextResponse.json({
      data: planes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Error fetching planes:', error)
    return NextResponse.json({ error: 'Error fetching planes' }, { status: 500 })
  }
}

export async function createPlan(request: NextRequest, _context: unknown, user: any) {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const { nombre, descripcion, precio, duracionDias, maxUsuarios, maxAlmacenes, maxProductos } = body

  if (!nombre || !duracionDias) {
    return NextResponse.json({ error: 'Nombre y duración son requeridos' }, { status: 400 })
  }

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
}

export async function getPlan(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const plan = await prisma.plan.findUnique({ where: { planId: id } })

  if (!plan) {
    return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  }

  return NextResponse.json(plan)
}

export async function updatePlan(request: NextRequest, context: { params: Promise<{ id: string }> }, user: any) {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json()
  const { nombre, descripcion, precio, duracionDias, maxUsuarios, maxAlmacenes, maxProductos } = body

  const plan = await prisma.plan.update({
    where: { planId: id },
    data: {
      nombre,
      descripcion,
      precio: precio || 0,
      duracionDias,
      maxUsuarios,
      maxAlmacenes,
      maxProductos,
    },
  })

  return NextResponse.json(plan)
}

export async function deletePlan(request: NextRequest, context: { params: Promise<{ id: string }> }, user: any) {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await context.params

  const licenciasCount = await prisma.licencia.count({ where: { planId: id } })

  if (licenciasCount > 0) {
    return NextResponse.json(
      { error: 'No se puede eliminar un plan con licencias asociadas' },
      { status: 400 }
    )
  }

  await prisma.plan.delete({ where: { planId: id } })

  return NextResponse.json({ message: 'Plan eliminado' })
}
