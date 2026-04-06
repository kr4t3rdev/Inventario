import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser } from '@/lib/auth-middleware'
import { AuditLogService } from '@/lib/services/audit-log-service'

// Schema para actualizar moneda
const UpdateMonedaSchema = z.object({
  nombre: z.string().min(1).optional(),
  simbolo: z.string().min(1).optional(),
  esPrincipal: z.boolean().optional(),
  isActive: z.boolean().optional()
})

// PUT /api/contabilidad/exchange/monedas/[codigo] - Actualizar moneda
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const { codigo } = await params
    const body = await request.json()
    const validatedData = UpdateMonedaSchema.parse(body)

    // Verificar que la moneda existe
    const monedaExistente = await prisma.moneda.findUnique({
      where: { codigo }
    })

    if (!monedaExistente) {
      return NextResponse.json(
        {
          success: false,
          error: 'Moneda no encontrada',
          code: 'CURRENCY_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // Si se marca como principal, desmarcar otras monedas principales
    if (validatedData.esPrincipal) {
      await prisma.moneda.updateMany({
        where: { 
          codigo: { not: codigo },
          esPrincipal: true 
        },
        data: { esPrincipal: false }
      })
    }

    const monedaActualizada = await prisma.moneda.update({
      where: { codigo },
      data: validatedData
    })

    const cambios: Record<string, { anterior: unknown; nuevo: unknown }> = {}
    for (const key of Object.keys(validatedData) as (keyof typeof validatedData)[]) {
      if (monedaExistente[key] !== monedaActualizada[key]) {
        cambios[key] = { anterior: monedaExistente[key], nuevo: monedaActualizada[key] }
      }
    }

    await AuditLogService.log({
      accion: 'UPDATE',
      entidad: 'MONEDA',
      entidadId: codigo,
      usuarioId: user.userId,
      detalles: { cambios }
    })

    return NextResponse.json({
      success: true,
      data: monedaActualizada,
      message: 'Moneda actualizada exitosamente'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos de entrada inválidos',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }

    console.error('Error updating currency:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al actualizar la moneda',
        code: 'UPDATE_CURRENCY_ERROR'
      },
      { status: 500 }
    )
  }
}