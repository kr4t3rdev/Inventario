import { describe, expect, it } from 'vitest'

/**
 * Test para la lógica de filtrado del ProductoSelector en transferencias-form.
 * La condición: if (p.productoPadreId) return false
 * debe excluir productos hijos de compuestos del selector de transferencias.
 */
describe('TransferenciasForm ProductoSelector - filtrado de productos hijos', () => {
  /**
   * Replica la lógica de filteredProducts del ProductoSelector:
   * - Siempre muestra producto seleccionado
   * - Excluye hijos (productoPadreId)
   * - Oculta sin stock salvo `showOutOfStock`
   * - Filtra por query de búsqueda
   */
  function filterTransferProducts(
    productos: any[],
    options: {
      selectedId?: string
      query?: string
      showOutOfStock?: boolean
    } = {},
  ) {
    const { selectedId, query = '', showOutOfStock = false } = options
    return productos.filter((p) => {
      const stock = p.stockUbicacion ?? p.stock ?? 0
      const matchesQuery = query
        ? p.nombre.toLowerCase().includes(query.toLowerCase())
        : true

      if (p.id === selectedId) return true
      if (p.productoPadreId) return false
      if (!showOutOfStock && stock <= 0) return false

      return matchesQuery
    })
  }

  const mockProducts = [
    { id: 'pack-1', nombre: 'Pack Refresco x24', stock: 10, productoPadreId: null },
    { id: 'hijo-1', nombre: 'Refresco Unidad', stock: 240, productoPadreId: 'pack-1' },
    { id: 'simple-1', nombre: 'Galletas', stock: 5, productoPadreId: null },
    { id: 'sin-stock', nombre: 'Agotado', stock: 0, productoPadreId: null },
  ]

  it('excluye productos con productoPadreId', () => {
    const result = filterTransferProducts(mockProducts)

    expect(result.map((p) => p.id)).toEqual(['pack-1', 'simple-1'])
    expect(result.find((p) => p.id === 'hijo-1')).toBeUndefined()
  })

  it('excluye productos sin stock cuando showOutOfStock=false', () => {
    const result = filterTransferProducts(mockProducts, { showOutOfStock: false })

    expect(result.find((p) => p.id === 'sin-stock')).toBeUndefined()
  })

  it('incluye productos sin stock cuando showOutOfStock=true (pero sigue excluyendo hijos)', () => {
    const result = filterTransferProducts(mockProducts, { showOutOfStock: true })

    expect(result.map((p) => p.id)).toEqual(['pack-1', 'simple-1', 'sin-stock'])
    expect(result.find((p) => p.id === 'hijo-1')).toBeUndefined()
  })

  it('siempre muestra el producto seleccionado aunque sea hijo', () => {
    const result = filterTransferProducts(mockProducts, { selectedId: 'hijo-1' })

    expect(result.find((p) => p.id === 'hijo-1')).toBeDefined()
  })

  it('filtra por query de búsqueda respetando exclusión de hijos', () => {
    const result = filterTransferProducts(mockProducts, { query: 'Refresco', showOutOfStock: true })

    // Solo el pack aparece (no el hijo)
    expect(result.map((p) => p.id)).toEqual(['pack-1'])
  })
})
