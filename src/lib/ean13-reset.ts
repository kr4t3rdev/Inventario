import prisma from '@/lib/prisma'

/**
 * @description Reset all products and inventory when EAN-13 is activated
 * Deletes all products (cascade handles related data) but preserves sales history
 * @returns Promise<{deletedProducts: number}>
 */
export async function resetProductsForEan13(): Promise<{
  deletedProducts: number
}> {
  const result = await prisma.producto.deleteMany({})
  return { deletedProducts: result.count }
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
