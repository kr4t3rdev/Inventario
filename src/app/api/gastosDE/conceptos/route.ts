import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authenticateUser } from "@/lib/auth-middleware"
import { z } from "zod"

const conceptoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
})

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const onlyActive = searchParams.get("onlyActive") === "true"

    const conceptos = await prisma.gastoConcepto.findMany({
      where: onlyActive ? { isActive: true } : {},
      include: {
        _count: {
          select: { elementos: true, gastosDE: true },
        },
        elementos: {
          where: { isActive: true },
          orderBy: { nombre: "asc" },
        },
      },
      orderBy: { nombre: "asc" },
    })

    return NextResponse.json(conceptos)
  } catch (error) {
    console.error("Error al obtener Conceptos de Gastos:", error)
    return NextResponse.json({ error: "Error al obtener Conceptos de Gastos" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const data = await request.json()
    const validation = conceptoSchema.safeParse(data)

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || "Datos inválidos"
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    const existing = await prisma.gastoConcepto.findUnique({
      where: { nombre: validation.data.nombre },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un concepto con ese nombre" },
        { status: 400 }
      )
    }

    const concepto = await prisma.gastoConcepto.create({
      data: validation.data,
    })

    return NextResponse.json(concepto, { status: 201 })
  } catch (error) {
    console.error("Error al crear el Concepto de Gasto:", error)
    return NextResponse.json({ error: "Error al crear el Concepto de Gasto" }, { status: 500 })
  }
}
