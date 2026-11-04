import { NextRequest, NextResponse } from 'next/server';
import { withAuthPost, withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { convertToBase } from '@/lib/utils/unit-converter';
import { calculateCostoUnitarioReceta } from '@/lib/utils/produccion';
import { validateAndNormalizeIngredientUnit } from '@/lib/validators/production-units';
import type { UnitError, UnitNormalization } from '@/lib/validators/production-units';
import { ActionError } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { BomError, validateBomAcyclic, type BomRecipe } from '@/features/produccion/services/bom';
import { z } from 'zod';

const ingredientSchema = z.object({
  productoId: z.string().min(1).optional(),
  recetaIngredienteId: z.string().min(1).optional(),
  cantidad: z.number().positive(),
  unidadSimbolo: z.string().optional().nullable(),
  desperdicio: z.number().min(0).max(1).default(0),
}).refine((ingredient) => Boolean(ingredient.productoId) !== Boolean(ingredient.recetaIngredienteId), {
  message: 'Cada ingrediente debe apuntar a un producto o a una subreceta, pero no a ambos.',
});

const setIngredientesSchema = z.object({
  ingredientes: z.array(ingredientSchema),
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
export const POST = withAuthPost(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user: AuthenticatedUser,
) => {
  try {
    const { id: recetaId } = await params;
    const { ingredientes } = setIngredientesSchema.parse(await request.json());
    const tenantId = requireTenant(user);

    // Verificar que la receta existe
    const recetaExistente = await prisma.receta.findUnique({
      where: { recetaId },
      include: { Producto: { select: { precioCosto: true } } },
    });

    if (!recetaExistente || recetaExistente.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Receta no encontrada.' }, { status: 404 });
    }

    // CRITICAL FIX #1: Fetch ALL product data in ONE query (no N+1 + race condition)
    const productoIds = ingredientes.flatMap((ingredient) =>
      ingredient.productoId ? [ingredient.productoId] : [],
    );
    const productosInventarioRaw = await prisma.producto.findMany({
      where: {
        tenantId,
        id: {
          in: productoIds,
        },
      },
      select: {
        id: true,
        nombre: true,
        precioCosto: true, // Include cost data to avoid re-fetching
        unidad: { select: { simbolo: true, dimension: true } },
        unidadesConversion: {
          where: { tenantId: recetaExistente.tenantId },
          select: {
            factorAStock: true,
            unidad: { select: { simbolo: true, dimension: true } },
          },
        },
      },
    });

    const productosInventario = productosInventarioRaw.map((p) => ({
      ...p,
      unidadSimbolo: p.unidad?.simbolo ?? null,
      unidadDimension: p.unidad?.dimension ?? null,
      unidadesConversion: (p.unidadesConversion ?? []).map((conversion) => ({
        factorAStock: conversion.factorAStock.toString(),
        unidad: conversion.unidad,
      })),
    }));

    const usaConversionPorProducto = ingredientes.some((ingrediente) => {
      if (!ingrediente.productoId) return false;
      const producto = productosInventario.find((item) => item.id === ingrediente.productoId);
      return producto?.unidadesConversion.some(
        (conversion) => conversion.unidad.simbolo.trim().toLowerCase() ===
          ingrediente.unidadSimbolo?.trim().toLowerCase(),
      ) ?? false;
    });
    if (usaConversionPorProducto) {
      requireFeature(user, 'unidades', 'conversiones de unidades en producción');
    }

    // CRITICAL FIX #2: Validate that ALL products exist before proceeding
    const ingredientesIds = productoIds;
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
      if (!ing.productoId) {
        return {
          isValid: true as const,
          normalizedCantidad: ing.cantidad,
          normalizedUnidadSimbolo: ing.unidadSimbolo ?? null,
          normalization: null,
        };
      }
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

      return validateAndNormalizeIngredientUnit(
        { ...ing, productoId: ing.productoId },
        producto,
      ) as IngredientValidationSuccess;
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
      const recipesFromTenant = await tx.receta.findMany({
        where: { tenantId },
        include: { RecetaIngrediente: true },
      });
      const recipesById = new Map(recipesFromTenant.map((recipe) => [recipe.recetaId, recipe]));
      const graph: BomRecipe[] = recipesFromTenant.map((recipe) => ({
        recetaId: recipe.recetaId,
        productoId: recipe.productoId,
        rendimiento: recipe.rendimiento,
        ingredientes: recipe.RecetaIngrediente.flatMap<BomRecipe['ingredientes'][number]>((ingredient) => {
          if (ingredient.recetaIngredienteId) {
            return [{
              recetaIngredienteId: ingredient.recetaIngredienteId,
              cantidad: ingredient.cantidad,
              desperdicio: ingredient.desperdicio,
            }];
          }
          if (ingredient.productoId) {
            return [{
              productoId: ingredient.productoId,
              cantidad: ingredient.cantidad,
              desperdicio: ingredient.desperdicio,
            }];
          }
          return [];
        }),
      }));
      const graphWithCurrentRecipe = graph.some((recipe) => recipe.recetaId === recetaId)
        ? graph
        : [...graph, {
            recetaId,
            productoId: recetaExistente.productoId,
            rendimiento: recetaExistente.rendimiento,
            ingredientes: [],
          }];
      const proposedGraph = graphWithCurrentRecipe.map((recipe) => recipe.recetaId === recetaId
        ? {
            ...recipe,
            ingredientes: ingredientes.map((ingredient) => ingredient.productoId
              ? {
                  productoId: ingredient.productoId,
                  cantidad: ingredient.cantidad,
                  desperdicio: ingredient.desperdicio,
                }
              : {
                  recetaIngredienteId: ingredient.recetaIngredienteId!,
                  cantidad: ingredient.cantidad,
                  desperdicio: ingredient.desperdicio,
                }),
          }
        : recipe);
      validateBomAcyclic(proposedGraph);

      const nestedOutputProductIds = ingredientes
        .flatMap((ingredient) => ingredient.recetaIngredienteId
          ? [recipesById.get(ingredient.recetaIngredienteId)?.productoId].filter(
              (productId): productId is string => Boolean(productId),
            )
          : []);
      const nestedOutputProducts = await tx.producto.findMany({
        where: { tenantId, id: { in: nestedOutputProductIds } },
        select: { id: true },
      });
      const nestedOutputProductIdsInTenant = new Set(nestedOutputProducts.map((product) => product.id));

      const ingredientesPersistidos = ingredientes.map((ingredient) => {
        if (ingredient.productoId) {
          return { ...ingredient, productoId: ingredient.productoId };
        }
        const subrecipe = recipesById.get(ingredient.recetaIngredienteId!);
        if (!subrecipe?.productoId || !nestedOutputProductIdsInTenant.has(subrecipe.productoId)) {
          throw new BomError(
            `La subreceta ${ingredient.recetaIngredienteId} debe tener un producto final del mismo tenant`,
            'BOM_RECIPE_NOT_FOUND',
          );
        }
        return { ...ingredient, productoId: subrecipe.productoId };
      });

      // Step 1: Delete existing ingredients
      await tx.recetaIngrediente.deleteMany({
        where: { recetaId, tenantId },
      });

      // Step 2: Create new ingredients
      if (ingredientes.length > 0) {
        await tx.recetaIngrediente.createMany({
          data: ingredientesPersistidos.map((ing, index) => ({
            id: crypto.randomUUID(),
            recetaId,
            tenantId,
            productoId: ing.productoId,
            recetaIngredienteId: ing.recetaIngredienteId ?? null,
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
        const producto = ing.productoId
          ? productosInventario.find((p) => p.id === ing.productoId)
          : null;
        const subreceta = ing.recetaIngredienteId
          ? recipesFromTenant.find((recipe) => recipe.recetaId === ing.recetaIngredienteId)
          : null;
        // CRITICAL FIX #4: Null check (guaranteed to exist after validation above, but defensive)
        if (!producto && !subreceta) {
          throw new Error(`Producto ${ing.productoId} no encontrado (inconsistencia de datos)`);
        }

        const normalizedIngrediente = validNormalizedIngredientes[index];

        return {
          productoId: producto?.id ?? subreceta?.productoId ?? subreceta?.recetaId ?? '',
          cantidad: convertToBase(
            normalizedIngrediente.normalizedCantidad,
            normalizedIngrediente.normalizedUnidadSimbolo
          ),
          unidadSimbolo: normalizedIngrediente.normalizedUnidadSimbolo,
          producto: producto
            ? { id: producto.id, nombre: producto.nombre, precioCosto: producto.precioCosto }
            : {
                id: subreceta!.productoId ?? subreceta!.recetaId,
                nombre: subreceta!.nombre,
                precioCosto: subreceta!.costoUnitario,
              },
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
              recetaIngredienteId: true,
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
    }, { isolationLevel: 'Serializable' });

    // Return recipe + normalization info if any exist
    const response: any = recetaActualizada;
    if (unitNormalizations.length > 0) {
      response.unitNormalizations = unitNormalizations;
    }

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof BomError) {
      return NextResponse.json({ error: error.message, code: error.code, path: error.path }, { status: 400 });
    }
    if (error instanceof ActionError && error.code === 'FEATURE_NOT_AVAILABLE') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
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

/**
 * @description Elimina un ingrediente específico de una receta y recalcula el costo unitario.
 * @param {NextRequest} request - Request HTTP con productoId como query param.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} Receta actualizada.
 */
export const DELETE = withAuth(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id: recetaId } = await params;
    const productoId = request.nextUrl.searchParams.get('productoId');

    if (!productoId) {
      return NextResponse.json({ error: 'productoId es requerido como query param.' }, { status: 400 });
    }

    const recetaActualizada = await prisma.$transaction(async (tx) => {
      const receta = await tx.receta.findUnique({
        where: { recetaId },
        include: {
          Producto: { select: { precioCosto: true } },
          RecetaIngrediente: {
            include: { Producto: { select: { id: true, nombre: true, precioCosto: true } } },
          },
        },
      });

      if (!receta) {
        return null;
      }

      const ingredienteAEliminar = receta.RecetaIngrediente.find(
        (ing) => ing.productoId === productoId
      );

      if (!ingredienteAEliminar) {
        throw new Error('Ingrediente no encontrado en la receta.');
      }

      await tx.recetaIngrediente.delete({
        where: { id: ingredienteAEliminar.id },
      });

      const restantes = receta.RecetaIngrediente.filter(
        (ing) => ing.productoId !== productoId
      );

      const precioCostoProductoFinal = receta.Producto?.precioCosto || 0;
      const productosAgregados = restantes.map((ing) => ({
        productoId: ing.productoId,
        cantidad: ing.cantidad,
        unidadSimbolo: ing.unidadSimbolo,
        producto: { id: ing.Producto?.id ?? '', nombre: ing.Producto?.nombre ?? '', precioCosto: ing.Producto?.precioCosto || 0 },
      }));
      const costoUnitario = calculateCostoUnitarioReceta(
        precioCostoProductoFinal,
        productosAgregados,
        receta.rendimiento || 1
      );

      return tx.receta.update({
        where: { recetaId },
        data: { costoUnitario },
        include: {
          Producto: { select: { id: true, nombre: true } },
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
                select: { id: true, nombre: true, precioCosto: true, stock: true },
              },
            },
          },
        },
      });
    });

    if (!recetaActualizada) {
      return NextResponse.json({ error: 'Receta no encontrada.' }, { status: 404 });
    }

    return NextResponse.json(recetaActualizada);
  } catch (error) {
    if (error instanceof Error && error.message === 'Ingrediente no encontrado en la receta.') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error('Error al eliminar ingrediente de receta:', error);
    return NextResponse.json({ error: 'Error al eliminar ingrediente de receta.' }, { status: 500 });
  }
});
