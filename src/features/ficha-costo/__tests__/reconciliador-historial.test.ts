import { describe, it, expect } from 'vitest'
import {
  reconciliarHistorial,
  type ItemCompraMaterializado,
} from '../lib/reconciliador-historial'

const FECHA_FIJA = new Date('2026-06-20T12:00:00Z')

function item(
  overrides: Partial<ItemCompraMaterializado> = {},
): ItemCompraMaterializado {
  return {
    compraDocumentoItemId: 'i-1',
    productoId: 'p-1',
    fecha: new Date('2026-01-15'),
    proveedorId: 'prov-1',
    proveedorNombre: 'Proveedor A',
    cantidad: 10,
    precioUnitario: 100,
    totalLinea: 1000,
    compraDocumentoId: 'doc-1',
    ...overrides,
  }
}

describe('reconciliarHistorial', () => {
  it('marca item en borde de ventana como enVentanaCPP true (inclusivo)', () => {
    // Arrange: item a 364 días de la referencia
    const fechaItem = new Date('2025-06-21T12:00:00Z') // 364 días antes de FECHA_FIJA
    const items = [item({ fecha: fechaItem })]

    // Act
    const result = reconciliarHistorial(items, {
      ventanaMeses: 12,
      fechaReferencia: FECHA_FIJA,
    })

    // Assert
    expect(result.items[0].enVentanaCPP).toBe(true)
  })

  it('marca item fuera de ventana (367 días) como enVentanaCPP false', () => {
    // Arrange: item a 367 días de la referencia
    const fechaItem = new Date('2025-06-18T12:00:00Z') // 367 días antes
    const items = [item({ fecha: fechaItem })]

    // Act
    const result = reconciliarHistorial(items, {
      ventanaMeses: 12,
      fechaReferencia: FECHA_FIJA,
    })

    // Assert
    expect(result.items[0].enVentanaCPP).toBe(false)
  })

  it('usa meses calendario exactos en años bisiestos', () => {
    const fechaReferencia = new Date('2025-03-01T12:00:00Z')
    const fechaItem = new Date('2024-02-29T12:00:00Z')

    const result = reconciliarHistorial([item({ fecha: fechaItem })], {
      ventanaMeses: 12,
      fechaReferencia,
    })

    expect(result.items[0].enVentanaCPP).toBe(false)
  })

  it('marca item dentro de ventana (30 días) como enVentanaCPP true', () => {
    // Arrange
    const fechaItem = new Date('2026-05-21T12:00:00Z') // 30 días antes
    const items = [item({ fecha: fechaItem })]

    // Act
    const result = reconciliarHistorial(items, {
      ventanaMeses: 12,
      fechaReferencia: FECHA_FIJA,
    })

    // Assert
    expect(result.items[0].enVentanaCPP).toBe(true)
  })

  it('usa new Date() como fechaReferencia por defecto', () => {
    // Arrange: item reciente
    const items = [item({ fecha: new Date() })]

    // Act: sin pasar fechaReferencia
    const result = reconciliarHistorial(items, { ventanaMeses: 12 })

    // Assert: el item está en ventana (recién creado)
    expect(result.items[0].enVentanaCPP).toBe(true)
  })

  it('prorratea igualitariamente cuando hay 3 items en el mismo documento', () => {
    // Arrange: 3 items del mismo doc, gasto 300
    const items = [
      item({ compraDocumentoItemId: 'i-1', cantidad: 10, compraDocumentoId: 'doc-1' }),
      item({ compraDocumentoItemId: 'i-2', cantidad: 10, compraDocumentoId: 'doc-1' }),
      item({ compraDocumentoItemId: 'i-3', cantidad: 10, compraDocumentoId: 'doc-1' }),
    ]
    const gastos = new Map([['doc-1', 300]])

    // Act
    const result = reconciliarHistorial(items, {
      ventanaMeses: 12,
      fechaReferencia: FECHA_FIJA,
      gastosPorDocumento: gastos,
    })

    // Assert: cada item recibe 100
    expect(result.items[0].gastoProporcional).toBe(100)
    expect(result.items[1].gastoProporcional).toBe(100)
    expect(result.items[2].gastoProporcional).toBe(100)
  })

  it('prorratea desigualmente según cantidad', () => {
    // Arrange: 2 items, cant 10 y 20, gasto 300
    const items = [
      item({ compraDocumentoItemId: 'i-1', cantidad: 10, compraDocumentoId: 'doc-1' }),
      item({ compraDocumentoItemId: 'i-2', cantidad: 20, compraDocumentoId: 'doc-1' }),
    ]
    const gastos = new Map([['doc-1', 300]])

    // Act
    const result = reconciliarHistorial(items, {
      ventanaMeses: 12,
      fechaReferencia: FECHA_FIJA,
      gastosPorDocumento: gastos,
    })

    // Assert: 10/30 * 300 = 100, 20/30 * 300 = 200
    expect(result.items[0].gastoProporcional).toBeCloseTo(100, 2)
    expect(result.items[1].gastoProporcional).toBeCloseTo(200, 2)
  })

  it('asigna gastoProporcional 0 cuando no hay gastosPorDocumento', () => {
    // Arrange: item sin gastos
    const items = [item()]

    // Act
    const result = reconciliarHistorial(items, {
      ventanaMeses: 12,
      fechaReferencia: FECHA_FIJA,
    })

    // Assert
    expect(result.items[0].gastoProporcional).toBe(0)
  })

  it('asigna gastoProporcional 0 cuando el documento no está en el mapa', () => {
    // Arrange: item en doc-1, pero mapa solo tiene doc-2
    const items = [item({ compraDocumentoId: 'doc-1' })]
    const gastos = new Map([['doc-2', 300]])

    // Act
    const result = reconciliarHistorial(items, {
      ventanaMeses: 12,
      fechaReferencia: FECHA_FIJA,
      gastosPorDocumento: gastos,
    })

    // Assert
    expect(result.items[0].gastoProporcional).toBe(0)
  })

  it('mantiene invariante: suma gastoProporcional por doc = gasto total', () => {
    // Arrange: 3 docs, cada uno con 2 items
    const items = [
      item({ compraDocumentoItemId: 'i-1', cantidad: 5, compraDocumentoId: 'doc-1' }),
      item({ compraDocumentoItemId: 'i-2', cantidad: 5, compraDocumentoId: 'doc-1' }),
      item({ compraDocumentoItemId: 'i-3', cantidad: 10, compraDocumentoId: 'doc-2' }),
      item({ compraDocumentoItemId: 'i-4', cantidad: 10, compraDocumentoId: 'doc-2' }),
    ]
    const gastos = new Map([
      ['doc-1', 100],
      ['doc-2', 400],
    ])

    // Act
    const result = reconciliarHistorial(items, {
      ventanaMeses: 12,
      fechaReferencia: FECHA_FIJA,
      gastosPorDocumento: gastos,
    })

    // Assert
    const sumaDoc1 = result.items
      .filter((it) => it.compraDocumentoId === 'doc-1')
      .reduce((s, it) => s + it.gastoProporcional, 0)
    const sumaDoc2 = result.items
      .filter((it) => it.compraDocumentoId === 'doc-2')
      .reduce((s, it) => s + it.gastoProporcional, 0)
    expect(sumaDoc1).toBeCloseTo(100, 2)
    expect(sumaDoc2).toBeCloseTo(400, 2)
  })

  it('agrupa items por proveedor en el resumen', () => {
    // Arrange: 3 de A, 1 de B
    const items = [
      item({ compraDocumentoItemId: 'i-1', proveedorId: 'A', proveedorNombre: 'Prov A', cantidad: 10, precioUnitario: 100 }),
      item({ compraDocumentoItemId: 'i-2', proveedorId: 'A', proveedorNombre: 'Prov A', cantidad: 5, precioUnitario: 100 }),
      item({ compraDocumentoItemId: 'i-3', proveedorId: 'A', proveedorNombre: 'Prov A', cantidad: 5, precioUnitario: 100 }),
      item({ compraDocumentoItemId: 'i-4', proveedorId: 'B', proveedorNombre: 'Prov B', cantidad: 10, precioUnitario: 200 }),
    ]

    // Act
    const result = reconciliarHistorial(items, {
      ventanaMeses: 12,
      fechaReferencia: FECHA_FIJA,
    })

    // Assert
    expect(result.proveedores).toHaveLength(2)
    const provA = result.proveedores.find((p) => p.proveedorId === 'A')
    const provB = result.proveedores.find((p) => p.proveedorId === 'B')
    expect(provA).toBeDefined()
    expect(provB).toBeDefined()
  })

  it('asigna 100% de participación cuando hay un solo proveedor', () => {
    // Arrange: 3 items del mismo proveedor
    const items = [
      item({ compraDocumentoItemId: 'i-1', cantidad: 10 }),
      item({ compraDocumentoItemId: 'i-2', cantidad: 10 }),
      item({ compraDocumentoItemId: 'i-3', cantidad: 10 }),
    ]

    // Act
    const result = reconciliarHistorial(items, {
      ventanaMeses: 12,
      fechaReferencia: FECHA_FIJA,
    })

    // Assert
    expect(result.proveedores).toHaveLength(1)
    expect(result.proveedores[0].participacionPorcentaje).toBe(100)
  })

  it('excluye items fuera de ventana del resumen por proveedor', () => {
    // Arrange: 1 item en ventana, 1 fuera
    const items = [
      item({ compraDocumentoItemId: 'i-1', proveedorId: 'A', fecha: new Date('2026-05-01') }),
      item({ compraDocumentoItemId: 'i-2', proveedorId: 'A', fecha: new Date('2025-01-01') }),
    ]

    // Act
    const result = reconciliarHistorial(items, {
      ventanaMeses: 12,
      fechaReferencia: FECHA_FIJA,
    })

    // Assert
    expect(result.items).toHaveLength(2)
    expect(result.proveedores).toHaveLength(1)
    expect(result.proveedores[0].cantidadItems).toBe(1)
  })

  it('retorna items y proveedores vacíos para lista vacía', () => {
    // Act
    const result = reconciliarHistorial([], {
      ventanaMeses: 12,
      fechaReferencia: FECHA_FIJA,
    })

    // Assert
    expect(result.items).toEqual([])
    expect(result.proveedores).toEqual([])
  })

  it('no muta los items de entrada', () => {
    // Arrange: item con fecha
    const items = [item({ fecha: new Date('2026-05-01') })]
    const fechaOriginal = items[0].fecha.getTime()
    const cantidadOriginal = items[0].cantidad

    // Act
    reconciliarHistorial(items, {
      ventanaMeses: 12,
      fechaReferencia: FECHA_FIJA,
    })

    // Assert
    expect(items[0].fecha.getTime()).toBe(fechaOriginal)
    expect(items[0].cantidad).toBe(cantidadOriginal)
    expect((items[0] as any).gastoProporcional).toBeUndefined()
    expect((items[0] as any).enVentanaCPP).toBeUndefined()
  })

  it('es determinista: mismas entradas + misma fecha = mismas salidas', () => {
    // Arrange
    const items = [
      item({ compraDocumentoItemId: 'i-1', cantidad: 10 }),
      item({ compraDocumentoItemId: 'i-2', cantidad: 20 }),
    ]
    const options: ReconciliadorOptions = {
      ventanaMeses: 12,
      fechaReferencia: FECHA_FIJA,
      gastosPorDocumento: new Map([['doc-1', 300]]),
    }

    // Act
    const result1 = reconciliarHistorial(items, options)
    const result2 = reconciliarHistorial(items, options)

    // Assert
    expect(result1.items[0].gastoProporcional).toBe(result2.items[0].gastoProporcional)
    expect(result1.items[1].gastoProporcional).toBe(result2.items[1].gastoProporcional)
    expect(result1.proveedores[0].participacionPorcentaje).toBe(
      result2.proveedores[0].participacionPorcentaje,
    )
  })
})
