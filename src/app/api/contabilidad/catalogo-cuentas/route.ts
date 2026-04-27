import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser } from '@/lib/auth-middleware'

const NATURALEZAS = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'EGRESO', 'RESULTADO'] as const
const NIVELES = ['MAYOR', 'SUBMAYOR', 'ANALITICA'] as const

const createSchema = z.object({
  codigo: z.string().min(1).max(20),
  nombre: z.string().min(1).max(200),
  naturaleza: z.enum(NATURALEZAS),
  nivel: z.enum(NIVELES),
  activa: z.boolean().optional().default(true),
})

const updateSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  naturaleza: z.enum(NATURALEZAS).optional(),
  nivel: z.enum(NIVELES).optional(),
  activa: z.boolean().optional(),
})

/**
 * @description Lista todas las cuentas del catálogo contable. Filtro opcional por naturaleza y búsqueda por nombre.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { searchParams } = new URL(request.url)
    const naturaleza = searchParams.get('naturaleza') ?? undefined
    const soloActivas = searchParams.get('activas') !== 'false'
    const search = searchParams.get('search') ?? undefined

    const where: Record<string, unknown> = {}
    if (naturaleza) where.naturaleza = naturaleza
    if (soloActivas) where.activa = true
    if (search) where.nombre = { contains: search, mode: 'insensitive' }

    const cuentas = await prisma.cuentaContable.findMany({
      where,
      orderBy: { codigo: 'asc' },
    })

    return NextResponse.json({ cuentas })
  } catch (error) {
    console.error('Error listando catálogo de cuentas:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * @description Crea una nueva cuenta en el catálogo contable.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const body = await request.json()
    const data = createSchema.parse(body)

    const existing = await prisma.cuentaContable.findUnique({ where: { codigo: data.codigo } })
    if (existing) {
      return NextResponse.json({ error: 'Ya existe una cuenta con ese código' }, { status: 409 })
    }

    const cuenta = await prisma.cuentaContable.create({ data })

    return NextResponse.json({ cuenta }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error creando cuenta contable:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
