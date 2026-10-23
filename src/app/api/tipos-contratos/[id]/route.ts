import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authenticateUser, withAuth } from '@/lib/auth-middleware'
import { requirePermission, requireTenant } from '@/lib/services/tenant-scope'
import { contratosAccessErrorResponse, requireContratosFeature } from '@/features/contratos/access'

/**
 * @description DELETE /api/tipos-contratos/[id] - Elimina un tipo de contrato personalizado
 */
export const DELETE = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    requireContratosFeature(authResultUser.user)
    requirePermission(authResultUser.user, 'config.tipos-contrato.eliminar', 'eliminar tipos de contrato')
    const tenantId = requireTenant(authResultUser.user)

    const { id } = await params

    const archived = await prisma.tipoContratoCustom.updateMany({
      where: { tipoCustomId: id, tenantId, activo: true },
      data: { activo: false },
    })

    if (archived.count !== 1) {
      return NextResponse.json(
        { error: 'Tipo de contrato no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { message: 'Tipo de contrato desactivado exitosamente' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error al eliminar tipo de contrato:', error)
    const accessResponse = contratosAccessErrorResponse(error)
    if (accessResponse) return accessResponse
    return NextResponse.json(
      { error: 'Failed to delete tipo de contrato' },
      { status: 500 }
    )
  }
})
