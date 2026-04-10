import { NextRequest, NextResponse } from 'next/server';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { convertToBase } from '@/lib/utils/unit-converter';
import { calculateCostoUnitarioReceta } from '@/lib/utils/produccion';
import { validateIngredientsUnits } from '@/lib/validators/production-units';
import { z } from 'zod';

const setIngredientesSchema = z.object({
  ingredientes: z.array(
    z.object({
      productoId: z.string(),
      cantidad: z.number().positive(),
      unidadSimbolo: z.string().optional().nullable(),
      desperdicio: z.number().min(0).max(1).default(0),
    })
  ),
});

/**
 * @description Agrega o actualiza ingredientes de una receta de producción.
 * @param {NextRequest} request - Request HTTP con lista de ingredientes.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} Receta con ingredientes actualizados.
 */
export const POST = withAuthPost(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id: recetaId } = await params;
    const { ingredientes } = setIngredientesSchema.parse(await request.json());

    // Verificar que la receta existe y obtener sus datos
    const recetaExistente = await prisma.receta.findUnique({
      where: { recetaId },
      include: { Producto: { select: { precioCosto: true } } },
    });

    if (!recetaExistente) {
      return NextResponse.json({ error: 'Receta no encontrada.' }, { status: 404 });
    }

    // Obtener todos los productos para validar unidades
    const productosInventario = await prisma.producto.findMany({
      where: {
        id: {
          in: ingredientes.map((ing) => ing.productoId),
        },
      },
      select: {
        id: true,
        nombre: true,
        unidadSimbolo: true,
      },
    });

    // Validar compatibilidad de unidades
    const validaciones = validateIngredientsUnits(ingredientes, productosInventario);
    const warnings = validaciones.filter((v) => !v.isValid && v.warning);

    // Eliminar ingredientes existentes
    await prisma.recetaIngrediente.deleteMany({
      where: { recetaId },
    });

    // Agregar nuevos ingredientes
    if (ingredientes.length > 0) {
      await prisma.recetaIngrediente.createMany({
        data: ingredientes.map((ing) => ({
          id: crypto.randomUUID(),
          recetaId,
          productoId: ing.productoId,
          cantidad: ing.cantidad,
          unidadSimbolo: ing.unidadSimbolo ?? null,
          desperdicio: ing.desperdicio,
          updatedAt: new Date(),
        })),
      });
    }

    // Calcular costo unitario usando la función de utilidades
    const precioCostoProductoFinal = recetaExistente.Producto?.precioCosto || 0;

    // Construir array de productos agregados con sus costos
    const productosAgregados = await Promise.all(
      ingredientes.map(async (ing) => {
        const producto = await prisma.producto.findUnique({
          where: { id: ing.productoId },
          select: { id: true, nombre: true, precioCosto: true },
        });

        return {
          productoId: ing.productoId,
          cantidad: convertToBase(ing.cantidad, ing.unidadSimbolo),
          unidadSimbolo: ing.unidadSimbolo,
          producto,
        };
      })
    );

    const costoUnitario = calculateCostoUnitarioReceta(
      precioCostoProductoFinal,
      productosAgregados,
      recetaExistente.rendimiento || 1
    );

    // Actualizar costo unitario de la receta
    const recetaActualizada = await prisma.receta.update({
      where: { recetaId },
      data: { costoUnitario },
      include: {
        Producto: {
          select: {
            id: true,
            nombre: true,
          },
        },
        RecetaIngrediente: {
          select: {
            id: true,
            recetaId: true,
            productoId: true,
            cantidad: true,
            unidadSimbolo: true,
            desperdicio: true,
            createdAt: true,
            updatedAt: true,
            Producto: {
              select: {
                id: true,
                nombre: true,
                precioCosto: true,
                stock: true,
              },
            },
          },
        },
      },
    });

    // Retornar receta + warnings si existen
    const response: any = recetaActualizada;
    if (warnings.length > 0) {
      response.unitWarnings = warnings.map((w) => w.warning);
    }

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos para ingredientes.', issues: error.issues },
        { status: 400 }
      );
    }

    console.error('Error al gestionar ingredientes de receta:', error);
    return NextResponse.json({ error: 'Error al gestionar ingredientes de receta.' }, { status: 500 });
  }
});
