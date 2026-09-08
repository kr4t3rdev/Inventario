import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'
import { ActionError } from '@/lib/server-actions'
import { requirePermission } from '@/lib/services/tenant-scope'

/**
 * @description DELETE /api/tipos-contratos/[id] - Elimina un tipo de contrato personalizado
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    requirePermission(authResultUser.user, 'config.tipos-contrato.eliminar', 'eliminar tipos de contrato')

    const { id } = await params

    // Validar que el tipo existe
    const tipo = await prisma.tipoContratoCustom.findUnique({
      where: { tipoCustomId: id },
    })

    if (!tipo) {
      return NextResponse.json(
        { error: 'Tipo de contrato no encontrado' },
        { status: 404 }
      )
    }

    // Eliminar
    await prisma.tipoContratoCustom.delete({
      where: { tipoCustomId: id },
    })

    return NextResponse.json(
      { message: 'Tipo de contrato eliminado exitosamente' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error al eliminar tipo de contrato:', error)
    if (error instanceof ActionError && error.code === 'FORBIDDEN') {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to delete tipo de contrato' },
      { status: 500 }
    )
  }
}
