import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authenticateUser } from "@/lib/auth-middleware"
import { z } from "zod"

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { id } = await params;
    const gs = await prisma.gastosDE.findUnique({
      where: { gastosDEId: id },
    })

    if (!gs) {
      return NextResponse.json({ error: "Gasto de Explotación no encontrado" }, { status: 404 })
    }

    return NextResponse.json(gs)
  } catch (error) {
    console.error("Error al obtener Gasto de Explotación:", error)
    return NextResponse.json({ error: "Error al obtener Gasto de Explotación" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { id } = await params;
    const body = await request.json()
    const validation = gastosDEPatchSchema.safeParse(body)

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || "Datos inválidos"
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    // Validate concepto/elemento relationship
    if (validation.data.conceptoId && validation.data.elementoId) {
      const elemento = await prisma.gastoElemento.findFirst({
        where: {
          elementoId: validation.data.elementoId,
          conceptoId: validation.data.conceptoId,
        },
      })
      if (!elemento) {
        return NextResponse.json(
          { error: "El elemento no pertenece al concepto seleccionado" },
          { status: 400 }
        )
      }
    }

    // Auto-generate tipo from concepto/elemento if both provided
    let tipo = validation.data.tipo
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

    const gs = await prisma.gastosDE.update({
      where: { gastosDEId: id },
      data: {
        ...validation.data,
        ...(tipo !== undefined && { tipo }),
      },
      include: {
        concepto: true,
        elemento: true,
      },
    })

    return NextResponse.json(gs)
  } catch (error) {
    console.error("Error al actualizar el Gasto de Explotación:", error)
    return NextResponse.json({ error: "Error al actualizar el Gasto de Explotación" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { id } = await context.params

    const gasto = await prisma.gastosDE.findUnique({
      where: { gastosDEId: id },
      include: { reconciliaciones: true },
    })

    if (!gasto) {
      return NextResponse.json({ error: "Gasto de Explotación no encontrado" }, { status: 404 })
    }

    if (gasto.reconciliaciones.length > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar un gasto que tiene reconciliaciones asociadas" },
        { status: 400 }
      )
    }

    await prisma.gastosDE.delete({
      where: { gastosDEId: id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar el Gasto de Explotación:", error)
    return NextResponse.json({ error: "Error al eliminar el Gasto de Explotación" }, { status: 500 })
  }
}
