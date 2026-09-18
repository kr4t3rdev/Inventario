import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'
import { canAccessAccountingItem } from '@/lib/plan-access'

// GET /api/contabilidad/transferencias/[id] - Get transfer details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    if (user.role !== 'admin' && !canAccessAccountingItem(user, 'Transferencias Bancarias')) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'ID de transferencia requerido' },
        { status: 400 }
      )
    }

    const transferencia = await prisma.transferenciaBancaria.findUnique({
      where: { transferenciaId: id },
      include: {
        cuentaOrigen: {
          select: {
            cuentaId: true,
            nombreBanco: true,
            numeroCuenta: true,
            tipoCuenta: true,
            moneda: true
          }
        },
        cuentaDestino: {
          select: {
            cuentaId: true,
            nombreBanco: true,
            numeroCuenta: true,
            tipoCuenta: true,
            moneda: true
          }
        }
      }
    })

    if (!transferencia) {
      return NextResponse.json(
        { error: 'Transferencia no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({ transferencia })

  } catch (error) {
    console.error('Error fetching transferencia:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
