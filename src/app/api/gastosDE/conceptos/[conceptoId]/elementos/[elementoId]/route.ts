import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authenticateUser } from "@/lib/auth-middleware"
import { z } from "zod"

const elementoPatchSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").optional(),
  descripcion: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ conceptoId: string; elementoId: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { elementoId } = await params
    const elemento = await prisma.gastoElemento.findUnique({
      where: { elementoId },
      include: { concepto: true },
    })

    if (!elemento) {
      return NextResponse.json({ error: "Elemento no encontrado" }, { status: 404 })
    }

    return NextResponse.json(elemento)
  } catch (error) {
    console.error("Error al obtener el Elemento:", error)
    return NextResponse.json({ error: "Error al obtener el Elemento" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ conceptoId: string; elementoId: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { elementoId } = await params
    const body = await request.json()
    const validation = elementoPatchSchema.safeParse(body)

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || "Datos inválidos"
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    const elemento = await prisma.gastoElemento.update({
      where: { elementoId },
      data: validation.data,
    })

    return NextResponse.json(elemento)
  } catch (error) {
    console.error("Error al actualizar el Elemento:", error)
    return NextResponse.json({ error: "Error al actualizar el Elemento" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ conceptoId: string; elementoId: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { elementoId } = await params

    const elemento = await prisma.gastoElemento.findUnique({
      where: { elementoId },
      include: { _count: { select: { gastosDE: true } } },
    })

    if (!elemento) {
      return NextResponse.json({ error: "Elemento no encontrado" }, { status: 404 })
    }

    // Soft-delete if associated with expenses
    if (elemento._count.gastosDE > 0) {
      await prisma.gastoElemento.update({
        where: { elementoId },
        data: { isActive: false },
      })
      return NextResponse.json({ message: "Elemento desactivado (tiene gastos asociados)" })
    }

    await prisma.gastoElemento.delete({
      where: { elementoId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar el Elemento:", error)
    return NextResponse.json({ error: "Error al eliminar el Elemento" }, { status: 500 })
  }
}
