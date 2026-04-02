import { describe, expect, it } from 'vitest'

/**
 * Test para la lógica de filtrado de productos hijos en CompraProductoForm.
 * La línea: products?.filter((product: any) => !product.productoPadreId)
 * debe excluir productos que son hijos de un producto compuesto.
 */
describe('CompraProductoForm - filtrado de productos hijos', () => {
  const filterCompraProducts = (products: any[]) =>
    products.filter((product: any) => !product.productoPadreId)

  const mockProducts = [
    { id: 'prod-1', nombre: 'Pack Refresco x24', productoPadreId: null },
    { id: 'prod-2', nombre: 'Refresco Unidad', productoPadreId: 'prod-1' },
    { id: 'prod-3', nombre: 'Galletas', productoPadreId: null },
    { id: 'prod-4', nombre: 'Galleta Unidad', productoPadreId: 'prod-3' },
    { id: 'prod-5', nombre: 'Producto Simple', productoPadreId: null },
  ]

  it('excluye productos que tienen productoPadreId (hijos de compuestos)', () => {
    const result = filterCompraProducts(mockProducts)

    expect(result).toHaveLength(3)
    expect(result.map((p) => p.id)).toEqual(['prod-1', 'prod-3', 'prod-5'])
  })

  it('no excluye productos con productoPadreId null o undefined', () => {
    const products = [
      { id: 'a', nombre: 'A', productoPadreId: null },
      { id: 'b', nombre: 'B', productoPadreId: undefined },
      { id: 'c', nombre: 'C' }, // sin la prop
    ]

    const result = filterCompraProducts(products)
    expect(result).toHaveLength(3)
  })

  it('retorna array vacío si todos son hijos', () => {
    const products = [
      { id: 'h1', nombre: 'Hijo 1', productoPadreId: 'padre-1' },
      { id: 'h2', nombre: 'Hijo 2', productoPadreId: 'padre-2' },
    ]

    const result = filterCompraProducts(products)
    expect(result).toHaveLength(0)
  })
})
