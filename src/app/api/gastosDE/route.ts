import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authenticateUser } from "@/lib/auth-middleware"
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

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { searchParams } = new URL(request.url)
    const periodo = searchParams.get("periodo")
    const conceptoId = searchParams.get("conceptoId")
    const elementoId = searchParams.get("elementoId")

    const whereClause: any = {}
    if (periodo) whereClause.periodo = periodo
    if (conceptoId) whereClause.conceptoId = conceptoId
    if (elementoId) whereClause.elementoId = elementoId

    const gastosUtilitarios = await prisma.gastosDE.findMany({
      where: whereClause,
      include: {
        concepto: true,
        elemento: true,
      },
      orderBy: { monto: "desc" },
    })

    return NextResponse.json(gastosUtilitarios)
  } catch (error) {
    console.error("Error al obtener Gastos de Explotación:", error)
    return NextResponse.json({ error: "Error al obtener Gastos de Explotación" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const data = await request.json()
    const validation = gastosDESchema.safeParse(data)

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

    const periodo = data.periodo || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

    // Auto-generate tipo from concepto/elemento if available
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
        tipo,
        conceptoId: validation.data.conceptoId || null,
        elementoId: validation.data.elementoId || null,
        proveedor: validation.data.proveedor,
        monto: validation.data.monto,
        periodo,
        numeroFactura: validation.data.numeroFactura || null,
        descripcion: validation.data.descripcion,
      },
      include: {
        concepto: true,
        elemento: true,
      },
    })

    return NextResponse.json(gastoServicio, { status: 201 })
  } catch (error) {
    console.error("Error al crear el Gasto de Explotación:", error)
    return NextResponse.json({ error: "Error al crear el Gasto de Explotación" }, { status: 500 })
  }
}
