import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet, withAuthPost, withAuth } from "@/lib/auth-middleware"

export const GET = withAuthGet(async (request: NextRequest, context: any, user: any) => {
  try {
    console.log("GET /api/series-facturacion - User:", user?.email, "Role:", user?.role)
    const series = await prisma.serieFacturacion.findMany({
      orderBy: {
        esPorDefecto: "desc",
      },
      include: {
        _count: {
          select: {
            facturas: true,
          },
        },
      },
    })
    console.log("GET /api/series-facturacion - Found", series.length, "series")
    return NextResponse.json(series)
  } catch (error) {
    console.error("Error al obtener series de facturación:", error)
    return NextResponse.json({ error: "Error al obtener series de facturación", details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
})

export const POST = withAuthPost(async (request: NextRequest, context: any, user: any) => {
  try {
    const body = await request.json()
    const { prefijo, descripcion, activa, esPorDefecto } = body
    console.log("POST /api/series-facturacion - User:", user?.email, "Data:", { prefijo, descripcion, activa, esPorDefecto })

    // Validar que el prefijo sea único
    const serieExistente = await prisma.serieFacturacion.findUnique({
      where: { prefijo },
    })

    if (serieExistente) {
      console.log("POST /api/series-facturacion - Prefijo duplicado:", prefijo)
      return NextResponse.json({ error: `Ya existe una serie con el prefijo '${prefijo}'` }, { status: 400 })
    }

    // Si se marca como por defecto, quitar el anterior por defecto
    if (esPorDefecto) {
      console.log("POST /api/series-facturacion - Marcando como por defecto, eliminando anteriores")
      await prisma.serieFacturacion.updateMany({
        where: { esPorDefecto: true },
        data: { esPorDefecto: false },
      })
    }

    const serie = await prisma.serieFacturacion.create({
      data: {
        prefijo,
        descripcion,
        activa: activa ?? true,
        esPorDefecto: esPorDefecto ?? false,
        consecutivo: 1,
      },
    })

    console.log("POST /api/series-facturacion - Serie creada:", serie.serieId)
    return NextResponse.json(serie)
  } catch (error) {
    console.error("Error al crear serie de facturación:", error)
    return NextResponse.json({ error: "Error al crear serie de facturación", details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
})