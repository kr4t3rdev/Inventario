import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet } from "@/lib/auth-middleware"

export const GET = withAuthGet(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams
  const prefijo = searchParams.get("prefijo")

  if (!prefijo) {
    return NextResponse.json({ error: "Prefijo requerido" }, { status: 400 })
  }

  const serie = await prisma.serieFacturacion.findUnique({
    where: { prefijo }
  })

  // Si no existe, empezará en 1
  const nextNumber = serie ? serie.consecutivo : 1

  return NextResponse.json({ 
    nextNumber, 
    prefijo,
    preview: `${prefijo}${nextNumber}` 
  })
})
