import {
  generateEan13BusinessCode,
  normalizeEan13Segments,
} from '@/lib/ean13-utils';
import { mapCategoryToSection, mapSubcategoryToSpecific } from '@/lib/category-mapping';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// NOTE: Funciones eliminadas por ser código muerto sin callers:
// - `resolveTaxonomyContext` (consultaba categorías sin tenantId)
// - `validateVendor` (consultaba vendors sin tenantId)
// Si se necesitan, deben recibir tenantId explícitamente y filtrar.

export const DEFAULT_PARENT_PREVIEW_SURTIDO = '0000'
export const DEFAULT_CHILD_PREVIEW_SURTIDO = '0001'

/**
 * @description Payload para generar un código de negocio desde segmentos ya resueltos.
 */
export interface ProductBusinessCodeSegmentsInput {
  proveedorCodigo: string;
  idSeccionCodigo: string;
  especificoCodigo: string;
  surtidoCodigo: string;
}

/**
 * @description Resultado normalizado de un código de negocio de producto.
 */
export interface ProductBusinessCodeResult {
  proveedorCodigo: string;
  idSeccionCodigo: string;
  especificoCodigo: string;
  surtidoCodigo: string;
  dcCodigo: string;
  codigoNegocio: string;
}

/**
 * @description Datos requeridos para resolver segmentos desde nombres de taxonomía.
 */
export interface ProductBusinessCodeTaxonomyInput {
  proveedorCodigo: string;
  categoriaNombre: string;
  subcategoriaNombre: string;
  surtidoCodigo: string;
}

/**
 * @description Campos que el cliente NO puede controlar cuando el servidor es dueño del código.
 */
export interface ServerOwnedCodeFieldsInput {
  idSeccionCodigo?: unknown;
  especificoCodigo?: unknown;
  surtidoCodigo?: unknown;
  codigoNegocioHijo?: unknown;
}

/**
 * @description Normaliza el código de proveedor a 2 dígitos.
 * @param {unknown} value - Valor recibido desde cliente o UI.
 * @returns {string} Código proveedor normalizado.
 */
export function normalizeProveedorCodigo(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('El código de proveedor es requerido');
  }

  const normalizedValue = value.trim();
  if (!/^\d{1,2}$/.test(normalizedValue)) {
    throw new Error('El código de proveedor debe contener 1 o 2 dígitos');
  }

  return normalizedValue.padStart(2, '0');
}

/**
 * @description Resuelve sección y específico a partir de nombres de categoría/subcategoría.
 * @param {string} categoriaNombre - Nombre de la categoría padre.
 * @param {string} subcategoriaNombre - Nombre de la subcategoría.
 * @returns {{ idSeccionCodigo: string; especificoCodigo: string }} Segmentos resueltos.
 */
export function resolveTaxonomySegments(
  categoriaNombre: string,
  subcategoriaNombre: string
): { idSeccionCodigo: string; especificoCodigo: string } {
  return {
    idSeccionCodigo: mapCategoryToSection(categoriaNombre),
    especificoCodigo: mapSubcategoryToSpecific(subcategoriaNombre),
  };
}

/**
 * @description Genera el código completo a partir de segmentos explícitos.
 * @param {ProductBusinessCodeSegmentsInput} input - Segmentos base para el EAN-13.
 * @returns {ProductBusinessCodeResult} Código de negocio completo y segmentos normalizados.
 */
export function buildProductBusinessCodeFromSegments(
  input: ProductBusinessCodeSegmentsInput
): ProductBusinessCodeResult {
  const normalizedSegments = normalizeEan13Segments({
    proveedorCodigo: normalizeProveedorCodigo(input.proveedorCodigo),
    idSeccionCodigo: input.idSeccionCodigo,
    especificoCodigo: input.especificoCodigo,
    surtidoCodigo: input.surtidoCodigo,
  });

  const generatedCode = generateEan13BusinessCode(normalizedSegments);

  return {
    proveedorCodigo: generatedCode.segments.proveedorCodigo,
    idSeccionCodigo: generatedCode.segments.idSeccionCodigo,
    especificoCodigo: generatedCode.segments.especificoCodigo,
    surtidoCodigo: generatedCode.segments.surtidoCodigo,
    dcCodigo: generatedCode.dcCodigo,
    codigoNegocio: generatedCode.codigoNegocio,
  };
}

/**
 * @description Genera un preview de código usando taxonomía resuelta por nombre.
 * @param {ProductBusinessCodeTaxonomyInput} input - Datos base del preview.
 * @returns {ProductBusinessCodeResult} Preview completo del código.
 */
export function buildProductBusinessCodePreview(
  input: ProductBusinessCodeTaxonomyInput
): ProductBusinessCodeResult {
  const resolvedSegments = resolveTaxonomySegments(
    input.categoriaNombre,
    input.subcategoriaNombre
  );

  return buildProductBusinessCodeFromSegments({
    proveedorCodigo: input.proveedorCodigo,
    idSeccionCodigo: resolvedSegments.idSeccionCodigo,
    especificoCodigo: resolvedSegments.especificoCodigo,
    surtidoCodigo: input.surtidoCodigo,
  });
}

/**
 * @description Impide que el cliente envíe segmentos controlados por el servidor.
 * @param {ServerOwnedCodeFieldsInput} input - Campos del payload a validar.
 * @returns {void}
 */
export function assertServerOwnedCodeFields(input: ServerOwnedCodeFieldsInput): void {
  const hasManualParentSegments =
    typeof input.idSeccionCodigo === 'string' && input.idSeccionCodigo.trim() !== '' ||
    typeof input.especificoCodigo === 'string' && input.especificoCodigo.trim() !== '' ||
    typeof input.surtidoCodigo === 'string' && input.surtidoCodigo.trim() !== '';

  if (hasManualParentSegments) {
    throw new Error(
      'Los segmentos del código de negocio se generan automáticamente. No los envíes en la solicitud.'
    );
  }

  if (
    typeof input.codigoNegocioHijo === 'string' &&
    input.codigoNegocioHijo.trim() !== ''
  ) {
    throw new Error(
      'El código de negocio del producto hijo se genera automáticamente. No lo envíes en la solicitud.'
    );
  }
}

/**
 * @description Calcula los precios unitarios del producto hijo compuesto.
 * @param {number} precioCosto - Precio de costo del producto padre.
 * @param {number} precioVenta - Precio de venta del producto padre.
 * @param {number} cantidadEnPack - Cantidad de unidades del pack.
 * @returns {{ precioCostoUnitario: number; precioVentaUnitario: number }} Precios unitarios redondeados.
 */
export function calculateCompoundUnitPrices(
  precioCosto: number,
  precioVenta: number,
  cantidadEnPack: number
): { precioCostoUnitario: number; precioVentaUnitario: number } {
  if (!Number.isFinite(cantidadEnPack) || cantidadEnPack <= 0) {
    throw new Error('La cantidad en pack debe ser mayor a 0 para calcular precios unitarios');
  }

  return {
    precioCostoUnitario: Math.round(precioCosto / cantidadEnPack),
    precioVentaUnitario: Math.round(precioVenta / cantidadEnPack),
  };
}

/**
 * @description Valida que un código de negocio sea único DENTRO DEL TENANT.
 * ⚠️ MULTI-TENANT: codigoNegocio es UNIQUE per tenant en BD, así que
 * sin filtrar por tenantId podríamos matchear un producto de OTRO tenant
 * y bloquear erróneamente la creación.
 * @param {any} tx - Prisma transaction client.
 * @param {string} tenantId - ID del tenant del usuario.
 * @param {string} codigoNegocio - Código a validar.
 * @throws {Error} Si el código ya existe en este tenant.
 */
export async function ensureBusinessCodeIsUnique(tx: any, tenantId: string, codigoNegocio: string): Promise<void> {
  const existing = await tx.producto.findFirst({
    where: { tenantId, codigoNegocio },
    select: { id: true },
  });

  if (existing) {
    throw new Error(`El código de negocio '${codigoNegocio}' ya está asignado a otro producto`);
  }
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
 * Si el codigoNegocio ya existe en el tenant, incrementa el surtido y reintenta hasta 3 veces.
 * @param {any} tx - Cliente Prisma o transacción.
 * @param {string} tenantId - ID del tenant del usuario.
 * @param {ProductBusinessCodeSegmentsInput} baseSegments - Segmentos base (con surtido inicial).
 * @param {number} maxAttempts - Máximo número de intentos (default: 3).
 * @returns {Promise<ProductBusinessCodeResult>} Código de negocio único o error.
 */
export async function generateProductCodeWithRetry(
  tx: any,
  tenantId: string,
  baseSegments: ProductBusinessCodeSegmentsInput,
  maxAttempts: number = 3
): Promise<ProductBusinessCodeResult> {
  let currentSegments = { ...baseSegments };
  let lastError: Error | null = null;
  
  for (let attemptNum = 1; attemptNum <= maxAttempts; attemptNum++) {
    try {
      // Genera código con surtido actual
      const generatedCode = buildProductBusinessCodeFromSegments(currentSegments);
      
      // Verifica que sea único en el tenant
      await ensureBusinessCodeIsUnique(tx, tenantId, generatedCode.codigoNegocio);
      
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
