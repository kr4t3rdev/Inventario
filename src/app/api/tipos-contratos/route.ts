import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser, withAuth } from '@/lib/auth-middleware'
import { requirePermission, requireTenant } from '@/lib/services/tenant-scope'
import { contratosAccessErrorResponse, requireContratosFeature } from '@/features/contratos/access'

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
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response

    requireContratosFeature(authResultUser.user)
    const tenantId = requireTenant(authResultUser.user)
    const searchParams = request.nextUrl.searchParams
    const activos = searchParams.get('activos')
    const where = {
      tenantId,
      activo: activos === 'false' ? false : true,
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
    const accessResponse = contratosAccessErrorResponse(error)
    if (accessResponse) return accessResponse
    return NextResponse.json(
      { error: 'Failed to fetch tipos de contratos' },
      { status: 500 }
    )
  }
})

/**
 * @description POST /api/tipos-contratos - Crea un nuevo tipo de contrato personalizado
 */
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    requireContratosFeature(user)
    requirePermission(user, 'config.tipos-contrato.crear', 'crear tipos de contrato')
    const tenantId = requireTenant(user)

    const body = await request.json()
    const data = tipoContratoCustomSchema.parse(body)

    // Validar que el nombre no exista ya
    const existe = await prisma.tipoContratoCustom.findFirst({
      where: { nombre: data.nombre, tenantId },
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
        tenantId,
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
    const accessResponse = contratosAccessErrorResponse(error)
    if (accessResponse) return accessResponse

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
})
