import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { resetProductsForEan13, clearEan13Codes } from '@/lib/ean13-reset'

describe('EAN-13 Reset Logic', () => {
  const setupTestData = async () => {
    // Create test categoria
    const categoria = await prisma.categoria.create({
      data: {
        nombre: `Test Categoria ${Date.now()}`,
      },
    })

    // Create test almacen
    const almacen = await prisma.almacen.create({
      data: {
        nombre: `Test Almacen ${Date.now()}`,
      },
    })

    // Create test products with EAN-13 codes
    const p1 = await prisma.producto.create({
      data: {
        nombre: 'Test Product 1',
        precioCosto: 100,
        precioVenta: 150,
        stock: 10,
        categoriaId: categoria.catId,
        almacenId: almacen.almacenId,
        codigoNegocio: 'TEST001',
        proveedorCodigo: '01',
        idSeccionCodigo: '02',
        especificoCodigo: '0001',
        surtidoCodigo: '0001',
        dcCodigo: '1',
      },
    })

    const p2 = await prisma.producto.create({
      data: {
        nombre: 'Test Product 2',
        precioCosto: 200,
        precioVenta: 300,
        stock: 5,
        categoriaId: categoria.catId,
        almacenId: almacen.almacenId,
        codigoNegocio: 'TEST002',
        proveedorCodigo: '02',
        idSeccionCodigo: '03',
        especificoCodigo: '0002',
        surtidoCodigo: '0002',
        dcCodigo: '2',
      },
    })

    return { categoria, almacen, p1, p2 }
  }

  const cleanup = async () => {
    try {
      // Cleanup: delete all test products, categorias, and almacenes
      await prisma.producto.deleteMany({})
      await prisma.categoria.deleteMany({})
      await prisma.almacen.deleteMany({})
    } catch (error) {
      // Silently ignore cleanup errors
    }
  }

  afterEach(async () => {
    await cleanup()
  })

  it('should delete all products when resetting for EAN-13 activation', async () => {
    await cleanup()
    await setupTestData()

    const before = await prisma.producto.count()
    expect(before).toBe(2)

    const result = await resetProductsForEan13()

    expect(result.deletedProducts).toBe(2)

    const after = await prisma.producto.count()
    expect(after).toBe(0)
  })

  it('should clear all EAN-13 codes without deleting products', async () => {
    await cleanup()
    await setupTestData()

    const before = await prisma.producto.findMany({
      where: { codigoNegocio: { not: null } },
    })
    expect(before.length).toBe(2)
    expect(before[0].proveedorCodigo).not.toBeNull()
    expect(before[0].idSeccionCodigo).not.toBeNull()

    const result = await clearEan13Codes()

    expect(result.clearedProducts).toBe(2)

    const after = await prisma.producto.findMany({
      where: { codigoNegocio: { not: null } },
    })
    expect(after.length).toBe(0)

    // Verify all EAN-13 fields are null
    const afterAll = await prisma.producto.findMany({})
    expect(afterAll.length).toBe(2) // Products still exist
    afterAll.forEach((p) => {
      expect(p.codigoNegocio).toBeNull()
      expect(p.proveedorCodigo).toBeNull()
      expect(p.idSeccionCodigo).toBeNull()
      expect(p.especificoCodigo).toBeNull()
      expect(p.surtidoCodigo).toBeNull()
      expect(p.dcCodigo).toBeNull()
    })
  })

  it('should return correct deletion count', async () => {
    await cleanup()
    await setupTestData()

    const result = await resetProductsForEan13()
    expect(result.deletedProducts).toBe(2)
    expect(typeof result.deletedProducts).toBe('number')
  })

  it('should return correct cleared count', async () => {
    await cleanup()
    await setupTestData()

    const result = await clearEan13Codes()
    expect(result.clearedProducts).toBe(2)
    expect(typeof result.clearedProducts).toBe('number')
  })

  it('should handle empty database (no products)', async () => {
    await cleanup()

    const resultDelete = await resetProductsForEan13()
    expect(resultDelete.deletedProducts).toBe(0)

    const resultClear = await clearEan13Codes()
    expect(resultClear.clearedProducts).toBe(0)
  })
})
