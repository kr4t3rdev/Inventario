import 'server-only';

import { NextResponse } from 'next/server';

import { mapCategoryToSection, mapSubcategoryToSpecific } from '@/lib/category-mapping';
import { prisma } from '@/lib/prisma';
import {
  buildProductBusinessCodeFromSegments,
  type ProductBusinessCodeResult,
  type ProductBusinessCodeSegmentsInput,
} from '@/lib/product-business-code';

/**
 * @description Resuelve taxonomía desde categoría/subcategoría IDs con validación de BD.
 * @param {string | undefined} categoriaId - ID de categoría.
 * @param {string | undefined} subcategoriaId - ID de subcategoría.
 * @returns {{
 *   categoriaId: string;
 *   categoriaNombre: string;
 *   subcategoriaId: string;
 *   subcategoriaNombre: string;
 *   idSeccionCodigo: string;
 *   especificoCodigo: string;
 * } | NextResponse} Contexto de taxonomía o respuesta de error.
 */
export async function resolveTaxonomyContext(
  categoriaId: string | undefined,
  subcategoriaId: string | undefined
): Promise<any> {
  // Validate required fields
  if (!categoriaId) {
    return jsonError('La categoría es requerida', 400);
  }

  if (!subcategoriaId) {
    return jsonError('La subcategoría es requerida', 400);
  }

  // Fetch category/subcategory from DB for validation
  const categoria = await prisma.categoria.findUnique({
    where: { catId: categoriaId },
    select: { catId: true, nombre: true, parentId: true },
  });

  if (!categoria) {
    return jsonError(`Categoría '${categoriaId}' no encontrada`, 404);
  }

  const subcategoria = await prisma.categoria.findUnique({
    where: { catId: subcategoriaId },
    select: { catId: true, nombre: true, parentId: true },
  });

  if (!subcategoria) {
    return jsonError(`Subcategoría '${subcategoriaId}' no encontrada`, 404);
  }

  // Validate subcategory belongs to category
  if (subcategoria.parentId !== categoriaId) {
    return jsonError('La subcategoría debe pertenecer a la categoría seleccionada', 400);
  }

  // Map to EAN-13 segments
  try {
    const idSeccionCodigo = mapCategoryToSection(categoria.nombre);
    const especificoCodigo = mapSubcategoryToSpecific(subcategoria.nombre);

    return {
      categoriaId: categoria.catId,
      categoriaNombre: categoria.nombre,
      subcategoriaId: subcategoria.catId,
      subcategoriaNombre: subcategoria.nombre,
      idSeccionCodigo,
      especificoCodigo,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Error al mapear categoría a código de negocio';
    return jsonError(message, 400);
  }
}

/**
 * @description Valida que un código de negocio sea único en BD.
 * @param {any} tx - Prisma transaction client.
 * @param {string} codigoNegocio - Código a validar.
 * @throws {Error} Si el código ya existe.
 */
export async function ensureBusinessCodeIsUnique(tx: any, codigoNegocio: string): Promise<void> {
  const existing = await tx.producto.findFirst({
    where: { codigoNegocio },
    select: { id: true },
  });

  if (existing) {
    throw new Error(`El código de negocio '${codigoNegocio}' ya está asignado a otro producto`);
  }
}

/**
 * @description Valida que un vendor existe en BD si se proporciona.
 * @param {string | null} vendorId - ID del vendor.
 * @returns {NextResponse | undefined} Respuesta de error o undefined si válido.
 */
export async function validateVendor(vendorId: string | null): Promise<NextResponse | undefined> {
  if (!vendorId) {
    return undefined;
  }

  const vendor = await prisma.vendor.findUnique({
    where: { vendorId: vendorId },
    select: { vendorId: true },
  });

  if (!vendor) {
    return jsonError(`Proveedor '${vendorId}' no encontrado`, 404);
  }

  return undefined;
}

/**
 * @description Construye una respuesta JSON de error consistente.
 * @param {string} message - Mensaje de error.
 * @param {number} status - Código HTTP.
 * @returns {NextResponse} Respuesta de error JSON.
 */
export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * @description Incrementa el surtido en 1, validando que no exceda el límite.
 * @param {string} currentSurtido - Surtido actual (4 dígitos con ceros a la izquierda).
 * @returns {string | null} Nuevo surtido o null si desbordamiento.
 */
export function incrementSurtido(currentSurtido: string): string | null {
  const surtidoNum = parseInt(currentSurtido, 10);
  
  if (surtidoNum >= 9999) {
    return null; // Overflow: no hay más surtidos disponibles
  }
  
  const incremented = surtidoNum + 1;
  return String(incremented).padStart(4, '0');
}

/**
 * @description Intenta generar un código de negocio con retry logic en caso de conflictos.
 * Si el codigoNegocio ya existe, incrementa el surtido y reintenta hasta 3 veces.
 * @param {any} tx - Cliente Prisma o transacción.
 * @param {ProductBusinessCodeSegmentsInput} baseSegments - Segmentos base (con surtido inicial).
 * @param {number} maxAttempts - Máximo número de intentos (default: 3).
 * @returns {Promise<ProductBusinessCodeResult>} Código de negocio único o error.
 */
export async function generateProductCodeWithRetry(
  tx: any,
  baseSegments: ProductBusinessCodeSegmentsInput,
  maxAttempts: number = 3
): Promise<ProductBusinessCodeResult> {
  let currentSegments = { ...baseSegments };
  let lastError: Error | null = null;
  
  for (let attemptNum = 1; attemptNum <= maxAttempts; attemptNum++) {
    try {
      // Genera código con surtido actual
      const generatedCode = buildProductBusinessCodeFromSegments(currentSegments);
      
      // Verifica que sea único
      await ensureBusinessCodeIsUnique(tx, generatedCode.codigoNegocio);
      
      // Éxito: retorna código
      if (attemptNum > 1) {
        console.log(
          `[generateProductCodeWithRetry] Éxito en intento ${attemptNum}: ${generatedCode.codigoNegocio}`
        );
      }
      
      return generatedCode;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Si es el último intento, lanza el error
      if (attemptNum === maxAttempts) {
        console.error(
          `[generateProductCodeWithRetry] Falló después de ${maxAttempts} intentos. Último error: ${lastError.message}`
        );
        throw new Error(
          `No se pudo generar un código EAN-13 único después de ${maxAttempts} intentos. ${lastError.message}`
        );
      }
      
      // Intenta incrementar surtido para el siguiente intento
      const nextSurtido = incrementSurtido(currentSegments.surtidoCodigo);
      
      if (nextSurtido === null) {
        // Surtido desbordado, no hay más intentos posibles
        console.error(
          `[generateProductCodeWithRetry] Surtido alcanzó el límite máximo de 9999`
        );
        throw new Error(
          `Surtido alcanzó el límite máximo (9999) después de ${attemptNum} intentos`
        );
      }
      
      currentSegments.surtidoCodigo = nextSurtido;
      
      console.warn(
        `[generateProductCodeWithRetry] Intento ${attemptNum} conflictó. Reintentando con surtido ${nextSurtido}...`
      );
    }
  }
  
  // Este punto nunca se debería alcanzar, pero por seguridad
  throw lastError || new Error('Error desconocido en generateProductCodeWithRetry');
}
