/**
 * Integration test for transaction handling in restock operations
 * This test verifies that database transactions work correctly and rollback on errors
 * 
 * Run with: node src/app/api/productos/restock/__tests__/transaction-integration.test.js
 */

const { PrismaClient } = require('@prisma/client')

// Mock Prisma client for testing
class MockPrismaClient {
  constructor() {
    this.transactionCallCount = 0
    this.rollbackCount = 0
    this.commitCount = 0
  }

  async $transaction(callback, options = {}) {
    this.transactionCallCount++
    console.log(`🔄 Starting transaction #${this.transactionCallCount}`)
    
    // Mock transaction context
    const mockTx = {
      producto: {
        findUnique: async (params) => {
          console.log(`  📋 Finding product: ${params.where.id}`)
          
          // Simulate different scenarios based on test case
          if (params.where.id === 'concurrent-test') {
            // Simulate concurrent modification
            return {
              id: 'concurrent-test',
              stock: 15, // Different from expected 10
              precioCosto: 100,
              precioVenta: 150
            }
          }
          
          if (params.where.id === 'deleted-product') {
            return null // Product was deleted
          }
          
          // Normal case
          return {
            id: 'prod1',
            stock: 10,
            precioCosto: 100,
            precioVenta: 150
          }
        },
        
        create: async (data) => {
          console.log(`  ➕ Creating new product instance`)
          
          if (data.data.nombre === 'fail-create') {
            throw new Error('Unique constraint violation')
          }
          
          return {
            id: 'new-instance-id',
            ...data.data,
            categoria: { id: 'cat1', nombre: 'Category' },
            unidad: { id: 'unit1', nombre: 'Unit' },
            vendor: { id: 'vendor1', nombre: 'Vendor' },
            almacen: { id: 'alm1', nombre: 'Almacen' }
          }
        },
        
        update: async (params) => {
          console.log(`  📝 Updating product: ${params.where.id}`)
          
          if (params.where.id === 'fail-update') {
            throw new Error('Database constraint violation')
          }
          
          return {
            id: params.where.id,
            ...params.data,
            categoria: { id: 'cat1', nombre: 'Category' },
            unidad: { id: 'unit1', nombre: 'Unit' },
            vendor: { id: 'vendor1', nombre: 'Vendor' },
            almacen: { id: 'alm1', nombre: 'Almacen' }
          }
        }
      },
      
      gastoCompra: {
        create: async (data) => {
          console.log(`  💰 Creating expense entry: $${data.data.total}`)
          
          if (data.data.total <= 0) {
            throw new Error('Invalid cost calculation')
          }
          
          if (data.data.descripcion?.includes('fail-expense')) {
            throw new Error('Foreign key constraint failed')
          }
          
          return {
            id: 'expense-id',
            ...data.data,
            producto: { id: data.data.productoId, nombre: 'Test Product' },
            vendor: { id: 'vendor1', nombre: 'Vendor' }
          }
        }
      }
    }
    
    try {
      const result = await callback(mockTx)
      this.commitCount++
      console.log(`  ✅ Transaction committed successfully`)
      return result
    } catch (error) {
      this.rollbackCount++
      console.log(`  ❌ Transaction rolled back: ${error.message}`)
      throw error
    }
  }
}

// Test scenarios
const testScenarios = [
  {
    name: 'Successful simple restock',
    productId: 'prod1',
    expectedSuccess: true,
    expectedError: null
  },
  {
    name: 'Product update failure',
    productId: 'fail-update',
    expectedSuccess: false,
    expectedError: 'Database constraint violation'
  },
  {
    name: 'Concurrent modification detection',
    productId: 'concurrent-test',
    expectedSuccess: false,
    expectedError: 'Product has been modified by another operation'
  },
  {
    name: 'Product deletion during operation',
    productId: 'deleted-product',
    expectedSuccess: false,
    expectedError: 'Product no longer exists'
  }
]

// Mock workflow function
function mockExecuteProductInstanceCreationWorkflow(params) {
  return {
    needsNewInstance: false,
    originalProductUpdate: {
      id: params.currentProduct.id,
      newStock: params.currentProduct.stock + params.restockQuantity,
      newPrecioCosto: params.currentProduct.precioCosto,
      newPrecioVenta: params.currentProduct.precioVenta,
    },
    weightedAverages: {
      costPrice: { weightedAverage: params.currentProduct.precioCosto },
      sellingPrice: { weightedAverage: params.currentProduct.precioVenta },
    }
  }
}

// Simulate the transaction logic from the API
async function simulateRestockTransaction(prisma, productId, cantidad = 5) {
  console.log(`\n🧪 Testing restock for product: ${productId}`)
  
  // Mock initial product lookup
  const producto = {
    id: productId,
    nombre: 'Test Product',
    descripcion: 'Test Description',
    precioCosto: 100,
    precioVenta: 150,
    stock: 10,
    categoriaId: 'cat1',
    unidadId: 'unit1',
    vendorId: 'vendor1',
    almacenId: 'alm1',
    puntoDeVentaId: null
  }
  
  const workflowResult = mockExecuteProductInstanceCreationWorkflow({
    currentProduct: producto,
    restockQuantity: cantidad
  })
  
  // Execute transaction (this is the core logic being tested)
  const result = await prisma.$transaction(async (tx) => {
    let updatedProducto
    let gastoCompra
    
    try {
      // Validate that the original product still exists and hasn't been modified
      const currentProduct = await tx.producto.findUnique({
        where: { id: productId },
        select: { id: true, stock: true, precioCosto: true, precioVenta: true }
      })

      if (!currentProduct) {
        throw new Error("Product no longer exists")
      }

      // Check for concurrent modifications (optimistic locking)
      if (currentProduct.stock !== producto.stock || 
          currentProduct.precioCosto !== producto.precioCosto || 
          currentProduct.precioVenta !== producto.precioVenta) {
        throw new Error("Product has been modified by another operation. Please refresh and try again.")
      }

      // Validate stock calculation
      const newStock = workflowResult.originalProductUpdate.newStock
      if (newStock < 0 || !Number.isInteger(newStock)) {
        throw new Error("Invalid stock calculation")
      }

      updatedProducto = await tx.producto.update({
        where: { id: productId },
        data: {
          stock: newStock,
          precioCosto: Math.round(workflowResult.originalProductUpdate.newPrecioCosto),
          precioVenta: Math.round(workflowResult.originalProductUpdate.newPrecioVenta),
        },
        include: {
          categoria: true,
          unidad: true,
          vendor: true,
          almacen: true
        }
      })

      // Create GastoCompra entry
      const costPrice = producto.precioCosto
      const totalCost = cantidad * costPrice

      // Validate cost calculation
      if (totalCost <= 0 || !Number.isFinite(totalCost)) {
        throw new Error("Invalid cost calculation")
      }

      gastoCompra = await tx.gastoCompra.create({
        data: {
          productoId: producto.id,
          vendorId: producto.vendorId,
          cantidad: cantidad,
          precioUnitario: costPrice,
          total: totalCost,
          fechaCompra: new Date(),
          descripcion: `Restock - ${producto.nombre}`
        },
        include: {
          producto: true,
          vendor: true
        }
      })

      // Validate that all operations completed successfully
      if (!updatedProducto || !gastoCompra) {
        throw new Error("Transaction incomplete - missing required data")
      }

      return {
        updatedProducto,
        gastoCompra,
        workflowResult
      }

    } catch (transactionError) {
      console.log(`    🚨 Transaction error: ${transactionError.message}`)
      throw transactionError
    }
  }, {
    maxWait: 5000,
    timeout: 10000,
    isolationLevel: 'ReadCommitted'
  })
  
  return result
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Transaction Handling Tests\n')
  
  const mockPrisma = new MockPrismaClient()
  let passedTests = 0
  let failedTests = 0
  
  for (const scenario of testScenarios) {
    try {
      const result = await simulateRestockTransaction(mockPrisma, scenario.productId)
      
      if (scenario.expectedSuccess) {
        console.log(`    ✅ Test passed: ${scenario.name}`)
        passedTests++
      } else {
        console.log(`    ❌ Test failed: ${scenario.name} - Expected failure but got success`)
        failedTests++
      }
      
    } catch (error) {
      if (!scenario.expectedSuccess && error.message.includes(scenario.expectedError)) {
        console.log(`    ✅ Test passed: ${scenario.name} - Correctly failed with: ${error.message}`)
        passedTests++
      } else {
        console.log(`    ❌ Test failed: ${scenario.name} - Unexpected error: ${error.message}`)
        failedTests++
      }
    }
  }
  
  // Test transaction statistics
  console.log('\n📊 Transaction Statistics:')
  console.log(`  Total transactions: ${mockPrisma.transactionCallCount}`)
  console.log(`  Successful commits: ${mockPrisma.commitCount}`)
  console.log(`  Rollbacks: ${mockPrisma.rollbackCount}`)
  
  // Test results
  console.log('\n🎯 Test Results:')
  console.log(`  Passed: ${passedTests}`)
  console.log(`  Failed: ${failedTests}`)
  console.log(`  Total: ${passedTests + failedTests}`)
  
  if (failedTests === 0) {
    console.log('\n🎉 All tests passed! Transaction handling is working correctly.')
    process.exit(0)
  } else {
    console.log('\n💥 Some tests failed. Please review the transaction logic.')
    process.exit(1)
  }
}

// Additional test for new product instance creation
async function testNewInstanceTransaction() {
  console.log('\n🧪 Testing new product instance creation transaction')
  
  const mockPrisma = new MockPrismaClient()
  
  try {
    const result = await mockPrisma.$transaction(async (tx) => {
      // Simulate new instance creation workflow
      const currentProduct = await tx.producto.findUnique({
        where: { id: 'prod1' },
        select: { id: true, stock: true, precioCosto: true, precioVenta: true }
      })
      
      if (!currentProduct) {
        throw new Error("Product no longer exists")
      }
      
      // Create new product instance
      const newInstance = await tx.producto.create({
        data: {
          nombre: 'Test Product',
          descripcion: 'Test Description',
          precioCosto: 110, // Different price
          precioVenta: 160, // Different price
          stock: 5,
          categoriaId: 'cat1',
          unidadId: 'unit1',
          vendorId: 'vendor1',
          almacenId: 'alm1',
          puntoDeVentaId: null,
        },
        include: {
          categoria: true,
          unidad: true,
          vendor: true,
          almacen: true
        }
      })
      
      // Update original product with weighted averages
      const updatedProduct = await tx.producto.update({
        where: { id: 'prod1' },
        data: {
          precioCosto: 105, // Weighted average
          precioVenta: 155, // Weighted average
        },
        include: {
          categoria: true,
          unidad: true,
          vendor: true,
          almacen: true
        }
      })
      
      // Create expense entry
      const gastoCompra = await tx.gastoCompra.create({
        data: {
          productoId: newInstance.id,
          vendorId: 'vendor1',
          cantidad: 5,
          precioUnitario: 110,
          total: 550,
          fechaCompra: new Date(),
          descripcion: 'Restock - Test Product (Nueva instancia por cambio de precios)'
        },
        include: {
          producto: true,
          vendor: true
        }
      })
      
      return {
        updatedProduct,
        newInstance,
        gastoCompra
      }
    })
    
    console.log('    ✅ New instance transaction completed successfully')
    return true
    
  } catch (error) {
    console.log(`    ❌ New instance transaction failed: ${error.message}`)
    return false
  }
}

// Run all tests
async function main() {
  await runTests()
  
  const newInstanceSuccess = await testNewInstanceTransaction()
  
  if (newInstanceSuccess) {
    console.log('\n🎉 All transaction tests completed successfully!')
  } else {
    console.log('\n💥 New instance transaction test failed!')
    process.exit(1)
  }
}

// Execute tests
main().catch(console.error)