import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const miEmpresaUpsertSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').optional(),
  propietario: z.string().min(1, 'El propietario debe tener al menos 1 carácter').optional().nullable(),
  direccion: z.string().min(1, 'La dirección debe tener al menos 1 carácter').optional().nullable(),
  telefono: z.string().regex(/^[0-9\-\+\s\(\)]+$/, 'Teléfono inválido').optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable(),
  carnetIdentidad: z.string().min(1, 'Cédula debe tener al menos 1 carácter').optional().nullable(),
  nit: z.string().min(1, 'NIT debe tener al menos 1 carácter').optional().nullable(),
  licenciaOperacion: z.string().min(1, 'Licencia debe tener al menos 1 carácter').optional().nullable(),
  logoUrl: z.string().url('URL del logo inválida').optional().nullable(),
  cuentaBancariaId: z.string().min(1, 'ID de cuenta inválido').optional().nullable(),
  usaCodigoEan13: z.boolean().optional(),
})

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const miEmpresa = await prisma.miEmpresa.findUnique({
      where: { id: 1 },
      include: {
        cuentaBancaria: {
          select: {
            cuentaId: true,
            nombreBanco: true,
            numeroCuenta: true,
            moneda: true,
            tipoCuenta: true,
            isActive: true,
          },
        },
      },
    })

    if (!miEmpresa) {
      return NextResponse.json(
        {
          id: 1,
          nombre: 'Mi Empresa',
          propietario: null,
          direccion: null,
          telefono: null,
          email: null,
          carnetIdentidad: null,
          nit: null,
          licenciaOperacion: null,
          logoUrl: null,
          cuentaBancariaId: null,
          cuentaBancaria: null,
          usaCodigoEan13: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { status: 200 },
      )
    }

    return NextResponse.json(miEmpresa, { status: 200 })
  } catch (error) {
    console.error('❌ Error al obtener Mi Empresa:', error)
    return NextResponse.json({ error: 'Error obteniendo Mi Empresa' }, { status: 500 })
  }
})

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    console.log('🚀 PUT /api/mi-empresa - Iniciando')
    const body = await request.json()
    console.log('📦 Body recibido:', JSON.stringify(body, null, 2))

    // Validar con Zod
    const validationResult = miEmpresaUpsertSchema.safeParse(body)
    
    if (!validationResult.success) {
      console.error('❌ Validation error:', validationResult.error.errors)
      const fieldErrors = validationResult.error.errors.reduce(
        (acc, err) => {
          const field = err.path.join('.')
          acc[field] = err.message
          return acc
        },
        {} as Record<string, string>,
      )
      return NextResponse.json(
        { error: 'Validation error', fieldErrors },
        { status: 400 },
      )
    }

    const data = validationResult.data
    console.log('✅ Validación Zod exitosa')

    // Construir objeto de actualización solo con campos definidos
    const updateData: Record<string, any> = {}
    
    if (data.nombre !== undefined) updateData.nombre = data.nombre
    if (data.propietario !== undefined) updateData.propietario = data.propietario
    if (data.direccion !== undefined) updateData.direccion = data.direccion
    if (data.telefono !== undefined) updateData.telefono = data.telefono
    if (data.email !== undefined) updateData.email = data.email
    if (data.carnetIdentidad !== undefined) updateData.carnetIdentidad = data.carnetIdentidad
    if (data.nit !== undefined) updateData.nit = data.nit
    if (data.licenciaOperacion !== undefined) updateData.licenciaOperacion = data.licenciaOperacion
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl
    if (data.cuentaBancariaId !== undefined) updateData.cuentaBancariaId = data.cuentaBancariaId
    if (data.usaCodigoEan13 !== undefined) updateData.usaCodigoEan13 = data.usaCodigoEan13

    console.log('💾 Ejecutando upsert a base de datos...', { updateData })

    const miEmpresa = await prisma.miEmpresa.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        nombre: data.nombre ?? 'Mi Empresa',
        propietario: data.propietario ?? null,
        direccion: data.direccion ?? null,
        telefono: data.telefono ?? null,
        email: data.email ?? null,
        carnetIdentidad: data.carnetIdentidad ?? null,
        nit: data.nit ?? null,
        licenciaOperacion: data.licenciaOperacion ?? null,
        logoUrl: data.logoUrl ?? null,
        cuentaBancariaId: data.cuentaBancariaId ?? null,
        usaCodigoEan13: data.usaCodigoEan13 ?? false,
      },
      update: updateData,
      include: {
        cuentaBancaria: {
          select: {
            cuentaId: true,
            nombreBanco: true,
            numeroCuenta: true,
            moneda: true,
            tipoCuenta: true,
            isActive: true,
          },
        },
      },
    })

    console.log('✅ Upsert exitoso')
    return NextResponse.json(miEmpresa, { status: 200 })
  } catch (error) {
    console.error('❌ Error al guardar Mi Empresa:', error)
    if (error instanceof z.ZodError) {
      const fieldErrors = error.errors.reduce(
        (acc, err) => {
          const field = err.path.join('.')
          acc[field] = err.message
          return acc
        },
        {} as Record<string, string>,
      )
      return NextResponse.json(
        { error: 'Validation error', fieldErrors },
        { status: 400 },
      )
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Detalles del error:', errorMessage)
    return NextResponse.json(
      { error: 'Error guardando Mi Empresa', details: errorMessage },
      { status: 500 },
    )
  }
})
