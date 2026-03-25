/**
 * @description Datos mínimos para representar un producto en reportes/listados.
 */
export interface ProductDisplayInput {
  id?: string | null;
  nombre?: string | null;
  codigoInterno?: string | null;
}

/**
 * @description Obtiene el identificador visible del producto priorizando código interno.
 * @param {ProductDisplayInput} product - Datos base del producto.
 * @returns {string} Código interno, nombre o id como fallback.
 */
export function getProductDisplayIdentifier(product: ProductDisplayInput): string {
  const codigo = typeof product.codigoInterno === 'string' ? product.codigoInterno.trim() : '';
  if (codigo) return codigo;

  const nombre = typeof product.nombre === 'string' ? product.nombre.trim() : '';
  if (nombre) return nombre;

  const id = typeof product.id === 'string' ? product.id.trim() : '';
  if (id) return id;

  return 'Sin identificar';
}

