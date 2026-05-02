import prisma from '@/lib/prisma'

/**
 * @description Reset all products and categories for a specific tenant when EAN-13 is activated.
 * Deletes all tenant's products first (cascade handles related data), then clears the
 * tenant's category tree. Sales history outside catalog scope is preserved.
 * @param {string} tenantId - ID del tenant cuyo catálogo se va a resetear.
 * @returns Promise<{deletedProducts: number, deletedCategorias: number}>
 */
export async function resetProductsForEan13(tenantId: string): Promise<{
  deletedProducts: number
  deletedCategorias: number
}> {
  const productos = await prisma.producto.deleteMany({ where: { tenantId } })

  // Break self-referential FK before bulk-deleting categories
  await prisma.categoria.updateMany({ where: { tenantId }, data: { parentId: null } })
  const categorias = await prisma.categoria.deleteMany({ where: { tenantId } })

  return { deletedProducts: productos.count, deletedCategorias: categorias.count }
}

/**
 * @description Clear EAN-13 codes for a specific tenant when EAN-13 is deactivated.
 * Sets all EAN-13 fields to NULL without deleting products, scoped by tenant.
 * @param {string} tenantId - ID del tenant cuyos códigos se van a limpiar.
 * @returns Promise<{clearedProducts: number}>
 */
export async function clearEan13Codes(tenantId: string): Promise<{
  clearedProducts: number
}> {
  const result = await prisma.producto.updateMany({
    where: { tenantId },
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
