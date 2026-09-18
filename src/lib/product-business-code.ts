import {
  generateEan13BusinessCode,
  normalizeEan13Segments,
} from '@/lib/ean13-utils';
import { mapCategoryToSection, mapSubcategoryToSpecific } from '@/lib/category-mapping';

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
