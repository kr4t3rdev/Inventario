import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/lib/auth-middleware"
import { z } from "zod"

// Schema para actualizar serie de facturación
const UpdateSerieSchema = z.object({
  prefijo: z.string().min(1).max(10).optional(),
  descripcion: z.string().min(1).optional(),
  activa: z.boolean().optional(),
  esPorDefecto: z.boolean().optional(),
})

/**
 * @description Obtener una serie de facturación específica por ID
 */
export const GET = withAuth(async (request: NextRequest, context: any, user: any) => {
  try {
    const { id } = context.params

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
})

/**
 * @description Actualizar una serie de facturación
 */
export const PUT = withAuth(async (request: NextRequest, context: any, user: any) => {
  try {
    const { id } = context.params
    const body = await request.json()
    const validatedData = UpdateSerieSchema.parse(body)

    // Verificar que la serie existe
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

    // Validaciones adicionales
    if (validatedData.prefijo && validatedData.prefijo !== serieExistente.prefijo) {
      // Verificar que el nuevo prefijo no esté en uso
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

    // Si se marca como por defecto, quitar el anterior por defecto
    if (validatedData.esPorDefecto === true) {
      await prisma.serieFacturacion.updateMany({
        where: { esPorDefecto: true, serieId: { not: id } },
        data: { esPorDefecto: false },
      })
    }

    // Si se desactiva una serie que tiene facturas, no permitir
    if (validatedData.activa === false && serieExistente._count.facturas > 0) {
      return NextResponse.json(
        { error: "No se puede desactivar una serie que ya tiene facturas generadas" },
        { status: 400 }
      )
    }

    // Actualizar la serie
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
})

/**
 * @description Eliminar una serie de facturación
 */
export const DELETE = withAuth(async (request: NextRequest, context: any, user: any) => {
  try {
    const { id } = context.params

    // Verificar que la serie existe
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

    // Verificar que no tiene facturas asociadas
    if (serieExistente._count.facturas > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar una serie que ya tiene facturas generadas" },
        { status: 400 }
      )
    }

    // No permitir eliminar la serie por defecto si es la única activa
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

    // Eliminar la serie
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
})