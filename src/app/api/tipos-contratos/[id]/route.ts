import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'

/**
 * @description DELETE /api/tipos-contratos/[id] - Elimina un tipo de contrato personalizado
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response

    const { id } = params

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
    return NextResponse.json(
      { error: 'Failed to delete tipo de contrato' },
      { status: 500 }
    )
  }
}
