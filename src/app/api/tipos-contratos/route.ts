import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser } from '@/lib/auth-middleware'

const tipoContratoCustomSchema = z.object({
  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .trim(),
  descripcion: z
    .string()
    .max(500, 'La descripción no puede exceder 500 caracteres')
    .trim()
    .optional()
    .nullable(),
})

/**
 * @description GET /api/tipos-contratos - Obtiene todos los tipos de contratos personalizados
 */
export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response

    const searchParams = request.nextUrl.searchParams
    const activos = searchParams.get('activos')

    const where: any = {}
    if (activos === 'true') {
      where.activo = true
    }

    const tipos = await prisma.tipoContratoCustom.findMany({
      where,
      include: {
        creador: {
          select: {
            userId: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { nombre: 'asc' },
    })

    return NextResponse.json({ data: tipos })
  } catch (error) {
    console.error('Error al obtener tipos de contratos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tipos de contratos' },
      { status: 500 }
    )
  }
}

/**
 * @description POST /api/tipos-contratos - Crea un nuevo tipo de contrato personalizado
 */
export async function POST(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const body = await request.json()
    const data = tipoContratoCustomSchema.parse(body)

    // Validar que el nombre no exista ya
    const existe = await prisma.tipoContratoCustom.findUnique({
      where: { nombre: data.nombre },
    })

    if (existe) {
      return NextResponse.json(
        { error: 'Este tipo de contrato ya existe' },
        { status: 409 }
      )
    }

    const tipo = await prisma.tipoContratoCustom.create({
      data: {
        ...data,
        creadoPor: user.userId,
      },
      include: {
        creador: {
          select: {
            userId: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(tipo, { status: 201 })
  } catch (error) {
    console.error('Error al crear tipo de contrato:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create tipo de contrato' },
      { status: 500 }
    )
  }
}
