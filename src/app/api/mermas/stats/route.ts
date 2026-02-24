import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    // Obtener total de mermas
    const totalMermas = await prisma.merma.count()

    // Obtener mermas por mes (últimos 6 meses)
    const fechaInicio = new Date()
    fechaInicio.setMonth(fechaInicio.getMonth() - 6)

    const mermasPorMes = await prisma.$queryRaw<
      { mes: Date; total: number }[]
    >`
      SELECT 
        DATE_TRUNC('month', "fecha") as mes,
        SUM("cantidad") as total
      FROM "Merma"
      WHERE "fecha" >= ${fechaInicio}
      GROUP BY DATE_TRUNC('month', "fecha")
      ORDER BY mes ASC
    `

    return NextResponse.json({
      totalMermas,
      mermasPorMes: mermasPorMes.map((item: { mes: Date; total: number }) => ({
        mes: new Date(item.mes).toISOString().slice(0, 7),
        total: Number(item.total),
      })),
    })
  } catch (error) {
    console.error("Error al obtener estadísticas de mermas:", error)
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 })
  }
}
