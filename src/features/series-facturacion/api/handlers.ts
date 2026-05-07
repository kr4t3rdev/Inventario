import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireTenant } from "@/lib/services/tenant-scope"
import type { AuthenticatedUser } from "@/lib/auth-middleware"
import { z } from "zod"

const UpdateSerieSchema = z.object({
  prefijo: z.string().min(1).max(10).optional(),
  descripcion: z.string().min(1).optional(),
  activa: z.boolean().optional(),
  esPorDefecto: z.boolean().optional(),
})

/**
 * @description Obtener todas las series de facturación
 */
export async function getSeriesFacturacionHandler(_request: NextRequest, _context: any, user: AuthenticatedUser) {
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
}

/**
 * @description Crear una serie de facturación
 */
export async function createSerieFacturacionHandler(request: NextRequest, _context: any, user: AuthenticatedUser) {
  try {
    const tenantId = requireTenant(user);
    const body = await request.json()
    const { prefijo, descripcion, activa, esPorDefecto } = body
    console.log("POST /api/series-facturacion - User:", user?.email, "Data:", { prefijo, descripcion, activa, esPorDefecto })

    const serieExistente = await prisma.serieFacturacion.findUnique({
      where: { prefijo },
    })

    if (serieExistente) {
      console.log("POST /api/series-facturacion - Prefijo duplicado:", prefijo)
      return NextResponse.json({ error: `Ya existe una serie con el prefijo '${prefijo}'` }, { status: 400 })
    }

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
}

/**
 * @description Obtener una serie de facturación específica por ID
 */
export async function getSerieFacturacionByIdHandler(request: NextRequest, context: any, user: any) {
  try {
    const { id } = await context.params

    const serie = await prisma.serieFacturacion.findUnique({
      where: { serieId: id },
      include: {
        _count: {
          select: {
            facturas: true,
          },
        },
      },
    })

    if (!serie) {
      return NextResponse.json(
        { error: "Serie de facturación no encontrada" },
        { status: 404 }
      )
    }

    return NextResponse.json(serie)
  } catch (error) {
    console.error("Error al obtener serie de facturación:", error)
    return NextResponse.json(
      { error: "Error al obtener serie de facturación" },
      { status: 500 }
    )
  }
}

/**
 * @description Actualizar una serie de facturación
 */
export async function updateSerieFacturacionHandler(request: NextRequest, context: any, user: any) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const validatedData = UpdateSerieSchema.parse(body)

    const serieExistente = await prisma.serieFacturacion.findUnique({
      where: { serieId: id },
      include: {
        _count: {
          select: {
            facturas: true,
          },
        },
      },
    })

    if (!serieExistente) {
      return NextResponse.json(
        { error: "Serie de facturación no encontrada" },
        { status: 404 }
      )
    }

    if (validatedData.prefijo && validatedData.prefijo !== serieExistente.prefijo) {
      const prefijoExistente = await prisma.serieFacturacion.findUnique({
        where: { prefijo: validatedData.prefijo },
      })
      if (prefijoExistente) {
        return NextResponse.json(
          { error: `Ya existe una serie con el prefijo '${validatedData.prefijo}'` },
          { status: 400 }
        )
      }
    }

    if (validatedData.esPorDefecto === true) {
      await prisma.serieFacturacion.updateMany({
        where: { esPorDefecto: true, serieId: { not: id } },
        data: { esPorDefecto: false },
      })
    }

    if (validatedData.activa === false && serieExistente._count.facturas > 0) {
      return NextResponse.json(
        { error: "No se puede desactivar una serie que ya tiene facturas generadas" },
        { status: 400 }
      )
    }

    const serieActualizada = await prisma.serieFacturacion.update({
      where: { serieId: id },
      data: {
        prefijo: validatedData.prefijo,
        descripcion: validatedData.descripcion,
        activa: validatedData.activa,
        esPorDefecto: validatedData.esPorDefecto,
      },
    })

    return NextResponse.json(serieActualizada)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Error de validación", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error al actualizar serie de facturación:", error)
    return NextResponse.json(
      { error: "Error al actualizar serie de facturación" },
      { status: 500 }
    )
  }
}

/**
 * @description Eliminar una serie de facturación
 */
export async function deleteSerieFacturacionHandler(request: NextRequest, context: any, user: any) {
  try {
    const { id } = await context.params

    const serieExistente = await prisma.serieFacturacion.findUnique({
      where: { serieId: id },
      include: {
        _count: {
          select: {
            facturas: true,
          },
        },
      },
    })

    if (!serieExistente) {
      return NextResponse.json(
        { error: "Serie de facturación no encontrada" },
        { status: 404 }
      )
    }

    if (serieExistente._count.facturas > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar una serie que ya tiene facturas generadas" },
        { status: 400 }
      )
    }

    if (serieExistente.esPorDefecto) {
      const seriesActivas = await prisma.serieFacturacion.count({
        where: { activa: true, serieId: { not: id } },
      })
      if (seriesActivas === 0) {
        return NextResponse.json(
          { error: "No se puede eliminar la única serie activa por defecto" },
          { status: 400 }
        )
      }
    }

    await prisma.serieFacturacion.delete({
      where: { serieId: id },
    })

    return NextResponse.json({ success: true, message: "Serie eliminada exitosamente" })
  } catch (error) {
    console.error("Error al eliminar serie de facturación:", error)
    return NextResponse.json(
      { error: "Error al eliminar serie de facturación" },
      { status: 500 }
    )
  }
}
