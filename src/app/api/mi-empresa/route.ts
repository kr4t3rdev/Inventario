import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const miEmpresaUpsertSchema = z.object({
  nombre: z.string().min(1).optional(),
  propietario: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  carnetIdentidad: z.string().optional().nullable(),
  nit: z.string().optional().nullable(),
  licenciaOperacion: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  cuentaBancariaId: z.string().optional().nullable(),
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
        },
        { status: 200 },
      )
    }

    return NextResponse.json(miEmpresa, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Error obteniendo Mi Empresa' }, { status: 500 })
  }
})

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const data = miEmpresaUpsertSchema.parse(body)

    const miEmpresa = await prisma.miEmpresa.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        nombre: data.nombre ?? 'Mi Empresa',
        propietario: data.propietario ?? undefined,
        direccion: data.direccion ?? undefined,
        telefono: data.telefono ?? undefined,
        email: data.email ?? undefined,
        carnetIdentidad: data.carnetIdentidad ?? undefined,
        nit: data.nit ?? undefined,
        licenciaOperacion: data.licenciaOperacion ?? undefined,
        logoUrl: data.logoUrl ?? undefined,
        cuentaBancariaId: data.cuentaBancariaId ?? undefined,
      },
      update: {
        ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
        ...(data.propietario !== undefined ? { propietario: data.propietario } : {}),
        ...(data.direccion !== undefined ? { direccion: data.direccion } : {}),
        ...(data.telefono !== undefined ? { telefono: data.telefono } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.carnetIdentidad !== undefined ? { carnetIdentidad: data.carnetIdentidad } : {}),
        ...(data.nit !== undefined ? { nit: data.nit } : {}),
        ...(data.licenciaOperacion !== undefined ? { licenciaOperacion: data.licenciaOperacion } : {}),
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
        ...(data.cuentaBancariaId !== undefined ? { cuentaBancariaId: data.cuentaBancariaId } : {}),
      },
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

    return NextResponse.json(miEmpresa, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error guardando Mi Empresa' }, { status: 500 })
  }
})
