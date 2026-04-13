import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authenticateUser } from "@/lib/auth-middleware"
import { z } from "zod"

const elementoSchema = z.object({
  conceptoId: z.string().min(1, "El concepto es requerido"),
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ conceptoId: string }> }) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { conceptoId } = await params

    const concepto = await prisma.gastoConcepto.findUnique({
      where: { conceptoId },
    })

    if (!concepto) {
      return NextResponse.json({ error: "Concepto no encontrado" }, { status: 404 })
    }

    const elementos = await prisma.gastoElemento.findMany({
      where: { conceptoId },
      include: {
        _count: {
          select: { gastosDE: true },
        },
      },
      orderBy: { nombre: "asc" },
    })

    return NextResponse.json(elementos)
  } catch (error) {
    console.error("Error al obtener Elementos:", error)
    return NextResponse.json({ error: "Error al obtener Elementos" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ conceptoId: string }> }) {
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

    const concepto = await prisma.gastoConcepto.findUnique({
      where: { conceptoId },
    })

    if (!concepto) {
      return NextResponse.json({ error: "Concepto no encontrado" }, { status: 404 })
    }

    const elemento = await prisma.gastoElemento.create({
      data: {
        nombre: validation.data.nombre,
        descripcion: validation.data.descripcion,
        isActive: validation.data.isActive,
        conceptoId,
      },
    })

    return NextResponse.json(elemento, { status: 201 })
  } catch (error) {
    console.error("Error al crear el Elemento:", error)
    return NextResponse.json({ error: "Error al crear el Elemento" }, { status: 500 })
  }
}
