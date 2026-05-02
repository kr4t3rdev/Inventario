import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { resetProductsForEan13, clearEan13Codes } from '@/lib/ean13-reset'

describe('EAN-13 Reset Logic', () => {
  const createTenant = async () => {
    return prisma.tenant.create({
      data: {
        nombre: `Tenant EAN13 ${Date.now()}`,
        slug: `tenant-ean13-${Date.now()}`,
      },
    })
  }

  const setupTestData = async () => {
    const tenant = await createTenant()

    // Create test categoria
    const categoria = await prisma.categoria.create({
      data: {
        nombre: `Test Categoria ${Date.now()}`,
        tenantId: tenant.tenantId,
      },
    })

    // Create test almacen
    const almacen = await prisma.almacen.create({
      data: {
        nombre: `Test Almacen ${Date.now()}`,
        tenantId: tenant.tenantId,
      },
    })

    // Create test products with EAN-13 codes
    const p1 = await prisma.producto.create({
      data: {
        nombre: 'Test Product 1',
        precioCosto: 100,
        precioVenta: 150,
        stock: 10,
        categoria: { connect: { catId: categoria.catId } },
        almacen: { connect: { almacenId: almacen.almacenId } },
        tenant: { connect: { tenantId: tenant.tenantId } },
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
        categoria: { connect: { catId: categoria.catId } },
        almacen: { connect: { almacenId: almacen.almacenId } },
        tenant: { connect: { tenantId: tenant.tenantId } },
        codigoNegocio: 'TEST002',
        proveedorCodigo: '02',
        idSeccionCodigo: '03',
        especificoCodigo: '0002',
        surtidoCodigo: '0002',
        dcCodigo: '2',
      },
    })

    return { tenant, categoria, almacen, p1, p2 }
  }

  const cleanup = async (tenantId?: string) => {
    try {
      if (!tenantId) return

      // Cleanup: delete only tenant-scoped test products, categorias, and almacenes
      await prisma.producto.deleteMany({ where: { tenantId } })
      await prisma.categoria.deleteMany({ where: { tenantId } })
      await prisma.almacen.deleteMany({ where: { tenantId } })
      await prisma.tenant.deleteMany({ where: { tenantId } })
    } catch (error) {
      // Silently ignore cleanup errors
    }
  }

  afterEach(async () => {
    // The test body deletes its own tenant-scoped data when possible.
  })

  it('should delete all products when resetting for EAN-13 activation', async () => {
    const { tenant } = await setupTestData()

    const before = await prisma.producto.count({ where: { tenantId: tenant.tenantId } })
    expect(before).toBe(2)

    const result = await resetProductsForEan13(tenant.tenantId)

    expect(result.deletedProducts).toBe(2)
    expect(result.deletedCategorias).toBeGreaterThanOrEqual(1)

    const after = await prisma.producto.count({ where: { tenantId: tenant.tenantId } })
    expect(after).toBe(0)

    const afterCat = await prisma.categoria.count({ where: { tenantId: tenant.tenantId } })
    expect(afterCat).toBe(0)

    await cleanup(tenant.tenantId)
  })

  it('should clear all EAN-13 codes without deleting products', async () => {
    const { tenant } = await setupTestData()

    const before = await prisma.producto.findMany({
      where: { tenantId: tenant.tenantId, codigoNegocio: { not: null } },
    })
    expect(before.length).toBe(2)
    expect(before[0].proveedorCodigo).not.toBeNull()
    expect(before[0].idSeccionCodigo).not.toBeNull()

    const result = await clearEan13Codes(tenant.tenantId)

    expect(result.clearedProducts).toBe(2)

    const after = await prisma.producto.findMany({
      where: { tenantId: tenant.tenantId, codigoNegocio: { not: null } },
    })
    expect(after.length).toBe(0)

    // Verify all EAN-13 fields are null
    const afterAll = await prisma.producto.findMany({ where: { tenantId: tenant.tenantId } })
    expect(afterAll.length).toBe(2) // Products still exist
    afterAll.forEach((p) => {
      expect(p.codigoNegocio).toBeNull()
      expect(p.proveedorCodigo).toBeNull()
      expect(p.idSeccionCodigo).toBeNull()
      expect(p.especificoCodigo).toBeNull()
      expect(p.surtidoCodigo).toBeNull()
      expect(p.dcCodigo).toBeNull()
    })

    await cleanup(tenant.tenantId)
  })

  it('should return correct deletion count', async () => {
    const { tenant } = await setupTestData()

    const result = await resetProductsForEan13(tenant.tenantId)
    expect(result.deletedProducts).toBe(2)
    expect(typeof result.deletedProducts).toBe('number')
    expect(result.deletedCategorias).toBeGreaterThanOrEqual(1)
    expect(typeof result.deletedCategorias).toBe('number')

    await cleanup(tenant.tenantId)
  })

  it('should return correct cleared count', async () => {
    const { tenant } = await setupTestData()

    const result = await clearEan13Codes(tenant.tenantId)
    expect(result.clearedProducts).toBe(2)
    expect(typeof result.clearedProducts).toBe('number')

    await cleanup(tenant.tenantId)
  })

  it('should handle empty database (no products)', async () => {
    const tenant = await createTenant()

    const resultDelete = await resetProductsForEan13(tenant.tenantId)
    expect(resultDelete.deletedProducts).toBe(0)
    expect(resultDelete.deletedCategorias).toBe(0)

    const resultClear = await clearEan13Codes(tenant.tenantId)
    expect(resultClear.clearedProducts).toBe(0)

    await cleanup(tenant.tenantId)
  })

  it('should delete hierarchical categories (parent and children) on reset', async () => {
    const tenant = await createTenant()

    const parent = await prisma.categoria.create({
      data: { nombre: 'Parent Cat', tenantId: tenant.tenantId },
    })
    await prisma.categoria.create({
      data: {
        nombre: 'Child Cat 1',
        parentId: parent.catId,
        tenantId: tenant.tenantId,
      },
    })
    await prisma.categoria.create({
      data: {
        nombre: 'Child Cat 2',
        parentId: parent.catId,
        tenantId: tenant.tenantId,
      },
    })

    const beforeCount = await prisma.categoria.count({ where: { tenantId: tenant.tenantId } })
    expect(beforeCount).toBe(3)

    const result = await resetProductsForEan13(tenant.tenantId)

    expect(result.deletedCategorias).toBe(3)
    const afterCount = await prisma.categoria.count({ where: { tenantId: tenant.tenantId } })
    expect(afterCount).toBe(0)

    await cleanup(tenant.tenantId)
  })
})
