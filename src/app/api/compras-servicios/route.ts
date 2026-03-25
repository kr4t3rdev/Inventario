import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

const createSchema = z.object({
  servicioId: z.string().min(1, 'Seleccione un servicio'),
  proveedorId: z.string().optional().nullable(),
  numeroFactura: z.string().optional().nullable(),
  costoUnitario: z.coerce.number().int().positive(),
  cantidad: z.coerce.number().int().positive().default(1),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO']),
  estado: z.enum(['PENDIENTE', 'PAGADA']),
  descripcion: z.string().max(500).optional().nullable(),
  fechaServicio: z.string().optional().nullable(),
  fechaVencimiento: z.string().optional().nullable(),
})

/**
 * @description Lista servicios recibidos registrados.
 * @param {NextRequest} _request - Request entrante.
 * @returns {Promise<NextResponse>} Lista de compras de servicios.
 */
export const GET = withAuthGet(async (_request: NextRequest) => {
  try {
    const compras = await prisma.compraServicio.findMany({
      where: { deletedAt: null },
      include: {
        servicio: true,
        proveedor: { select: { vendorId: true, nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(compras)
  } catch (error) {
    console.error('Error al listar servicios recibidos:', error)
    return NextResponse.json({ error: 'Error al listar servicios recibidos' }, { status: 500 })
  }
})

/**
 * @description Registra un servicio recibido (egreso) sin afectar stock.
 * @param {NextRequest} request - Request con payload de compra de servicio.
 * @param {any} _context - Contexto de ruta.
 * @param {any} user - Usuario autenticado.
 * @returns {Promise<NextResponse>} Registro creado.
 */
export const POST = withAuthPost(async (request: NextRequest, _context: any, user: any) => {
  try {
    const data = createSchema.parse(await request.json())
    const total = data.cantidad * data.costoUnitario

    const compra = await prisma.compraServicio.create({
      data: {
        servicioId: data.servicioId,
        proveedorId: data.proveedorId ?? null,
        numeroFactura: data.numeroFactura ?? null,
        costoUnitario: data.costoUnitario,
        cantidad: data.cantidad,
        total,
        formaPago: data.formaPago,
        estado: data.estado,
        descripcion: data.descripcion ?? null,
        fechaServicio: data.fechaServicio ? new Date(data.fechaServicio) : new Date(),
        fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
        createdById: user.userId ?? user.id ?? null,
      },
      include: {
        servicio: true,
        proveedor: { select: { vendorId: true, nombre: true } },
      },
    })

    return NextResponse.json(compra, { status: 201 })
  } catch (error) {
    console.error('Error al registrar servicio recibido:', error)
    return NextResponse.json({ error: 'Error al registrar servicio recibido' }, { status: 500 })
  }
})
