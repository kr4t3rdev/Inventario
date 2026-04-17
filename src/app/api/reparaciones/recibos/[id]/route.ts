import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet } from "@/lib/auth-middleware"

// GET: Obtener recibo por ID
export const GET = withAuthGet(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params

    const recibo = await prisma.ordenReparacion.findUnique({
      where: { id },
      include: {
        cliente: true,
        equipoTipo: true,
        equipos: {
          include: {
            equipoTipo: true
          }
        }
      }
    })

    if (!recibo) {
      return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 })
    }

    return NextResponse.json(recibo)
  } catch (error) {
    console.error("Error al obtener recibo:", error)
    return NextResponse.json({ error: "Error al obtener recibo" }, { status: 500 })
  }
})
