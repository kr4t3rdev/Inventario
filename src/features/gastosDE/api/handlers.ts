import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateUser, type AuthenticatedUser } from "@/lib/auth-middleware"
import { requireTenant } from "@/lib/services/tenant-scope"
import { z } from "zod"

const gastosDESchema = z.object({
  tipo: z.string().optional().nullable(),
  conceptoId: z.string().optional().nullable(),
  elementoId: z.string().optional().nullable(),
  proveedor: z.string().min(1, "El proveedor es requerido"),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  descripcion: z.string().min(1, "La descripción es requerida"),
  numeroFactura: z.string().optional().nullable(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "El período debe tener formato YYYY-MM").optional(),
})

export async function getGastosDEHandler(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const user = authResult.user as AuthenticatedUser
    const tenantId = requireTenant(user)

    const { searchParams } = new URL(request.url)
    const periodo = searchParams.get("periodo")
    const conceptoId = searchParams.get("conceptoId")
    const elementoId = searchParams.get("elementoId")

    const whereClause: any = { tenantId }
    if (periodo) whereClause.periodo = periodo
    if (conceptoId) whereClause.conceptoId = conceptoId
    if (elementoId) whereClause.elementoId = elementoId

    const gastosUtilitarios = await prisma.gastosDE.findMany({
      where: whereClause,
      include: { concepto: true, elemento: true },
      orderBy: { monto: "desc" },
    })

    return NextResponse.json(gastosUtilitarios)
  } catch (error) {
    console.error("Error al obtener Gastos de Explotación:", error)
    return NextResponse.json({ error: "Error al obtener Gastos de Explotación" }, { status: 500 })
  }
}

export async function createGastosDEHandler(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const user = authResult.user as AuthenticatedUser
    const tenantId = requireTenant(user)

    const data = await request.json()
    const validation = gastosDESchema.safeParse(data)

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || "Datos inválidos"
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    if (validation.data.conceptoId && validation.data.elementoId) {
      const elemento = await prisma.gastoElemento.findFirst({
        where: { elementoId: validation.data.elementoId, conceptoId: validation.data.conceptoId },
      })
      if (!elemento) {
        return NextResponse.json({ error: "El elemento no pertenece al concepto seleccionado" }, { status: 400 })
      }
    }

    const periodo = data.periodo || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

    let tipo = validation.data.tipo || null
    if (validation.data.conceptoId && validation.data.elementoId) {
      const concepto = await prisma.gastoConcepto.findUnique({
        where: { conceptoId: validation.data.conceptoId },
        include: { elementos: { where: { elementoId: validation.data.elementoId } } },
      })
      const elemento = concepto?.elementos?.[0]
      if (concepto && elemento) {
        tipo = `${concepto.nombre} — ${elemento.nombre}`
      }
    }

    const gastoServicio = await prisma.gastosDE.create({
      data: {
        gastosDEId: data.gastosDEId,
        tipo, conceptoId: validation.data.conceptoId || null, elementoId: validation.data.elementoId || null,
        proveedor: validation.data.proveedor, monto: validation.data.monto, periodo,
        numeroFactura: validation.data.numeroFactura || null, descripcion: validation.data.descripcion,
        tenantId,
      },
      include: { concepto: true, elemento: true },
    })

    return NextResponse.json(gastoServicio, { status: 201 })
  } catch (error) {
    console.error("Error al crear el Gasto de Explotación:", error)
    return NextResponse.json({ error: "Error al crear el Gasto de Explotación" }, { status: 500 })
  }
}

const gastosDEPatchSchema = z.object({
  tipo: z.string().optional().nullable(),
  conceptoId: z.string().optional().nullable(),
  elementoId: z.string().optional().nullable(),
  proveedor: z.string().min(1, "El proveedor es requerido").optional(),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0").optional(),
  descripcion: z.string().min(1, "La descripción es requerida").optional(),
  numeroFactura: z.string().optional().nullable(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "El período debe tener formato YYYY-MM").optional(),
})

export async function getGastosDEByIdHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { id } = await params
    const gs = await prisma.gastosDE.findUnique({ where: { gastosDEId: id } })

    if (!gs) return NextResponse.json({ error: "Gasto de Explotación no encontrado" }, { status: 404 })
    return NextResponse.json(gs)
  } catch (error) {
    console.error("Error al obtener Gasto de Explotación:", error)
    return NextResponse.json({ error: "Error al obtener Gasto de Explotación" }, { status: 500 })
  }
}

export async function updateGastosDEHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { id } = await params
    const body = await request.json()
    const validation = gastosDEPatchSchema.safeParse(body)

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || "Datos inválidos"
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    if (validation.data.conceptoId && validation.data.elementoId) {
      const elemento = await prisma.gastoElemento.findFirst({
        where: { elementoId: validation.data.elementoId, conceptoId: validation.data.conceptoId },
      })
      if (!elemento) {
        return NextResponse.json({ error: "El elemento no pertenece al concepto seleccionado" }, { status: 400 })
      }
    }

    let tipo = validation.data.tipo
    if (validation.data.conceptoId && validation.data.elementoId) {
      const concepto = await prisma.gastoConcepto.findUnique({
        where: { conceptoId: validation.data.conceptoId },
        include: { elementos: { where: { elementoId: validation.data.elementoId } } },
      })
      const elemento = concepto?.elementos?.[0]
      if (concepto && elemento) tipo = `${concepto.nombre} — ${elemento.nombre}`
    }

    const gs = await prisma.gastosDE.update({
      where: { gastosDEId: id },
      data: { ...validation.data, ...(tipo !== undefined && { tipo }) },
      include: { concepto: true, elemento: true },
    })

    return NextResponse.json(gs)
  } catch (error) {
    console.error("Error al actualizar el Gasto de Explotación:", error)
    return NextResponse.json({ error: "Error al actualizar el Gasto de Explotación" }, { status: 500 })
  }
}

export async function deleteGastosDEHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { id } = await context.params
    const gasto = await prisma.gastosDE.findUnique({
      where: { gastosDEId: id },
      include: { reconciliaciones: true },
    })

    if (!gasto) return NextResponse.json({ error: "Gasto de Explotación no encontrado" }, { status: 404 })
    if (gasto.reconciliaciones.length > 0) {
      return NextResponse.json({ error: "No se puede eliminar un gasto que tiene reconciliaciones asociadas" }, { status: 400 })
    }

    await prisma.gastosDE.delete({ where: { gastosDEId: id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar el Gasto de Explotación:", error)
    return NextResponse.json({ error: "Error al eliminar el Gasto de Explotación" }, { status: 500 })
  }
}

const conceptoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
})

export async function getGastoConceptosHandler(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { searchParams } = new URL(request.url)
    const onlyActive = searchParams.get("onlyActive") === "true"

    const conceptos = await prisma.gastoConcepto.findMany({
      where: onlyActive ? { isActive: true } : {},
      include: { _count: { select: { elementos: true, gastosDE: true } }, elementos: { where: { isActive: true }, orderBy: { nombre: "asc" } } },
      orderBy: { nombre: "asc" },
    })

    return NextResponse.json(conceptos)
  } catch (error) {
    console.error("Error al obtener Conceptos de Gastos:", error)
    return NextResponse.json({ error: "Error al obtener Conceptos de Gastos" }, { status: 500 })
  }
}

export async function createGastoConceptoHandler(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const data = await request.json()
    const validation = conceptoSchema.safeParse(data)

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || "Datos inválidos"
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    const existing = await prisma.gastoConcepto.findUnique({ where: { nombre: validation.data.nombre } })
    if (existing) return NextResponse.json({ error: "Ya existe un concepto con ese nombre" }, { status: 400 })

    const concepto = await prisma.gastoConcepto.create({ data: validation.data })
    return NextResponse.json(concepto, { status: 201 })
  } catch (error) {
    console.error("Error al crear el Concepto de Gasto:", error)
    return NextResponse.json({ error: "Error al crear el Concepto de Gasto" }, { status: 500 })
  }
}

const conceptoPatchSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").optional(),
  descripcion: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function getGastoConceptoByIdHandler(request: NextRequest, { params }: { params: Promise<{ conceptoId: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { conceptoId } = await params
    const concepto = await prisma.gastoConcepto.findUnique({
      where: { conceptoId },
      include: { elementos: { orderBy: { nombre: "asc" } }, _count: { select: { gastosDE: true } } },
    })

    if (!concepto) return NextResponse.json({ error: "Concepto no encontrado" }, { status: 404 })
    return NextResponse.json(concepto)
  } catch (error) {
    console.error("Error al obtener el Concepto:", error)
    return NextResponse.json({ error: "Error al obtener el Concepto" }, { status: 500 })
  }
}

export async function updateGastoConceptoHandler(request: NextRequest, { params }: { params: Promise<{ conceptoId: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { conceptoId } = await params
    const body = await request.json()
    const validation = conceptoPatchSchema.safeParse(body)

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || "Datos inválidos"
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    if (validation.data.nombre) {
      const existing = await prisma.gastoConcepto.findFirst({ where: { nombre: validation.data.nombre, conceptoId: { not: conceptoId } } })
      if (existing) return NextResponse.json({ error: "Ya existe un concepto con ese nombre" }, { status: 400 })
    }

    const concepto = await prisma.gastoConcepto.update({ where: { conceptoId }, data: validation.data })
    return NextResponse.json(concepto)
  } catch (error) {
    console.error("Error al actualizar el Concepto:", error)
    return NextResponse.json({ error: "Error al actualizar el Concepto" }, { status: 500 })
  }
}

export async function deleteGastoConceptoHandler(request: NextRequest, { params }: { params: Promise<{ conceptoId: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { conceptoId } = await params
    const concepto = await prisma.gastoConcepto.findUnique({ where: { conceptoId }, include: { _count: { select: { gastosDE: true } } } })

    if (!concepto) return NextResponse.json({ error: "Concepto no encontrado" }, { status: 404 })

    if (concepto._count.gastosDE > 0) {
      await prisma.gastoConcepto.update({ where: { conceptoId }, data: { isActive: false } })
      return NextResponse.json({ message: "Concepto desactivado (tiene gastos asociados)" })
    }

    await prisma.gastoConcepto.delete({ where: { conceptoId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar el Concepto:", error)
    return NextResponse.json({ error: "Error al eliminar el Concepto" }, { status: 500 })
  }
}

const elementoSchema = z.object({
  conceptoId: z.string().min(1, "El concepto es requerido"),
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
})

export async function getGastoElementosHandler(request: NextRequest, { params }: { params: Promise<{ conceptoId: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { conceptoId } = await params
    const concepto = await prisma.gastoConcepto.findUnique({ where: { conceptoId } })
    if (!concepto) return NextResponse.json({ error: "Concepto no encontrado" }, { status: 404 })

    const elementos = await prisma.gastoElemento.findMany({
      where: { conceptoId },
      include: { _count: { select: { gastosDE: true } } },
      orderBy: { nombre: "asc" },
    })

    return NextResponse.json(elementos)
  } catch (error) {
    console.error("Error al obtener Elementos:", error)
    return NextResponse.json({ error: "Error al obtener Elementos" }, { status: 500 })
  }
}

export async function createGastoElementoHandler(request: NextRequest, { params }: { params: Promise<{ conceptoId: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { conceptoId } = await params
    const data = await request.json()
    const validation = elementoSchema.safeParse({ ...data, conceptoId })

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || "Datos inválidos"
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    const concepto = await prisma.gastoConcepto.findUnique({ where: { conceptoId } })
    if (!concepto) return NextResponse.json({ error: "Concepto no encontrado" }, { status: 404 })

    const elemento = await prisma.gastoElemento.create({
      data: { nombre: validation.data.nombre, descripcion: validation.data.descripcion, isActive: validation.data.isActive, conceptoId },
    })

    return NextResponse.json(elemento, { status: 201 })
  } catch (error) {
    console.error("Error al crear el Elemento:", error)
    return NextResponse.json({ error: "Error al crear el Elemento" }, { status: 500 })
  }
}

const elementoPatchSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").optional(),
  descripcion: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function getGastoElementoByIdHandler(request: NextRequest, { params }: { params: Promise<{ conceptoId: string; elementoId: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { elementoId } = await params
    const elemento = await prisma.gastoElemento.findUnique({ where: { elementoId }, include: { concepto: true } })

    if (!elemento) return NextResponse.json({ error: "Elemento no encontrado" }, { status: 404 })
    return NextResponse.json(elemento)
  } catch (error) {
    console.error("Error al obtener el Elemento:", error)
    return NextResponse.json({ error: "Error al obtener el Elemento" }, { status: 500 })
  }
}

export async function updateGastoElementoHandler(request: NextRequest, { params }: { params: Promise<{ conceptoId: string; elementoId: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { elementoId } = await params
    const body = await request.json()
    const validation = elementoPatchSchema.safeParse(body)

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || "Datos inválidos"
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    const elemento = await prisma.gastoElemento.update({ where: { elementoId }, data: validation.data })
    return NextResponse.json(elemento)
  } catch (error) {
    console.error("Error al actualizar el Elemento:", error)
    return NextResponse.json({ error: "Error al actualizar el Elemento" }, { status: 500 })
  }
}

export async function deleteGastoElementoHandler(request: NextRequest, { params }: { params: Promise<{ conceptoId: string; elementoId: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { elementoId } = await params
    const elemento = await prisma.gastoElemento.findUnique({ where: { elementoId }, include: { _count: { select: { gastosDE: true } } } })

    if (!elemento) return NextResponse.json({ error: "Elemento no encontrado" }, { status: 404 })

    if (elemento._count.gastosDE > 0) {
      await prisma.gastoElemento.update({ where: { elementoId }, data: { isActive: false } })
      return NextResponse.json({ message: "Elemento desactivado (tiene gastos asociados)" })
    }

    await prisma.gastoElemento.delete({ where: { elementoId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar el Elemento:", error)
    return NextResponse.json({ error: "Error al eliminar el Elemento" }, { status: 500 })
  }
}
