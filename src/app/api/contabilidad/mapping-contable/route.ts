import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser } from '@/lib/auth-middleware'

const updateMappingSchema = z.object({
  origenTipo: z.string().min(1),
  cuentaPrincipalCodigo: z.string().min(1),
  cuentaContrariaCodigo: z.string().min(1),
  etiqueta: z.string().optional(),
})

/**
 * @description Obtiene todos los mappings contables, combinando los de DB con los hardcodeados como respaldo.
 */
export async function GET() {
  try {
    const dbMappings = await prisma.mappingContable.findMany({
      include: {
        cuentaPrincipal: { select: { codigo: true, nombre: true, naturaleza: true } },
        cuentaContraria: { select: { codigo: true, nombre: true, naturaleza: true } },
      },
      orderBy: { origenTipo: 'asc' },
    })

    return NextResponse.json({ mappings: dbMappings })
  } catch (error) {
    console.error('Error listando mappings contables:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * @description Crea o actualiza un mapping contable (upsert por origenTipo).
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const body = await request.json()
    const data = updateMappingSchema.parse(body)

    // Validate referenced accounts exist
    const [principal, contraria] = await Promise.all([
      prisma.cuentaContable.findUnique({ where: { codigo: data.cuentaPrincipalCodigo } }),
      prisma.cuentaContable.findUnique({ where: { codigo: data.cuentaContrariaCodigo } }),
    ])

    if (!principal) {
      return NextResponse.json({ error: `Cuenta principal ${data.cuentaPrincipalCodigo} no encontrada en el catálogo` }, { status: 400 })
    }
    if (!contraria) {
      return NextResponse.json({ error: `Cuenta contraria ${data.cuentaContrariaCodigo} no encontrada en el catálogo` }, { status: 400 })
    }

    const mapping = await prisma.mappingContable.upsert({
      where: { origenTipo: data.origenTipo },
      create: {
        origenTipo: data.origenTipo,
        cuentaPrincipalCodigo: data.cuentaPrincipalCodigo,
        cuentaContrariaCodigo: data.cuentaContrariaCodigo,
        etiqueta: data.etiqueta,
      },
      update: {
        cuentaPrincipalCodigo: data.cuentaPrincipalCodigo,
        cuentaContrariaCodigo: data.cuentaContrariaCodigo,
        etiqueta: data.etiqueta,
      },
      include: {
        cuentaPrincipal: { select: { codigo: true, nombre: true, naturaleza: true } },
        cuentaContraria: { select: { codigo: true, nombre: true, naturaleza: true } },
      },
    })

    return NextResponse.json({ mapping })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error actualizando mapping contable:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
