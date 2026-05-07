import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireTenant } from '@/lib/services/tenant-scope'
import { z } from 'zod'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

const listaPrecioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  esDefault: z.boolean().optional().default(false),
})

const listaPrecioUpdateSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').optional(),
  descripcion: z.string().optional(),
  esDefault: z.boolean().optional(),
})

export async function getListasPreciosHandler(_req: any, _ctx: any, user: AuthenticatedUser) {
  const tenantId = requireTenant(user)
  const listas = await prisma.listaPrecio.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { puntosDeVenta: true, precios: true } } },
  })
  return NextResponse.json(listas)
}

export async function createListaPrecioHandler(req: any, _ctx: any, user: AuthenticatedUser) {
  const tenantId = requireTenant(user)
  const body = await req.json()
  const validatedData = listaPrecioSchema.parse(body)

  if (validatedData.esDefault) {
    await prisma.listaPrecio.updateMany({ where: { esDefault: true, tenantId }, data: { esDefault: false } })
  }

  const nuevaLista = await prisma.listaPrecio.create({ data: { ...validatedData, tenantId } })
  return NextResponse.json(nuevaLista, { status: 201 })
}

export async function getListaPrecioByIdHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const lista = await prisma.listaPrecio.findUnique({ where: { id }, include: { puntosDeVenta: true } })
    if (!lista) return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 })
    return NextResponse.json(lista)
  } catch (error) {
    console.error('Error getting price list:', error)
    return NextResponse.json({ error: 'Error al obtener la lista de precios' }, { status: 500 })
  }
}

export async function updateListaPrecioHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json()
    const validatedData = listaPrecioUpdateSchema.parse(body)
    const { id } = await params

    if (validatedData.esDefault) {
      await prisma.listaPrecio.updateMany({ where: { esDefault: true, id: { not: id } }, data: { esDefault: false } })
    }

    const listaActualizada = await prisma.listaPrecio.update({ where: { id }, data: validatedData })
    return NextResponse.json(listaActualizada)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error updating price list:', error)
    return NextResponse.json({ error: 'Error al actualizar la lista de precios' }, { status: 500 })
  }
}

export async function deleteListaPrecioHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const usoPuntoVenta = await prisma.puntoDeVenta.count({ where: { listaPrecioId: id } })

    if (usoPuntoVenta > 0) {
      const puntoDeVentaAsociado = await prisma.puntoDeVenta.findFirst({
        where: { listaPrecioId: id },
        select: { pvId: true, nombre: true },
      })
      return NextResponse.json({
        error: 'No se puede eliminar una lista de precios asociada a un punto de venta',
        code: 'LISTA_PRECIO_IN_USE',
        puntoDeVenta: puntoDeVentaAsociado,
      }, { status: 400 })
    }

    await prisma.listaPrecio.delete({ where: { id } })
    return NextResponse.json({ message: 'Lista de precios eliminada correctamente' })
  } catch (error) {
    console.error('Error deleting price list:', error)
    return NextResponse.json({ error: 'Error al eliminar la lista de precios' }, { status: 500 })
  }
}
