import { type NextRequest, NextResponse } from "next/server"
import { z } from 'zod'
import prisma from "@/lib/prisma"
import { withAuthGet, withAuthPost } from "@/lib/auth-middleware"

class InvalidFkError extends Error {
  constructor(
    public field: string,
    public providedId: string
  ) {
    const feminineFields = ['categoría', 'subcategoría', 'unidad']
    const isFeminine = feminineFields.includes(field.toLowerCase())
    const article = isFeminine ? 'La' : 'El'
    const suffix = isFeminine ? 'a' : 'o'
    super(`${article} ${field} especificad${suffix} no existe`)
    this.name = 'InvalidFkError'
  }
}

async function normalizeId(id: string | null | undefined): string | null {
  if (!id || (typeof id === 'string' && id.trim() === '')) return null
  return typeof id === 'string' ? id.trim() : null
}

async function validateVendor(vendorId: string | null | undefined): Promise<void> {
  const normalized = await normalizeId(vendorId)
  if (!normalized) return
  const vendor = await prisma.vendor.findUnique({ where: { vendorId: normalized } })
  if (!vendor) throw new InvalidFkError('proveedor', normalized)
}

async function validateCategoria(categoriaId: string | null | undefined): Promise<void> {
  const normalized = await normalizeId(categoriaId)
  if (!normalized) return
  const categoria = await prisma.categoria.findUnique({ where: { catId: normalized } })
  if (!categoria) throw new InvalidFkError('categoría', normalized)
}

async function validateSubcategoria(subcategoriaId: string | null | undefined): Promise<void> {
  const normalized = await normalizeId(subcategoriaId)
  if (!normalized) return
  const subcategoria = await prisma.categoria.findUnique({ where: { catId: normalized } })
  if (!subcategoria) throw new InvalidFkError('subcategoría', normalized)
}

async function validateUnidad(unidadId: string | null | undefined): Promise<void> {
  const normalized = await normalizeId(unidadId)
  if (!normalized) return
  const unidad = await prisma.unidad.findUnique({ where: { unidadId: normalized } })
  if (!unidad) throw new InvalidFkError('unidad', normalized)
}

const servicioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().max(500).optional().nullable(),
  precio: z.coerce.number().int().nonnegative().optional(),
  precioCosto: z.coerce.number().int().nonnegative().optional().nullable(),
  precioVenta: z.coerce.number().int().nonnegative().optional().nullable(),
  codigoInterno: z.string().max(11).optional().nullable(),
  codigoNegocio: z.string().max(40).optional().nullable(),
  categoriaId: z.string().optional().nullable(),
  subcategoriaId: z.string().optional().nullable(),
  unidadId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  activo: z.boolean().optional(),
})

export const GET = withAuthGet(async (request: NextRequest, context: any, user: any) => {
  try {
    const Servicio = await prisma.servicios.findMany({
      where: { deletedAt: null },
      orderBy: { precio: "desc" },
    })

    return NextResponse.json(Servicio)
  } catch (error) {
    console.error("Error al obtener Servicio:", error)
    return NextResponse.json({ error: "Error al obtener Servicio" }, { status: 500 })
  }
})

export const POST = withAuthPost(async (request: NextRequest, context: any, user: any) => {
  try {
    const body = await request.json()
    const data = servicioSchema.parse(body)

    // Solo permitir crear servicios a usuarios con rol de admin o regularUser
    if (user.role === 'dependiente') {
      return NextResponse.json({
        error: 'Acceso restringido',
        message: 'Los dependientes no pueden crear servicios'
      }, { status: 403 })
    }

    // Validate foreign keys before creating
    await validateVendor(data.vendorId)
    await validateCategoria(data.categoriaId)
    await validateSubcategoria(data.subcategoriaId)
    await validateUnidad(data.unidadId)

    // Normalizar IDs: convertir strings vacíos a null
    const normalizedCategoriaId = await normalizeId(data.categoriaId)
    const normalizedSubcategoriaId = await normalizeId(data.subcategoriaId)
    const normalizedUnidadId = await normalizeId(data.unidadId)
    const normalizedVendorId = await normalizeId(data.vendorId)

    const gastoServicio = await prisma.servicios.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion,
        precio: data.precio ?? data.precioVenta ?? 0,
        precioCosto: data.precioCosto ?? null,
        precioVenta: data.precioVenta ?? data.precio ?? null,
        codigoInterno: data.codigoInterno ?? null,
        codigoNegocio: data.codigoNegocio ?? null,
        categoriaId: normalizedCategoriaId,
        subcategoriaId: normalizedSubcategoriaId,
        unidadId: normalizedUnidadId,
        vendorId: normalizedVendorId,
        activo: data.activo ?? true,
      },
    })

    return NextResponse.json(gastoServicio)
  } catch (error) {
    if (error instanceof InvalidFkError) {
      return NextResponse.json({
        error: error.message,
        field: error.field,
        providedId: error.providedId
      }, { status: 400 })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Datos de entrada inválidos',
        details: error.errors
      }, { status: 400 })
    }

    console.error("Error al crear el Servicio:", error)
    return NextResponse.json({ error: "Error al crear el Servicio" }, { status: 500 })
  }
})
