import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuthPost } from "@/lib/auth-middleware"

export const POST = withAuthPost(async (request: NextRequest) => {
  const { clave } = await request.json()

  if (!clave) {
    return NextResponse.json({ error: "Clave de licencia requerida" }, { status: 400 })
  }

  const licencia = await prisma.licencia.findUnique({
    where: { clave },
    include: {
      plan: true,
      usuario: { select: { userId: true, name: true, email: true } },
    },
  })

  if (!licencia) {
    return NextResponse.json({ valida: false, error: "Licencia no encontrada" }, { status: 404 })
  }

  if (!licencia.activa) {
    return NextResponse.json({ valida: false, error: "Licencia revocada" })
  }

  const ahora = new Date()
  if (licencia.expiracion < ahora) {
    return NextResponse.json({ valida: false, error: "Licencia expirada" })
  }

  const diasRestantes = Math.ceil(
    (licencia.expiracion.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)
  )

  return NextResponse.json({
    valida: true,
    licencia: {
      licenciaId: licencia.licenciaId,
      clave: licencia.clave,
      plan: licencia.plan,
      inicio: licencia.inicio,
      expiracion: licencia.expiracion,
      diasRestantes,
    },
  })
})
