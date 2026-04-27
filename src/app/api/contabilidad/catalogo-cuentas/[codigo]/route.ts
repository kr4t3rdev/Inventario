import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser } from '@/lib/auth-middleware'

const NATURALEZAS = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'EGRESO', 'RESULTADO'] as const
const NIVELES = ['MAYOR', 'SUBMAYOR', 'ANALITICA'] as const

const updateSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  naturaleza: z.enum(NATURALEZAS).optional(),
  nivel: z.enum(NIVELES).optional(),
  activa: z.boolean().optional(),
})

/**
 * @description Obtiene una cuenta del catálogo por su código.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { codigo } = await params
    const cuenta = await prisma.cuentaContable.findUnique({ where: { codigo } })

    if (!cuenta) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ cuenta })
  } catch (error) {
    console.error('Error obteniendo cuenta contable:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * @description Actualiza una cuenta del catálogo. Solo modifica los campos enviados.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { codigo } = await params
    const body = await request.json()
    const data = updateSchema.parse(body)

    const existing = await prisma.cuentaContable.findUnique({ where: { codigo } })
    if (!existing) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    }

    const cuenta = await prisma.cuentaContable.update({ where: { codigo }, data })

    return NextResponse.json({ cuenta })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error actualizando cuenta contable:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * @description Elimina (desactiva) una cuenta del catálogo. No se borra físicamente, se marca como inactiva.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { codigo } = await params

    const existing = await prisma.cuentaContable.findUnique({ where: { codigo } })
    if (!existing) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    }

    const cuenta = await prisma.cuentaContable.update({ where: { codigo }, data: { activa: false } })

    return NextResponse.json({ cuenta })
  } catch (error) {
    console.error('Error desactivando cuenta contable:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
