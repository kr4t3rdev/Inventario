import prisma from '@/lib/prisma'

/**
 * @description Reset all products and categories when EAN-13 is activated.
 * Deletes all products first (cascade handles related data), then clears the
 * category tree. Sales history is preserved.
 * @returns Promise<{deletedProducts: number, deletedCategorias: number}>
 */
export async function resetProductsForEan13(): Promise<{
  deletedProducts: number
  deletedCategorias: number
}> {
  const productos = await prisma.producto.deleteMany({})

  // Break self-referential FK before bulk-deleting categories
  await prisma.categoria.updateMany({ data: { parentId: null } })
  const categorias = await prisma.categoria.deleteMany({})

  return { deletedProducts: productos.count, deletedCategorias: categorias.count }
}

/**
 * @description Clear EAN-13 codes when EAN-13 is deactivated
 * Sets all EAN-13 fields to NULL without deleting products
 * @returns Promise<{clearedProducts: number}>
 */
export async function clearEan13Codes(): Promise<{
  clearedProducts: number
}> {
  const result = await prisma.producto.updateMany({
    data: {
      codigoNegocio: null,
      proveedorCodigo: null,
      idSeccionCodigo: null,
      especificoCodigo: null,
      surtidoCodigo: null,
      dcCodigo: null,
    },
  })
  return { clearedProducts: result.count }
}
