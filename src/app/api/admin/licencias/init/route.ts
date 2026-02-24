import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuthPost } from "@/lib/auth-middleware"

export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: any) => {
  if (user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const planes = await prisma.plan.findMany()
  if (planes.length > 0) {
    return NextResponse.json({ message: "Ya existen planes", planes })
  }

  await prisma.plan.createMany({
    data: [
      {
        nombre: "Free",
        descripcion: "Plan gratuito para prueba",
        precio: 0,
        duracionDias: 30,
        maxUsuarios: 1,
        maxAlmacenes: 1,
        maxProductos: 50,
      },
      {
        nombre: "Básico",
        descripcion: "Para pequeños negocios",
        precio: 9.99,
        duracionDias: 30,
        maxUsuarios: 3,
        maxAlmacenes: 2,
        maxProductos: 500,
      },
      {
        nombre: "Profesional",
        descripcion: "Para negocios medianos",
        precio: 29.99,
        duracionDias: 30,
        maxUsuarios: 10,
        maxAlmacenes: 5,
        maxProductos: 2000,
      },
      {
        nombre: "Enterprise",
        descripcion: "Sin límites",
        precio: 99.99,
        duracionDias: 30,
        maxUsuarios: 100,
        maxAlmacenes: 20,
        maxProductos: 100000,
      },
    ],
  })

  const planesCreados = await prisma.plan.findMany()

  return NextResponse.json({
    message: "Planes inicializados",
    planes: planesCreados,
  })
})
