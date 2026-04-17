import { NextRequest, NextResponse } from 'next/server';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { convertToBase } from '@/lib/utils/unit-converter';
import { calculateCostoUnitarioReceta } from '@/lib/utils/produccion';
import { validateAndNormalizeIngredientUnit } from '@/lib/validators/production-units';
import type { UnitError, UnitNormalization } from '@/lib/validators/production-units';
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

type IngredientValidationSuccess = {
  isValid: true;
  normalizedCantidad: number;
  normalizedUnidadSimbolo: string | null;
  normalization: UnitNormalization | null;
};

type IngredientValidationError = {
  isValid: false;
  error: UnitError;
};

type IngredientValidationResult = IngredientValidationSuccess | IngredientValidationError;

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

    // Verificar que la receta existe
    const recetaExistente = await prisma.receta.findUnique({
      where: { recetaId },
      include: { Producto: { select: { precioCosto: true } } },
    });

    if (!recetaExistente) {
      return NextResponse.json({ error: 'Receta no encontrada.' }, { status: 404 });
    }

    // CRITICAL FIX #1: Fetch ALL product data in ONE query (no N+1 + race condition)
    const productosInventarioRaw = await prisma.producto.findMany({
      where: {
        id: {
          in: ingredientes.map((ing) => ing.productoId),
        },
      },
      select: {
        id: true,
        nombre: true,
        precioCosto: true, // Include cost data to avoid re-fetching
        unidad: { select: { simbolo: true } },
      },
    });

    const productosInventario = productosInventarioRaw.map((p) => ({
      ...p,
      unidadSimbolo: p.unidad?.simbolo ?? null,
    }));

    // CRITICAL FIX #2: Validate that ALL products exist before proceeding
    const ingredientesIds = ingredientes.map((ing) => ing.productoId);
    const productosEncontradosIds = new Set(productosInventario.map((p) => p.id));
    const productosFaltantes = ingredientesIds.filter((id) => !productosEncontradosIds.has(id));

    if (productosFaltantes.length > 0) {
      return NextResponse.json(
        {
          error: 'Algunos productos no existen en el catálogo.',
          missing_producto_ids: productosFaltantes,
        },
        { status: 400 }
      );
    }

    const normalizedIngredientes: IngredientValidationResult[] = ingredientes.map((ing) => {
      const producto = productosInventario.find((p) => p.id === ing.productoId);

      if (!producto) {
        return {
          isValid: false as const,
          error: {
            productoId: ing.productoId,
            productoNombre: null,
            providedUnit: ing.unidadSimbolo ?? null,
            canonicalUnit: null,
            reason: 'missing_product' as const,
          },
        };
      }

      return validateAndNormalizeIngredientUnit(ing, producto) as IngredientValidationSuccess;
    });

    const unitErrors = normalizedIngredientes
      .filter((result): result is IngredientValidationError => !result.isValid)
      .map((result) => result.error);

    if (unitErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Hay ingredientes con unidades incompatibles o no normalizables.',
          unitErrors,
        },
        { status: 400 }
      );
    }

    const validNormalizedIngredientes = normalizedIngredientes.filter(
      (result): result is IngredientValidationSuccess => result.isValid
    );

    const unitNormalizations = validNormalizedIngredientes
      .map((result) => result.normalization)
      .filter((normalization): normalization is UnitNormalization => Boolean(normalization));

    // CRITICAL FIX #3: Wrap entire operation in transaction for atomicity
    const recetaActualizada = await prisma.$transaction(async (tx) => {
      // Step 1: Delete existing ingredients
      await tx.recetaIngrediente.deleteMany({
        where: { recetaId },
      });

      // Step 2: Create new ingredients
      if (ingredientes.length > 0) {
        await tx.recetaIngrediente.createMany({
          data: ingredientes.map((ing, index) => ({
            id: crypto.randomUUID(),
            recetaId,
            productoId: ing.productoId,
            cantidad: validNormalizedIngredientes[index].normalizedCantidad,
            unidadSimbolo: validNormalizedIngredientes[index].normalizedUnidadSimbolo,
            desperdicio: ing.desperdicio,
            updatedAt: new Date(),
          })),
        });
      }

      // Step 3: Calculate and update cost (reuse already-fetched productos)
      const precioCostoProductoFinal = recetaExistente.Producto?.precioCosto || 0;

      const productosAgregados = ingredientes.map((ing, index) => {
        const producto = productosInventario.find((p) => p.id === ing.productoId);
        // CRITICAL FIX #4: Null check (guaranteed to exist after validation above, but defensive)
        if (!producto) {
          throw new Error(`Producto ${ing.productoId} no encontrado (inconsistencia de datos)`);
        }

        const normalizedIngrediente = validNormalizedIngredientes[index];

        return {
          productoId: ing.productoId,
          cantidad: convertToBase(
            normalizedIngrediente.normalizedCantidad,
            normalizedIngrediente.normalizedUnidadSimbolo
          ),
          unidadSimbolo: normalizedIngrediente.normalizedUnidadSimbolo,
          producto,
        };
      });

      const costoUnitario = calculateCostoUnitarioReceta(
        precioCostoProductoFinal,
        productosAgregados,
        recetaExistente.rendimiento || 1
      );

      // Update recipe with new cost
      return tx.receta.update({
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
    });

    // Return recipe + normalization info if any exist
    const response: any = recetaActualizada;
    if (unitNormalizations.length > 0) {
      response.unitNormalizations = unitNormalizations;
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
