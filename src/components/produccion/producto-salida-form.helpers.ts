export interface ProductoSalidaFormValues {
  nombre: string;
  descripcion?: string;
  codigoInterno?: string;
  categoriaId: string;
  subcategoriaId?: string;
  precioCosto: number;
  precioVenta: number;
  stock: number;
  stockMinimo: number;
  unidadId: string;
  almacenId: string;
  vendorId?: string;
}

export interface ProductoSalidaPayloadContext {
  usaEan13: boolean;
  proveedorCodigo?: string | null;
}

/**
 * @description Construye el payload para crear un producto de salida reutilizando el contrato del catálogo.
 * @param {ProductoSalidaFormValues} values - Valores capturados en el formulario inline.
 * @param {ProductoSalidaPayloadContext} context - Contexto requerido para resolver EAN-13.
 * @returns {Record<string, unknown>} Payload listo para `/api/productos`.
 */
export function buildProductoSalidaPayload(
  values: ProductoSalidaFormValues,
  context: ProductoSalidaPayloadContext
): Record<string, unknown> {
  return {
    nombre: values.nombre.trim(),
    descripcion: values.descripcion?.trim() || '',
    codigoInterno: values.codigoInterno?.trim() || null,
    proveedorCodigo: context.usaEan13 ? context.proveedorCodigo?.trim() || null : null,
    vendorId: values.vendorId?.trim() || null,
    categoriaId: values.categoriaId,
    subcategoriaId: values.subcategoriaId?.trim() || null,
    precioCosto: values.precioCosto,
    precioVenta: values.precioVenta,
    stock: values.stock,
    stockMinimo: values.stockMinimo,
    fotos: [],
    unidadId: values.unidadId,
    almacenId: values.almacenId,
    precios: [],
  };
}

/**
 * @description Normaliza respuestas del catálogo para obtener el producto recién creado.
 * @param {unknown} response - Respuesta devuelta por RTK Query o fetch.
 * @returns {{ id: string; nombre: string }} Producto mínimo utilizable por producción.
 */
export function normalizeCreatedProducto(response: unknown): { id: string; nombre: string } {
  const candidate =
    response && typeof response === 'object' && 'producto' in response
      ? (response as { producto: { id: string; nombre: string } }).producto
      : (response as { id: string; nombre: string });

  return {
    id: candidate.id,
    nombre: candidate.nombre,
  };
}
