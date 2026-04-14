import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authenticateUser } from "@/lib/auth-middleware"
import { z } from "zod"

const conceptoPatchSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").optional(),
  descripcion: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ conceptoId: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { conceptoId } = await params
    const concepto = await prisma.gastoConcepto.findUnique({
      where: { conceptoId },
      include: {
        elementos: {
          orderBy: { nombre: "asc" },
        },
        _count: {
          select: { gastosDE: true },
        },
      },
    })

    if (!concepto) {
      return NextResponse.json({ error: "Concepto no encontrado" }, { status: 404 })
    }

    return NextResponse.json(concepto)
  } catch (error) {
    console.error("Error al obtener el Concepto:", error)
    return NextResponse.json({ error: "Error al obtener el Concepto" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ conceptoId: string }> }) {
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

    // Check for duplicate name if name is being changed
    if (validation.data.nombre) {
      const existing = await prisma.gasto.findFirst({
        where: { nombre: validation.data.nombre, conceptoId: { not: conceptoId } },
      })
      if (existing) {
        return NextResponse.json(
          { error: "Ya existe un concepto con ese nombre" },
          { status: 400 }
        )
      }
    }

    const concepto = await prisma.gastoConcepto.update({
      where: { conceptoId },
      data: validation.data,
    })

    return NextResponse.json(concepto)
  } catch (error) {
    console.error("Error al actualizar el Concepto:", error)
    return NextResponse.json({ error: "Error al actualizar el Concepto" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ conceptoId: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { conceptoId } = await params

    const concepto = await prisma.gastoConcepto.findUnique({
      where: { conceptoId },
      include: { _count: { select: { gastosDE: true } } },
    })

    if (!concepto) {
      return NextResponse.json({ error: "Concepto no encontrado" }, { status: 404 })
    }

    // Soft-delete by deactivating if there are associated expenses
    if (concepto._count.gastosDE > 0) {
      await prisma.gastoConcepto.update({
        where: { conceptoId },
        data: { isActive: false },
      })
      return NextResponse.json({ message: "Concepto desactivado (tiene gastos asociados)" })
    }

    // Delete if no associated expenses (cascade will delete elementos)
    await prisma.gastoConcepto.delete({
      where: { conceptoId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar el Concepto:", error)
    return NextResponse.json({ error: "Error al eliminar el Concepto" }, { status: 500 })
  }
}
