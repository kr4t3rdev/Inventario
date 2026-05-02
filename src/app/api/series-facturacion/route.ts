import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet, withAuthPost, withAuth, type AuthenticatedUser } from "@/lib/auth-middleware"
import { requireTenant } from "@/lib/services/tenant-scope"

export const GET = withAuthGet(async (_request: NextRequest, _context: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const series = await prisma.serieFacturacion.findMany({
      where: { tenantId },
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

export const POST = withAuthPost(async (request: NextRequest, _context: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
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
        tenantId,
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