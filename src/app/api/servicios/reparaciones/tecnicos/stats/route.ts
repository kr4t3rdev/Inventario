import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet } from "@/lib/auth-middleware"

export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const dateFilter: any = {}
    if (startDate && endDate) {
      dateFilter.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const tecnicos = await prisma.empleado.findMany({
      where: {
        OR: [
          { cargo: { contains: "Técnico" } },
          { ordenesAsignadas: { some: {} } }
        ]
      },
      include: {
        ordenesAsignadas: {
          where: dateFilter,
          select: {
            id: true,
            estado: true,
            total: true,
            items: {
              select: { precio: true }
            }
          }
        }
      }
    })

    const stats = tecnicos.map((tecnico: { ordenesAsignadas: any[]; empleadoId: string; nombre: string; apellido: string; cargo: string }) => {
      const totalOrdenes = tecnico.ordenesAsignadas.length
      const ordenesCompletadas = tecnico.ordenesAsignadas.filter((o: { estado: string }) => 
        o.estado === 'TERMINADO' || o.estado === 'ENTREGADO'
      ).length
      
      const totalGenerado = tecnico.ordenesAsignadas.reduce((acc: number, curr: { total: number }) => acc + Number(curr.total), 0)
      
      const manoDeObraGenerada = tecnico.ordenesAsignadas.reduce((acc: number, curr: { items: any[] }) => {
        const totalItems = curr.items.reduce((sum: number, item: { precio: number }) => sum + Number(item.precio), 0)
        return acc + totalItems
      }, 0)

      return {
        id: tecnico.empleadoId,
        nombre: `${tecnico.nombre} ${tecnico.apellido}`,
        cargo: tecnico.cargo,
        totalOrdenes,
        ordenesCompletadas,
        tasaCompletado: totalOrdenes > 0 ? (ordenesCompletadas / totalOrdenes) * 100 : 0,
        totalGenerado,
        manoDeObraGenerada,
        // Comisión estimada (ej. 30% de mano de obra - esto podría ser configurable)
        comisionEstimada: manoDeObraGenerada * 0.3
      }
    })

    return NextResponse.json(stats)
  } catch (error) {
    console.error("Error al obtener estadísticas de técnicos:", error)
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 })
  }
})
