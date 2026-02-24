import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../route'
import { prisma } from '../../../../../lib/prisma'
import { verify_token } from '../../../../../lib/auth-utils'

// Mock dependencies
vi.mock('../../../../../lib/prisma', () => ({
    prisma: {
        producto: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        gastoCompra: {
            create: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}))

vi.mock('../../../../../lib/auth-utils', () => ({
    verify_token: vi.fn(),
}))

vi.mock('../../../../../lib/restock-utils', () => ({
    executeProductInstanceCreationWorkflow: vi.fn(),
}))

const mockPrisma = prisma as any
const mockVerifyToken = verify_token as Mock

describe('Restock API - Transaction Handling', () => {
    const mockUser = { id: 'user1', email: 'test@example.com', role: 'admin' }
    const mockProduct = {
        id: 'prod1',
        nombre: 'Test Product',
        descripcion: 'Test Description',
        precioCosto: 100,
        precioVenta: 150,
        stock: 10,
        categoriaId: 'cat1',
        unidadId: 'unit1',
        vendorId: 'vendor1',
        almacenId: 'alm1',
        puntoDeVentaId: null,
        categoria: { id: 'cat1', nombre: 'Category' },
        unidad: { id: 'unit1', nombre: 'Unit' },
        vendor: { id: 'vendor1', nombre: 'Vendor' },
        almacen: { id: 'alm1', nombre: 'Almacen' },
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockVerifyToken.mockResolvedValue(mockUser)
        mockPrisma.producto.findUnique.mockResolvedValue(mockProduct)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    const createMockRequest = (body: any) => {
        return {
            json: vi.fn().mockResolvedValue(body),
            headers: new Headers({ authorization: 'Bearer valid-token' }),
        } as unknown as NextRequest
    }

    describe('Transaction Atomicity', () => {
        it('should rollback transaction when product update fails', async () => {
            const requestBody = {
                productoId: 'prod1',
                cantidad: 5,
                precioCosto: 110,
            }

            // Mock workflow result for simple restock (no new instance)
            const { executeProductInstanceCreationWorkflow } = await import('../../../../../lib/restock-utils')
            const mockWorkflow = executeProductInstanceCreationWorkflow as Mock
            mockWorkflow.mockReturnValue({
                needsNewInstance: false,
                originalProductUpdate: {
                    id: 'prod1',
                    newStock: 15,
                    newPrecioCosto: 105,
                    newPrecioVenta: 150,
                },
                weightedAverages: {
                    costPrice: { weightedAverage: 105 },
                    sellingPrice: { weightedAverage: 150 },
                },
            })

            // Mock transaction that fails on product update
            const mockTransaction = vi.fn().mockImplementation(async (callback) => {
                const mockTx = {
                    producto: {
                        findUnique: vi.fn().mockResolvedValue(mockProduct),
                        update: vi.fn().mockRejectedValue(new Error('Database constraint violation')),
                    },
                    gastoCompra: {
                        create: vi.fn(),
                    },
                }

                try {
                    return await callback(mockTx)
                } catch (error) {
                    // Simulate transaction rollback
                    throw error
                }
            })

            mockPrisma.$transaction = mockTransaction

            const request = createMockRequest(requestBody)
            const response = await POST(request)
            const responseData = await response.json()

            expect(response.status).toBe(500)
            expect(responseData.error.message).toBe('Database operation failed: unknown_operation')
            expect(mockTransaction).toHaveBeenCalledTimes(1)

            // Verify that gastoCompra.create was never called due to rollback
            const transactionCallback = mockTransaction.mock.calls[0][0]
            const mockTx = {
                producto: {
                    findUnique: vi.fn().mockResolvedValue(mockProduct),
                    update: vi.fn().mockRejectedValue(new Error('Database constraint violation')),
                },
                gastoCompra: {
                    create: vi.fn(),
                },
            }

            await expect(transactionCallback(mockTx)).rejects.toThrow('Database constraint violation')
            expect(mockTx.gastoCompra.create).not.toHaveBeenCalled()
        })

        it('should rollback transaction when GastoCompra creation fails', async () => {
            const requestBody = {
                productoId: 'prod1',
                cantidad: 5,
                precioCosto: 110,
            }

            // Mock workflow result
            const { executeProductInstanceCreationWorkflow } = await import('../../../../../lib/restock-utils')
            const mockWorkflow = executeProductInstanceCreationWorkflow as Mock
            mockWorkflow.mockReturnValue({
                needsNewInstance: false,
                originalProductUpdate: {
                    id: 'prod1',
                    newStock: 15,
                    newPrecioCosto: 105,
                    newPrecioVenta: 150,
                },
                weightedAverages: {
                    costPrice: { weightedAverage: 105 },
                    sellingPrice: { weightedAverage: 150 },
                },
            })

            // Mock transaction that fails on GastoCompra creation
            const mockTransaction = vi.fn().mockImplementation(async (callback) => {
                const mockTx = {
                    producto: {
                        findUnique: vi.fn().mockResolvedValue(mockProduct),
                        update: vi.fn().mockResolvedValue(mockProduct),
                    },
                    gastoCompra: {
                        create: vi.fn().mockRejectedValue(new Error('Foreign key constraint failed')),
                    },
                }

                try {
                    return await callback(mockTx)
                } catch (error) {
                    // Simulate transaction rollback
                    throw error
                }
            })

            mockPrisma.$transaction = mockTransaction

            const request = createMockRequest(requestBody)
            const response = await POST(request)
            const responseData = await response.json()

            expect(response.status).toBe(400)
            expect(responseData.error.code).toBe('FOREIGN_KEY_ERROR')
            expect(responseData.error.message).toBe('Referenced vendor, category, or location no longer exists')
        })

        it('should rollback transaction when new product instance creation fails', async () => {
            const requestBody = {
                productoId: 'prod1',
                cantidad: 5,
                precioCosto: 110,
                precioVenta: 160,
            }

            // Mock workflow result for new instance creation
            const { executeProductInstanceCreationWorkflow } = await import('../../../../../lib/restock-utils')
            const mockWorkflow = executeProductInstanceCreationWorkflow as Mock
            mockWorkflow.mockReturnValue({
                needsNewInstance: true,
                reason: 'both_prices_changed',
                originalProductUpdate: {
                    id: 'prod1',
                    newStock: 10, // Stock doesn't change for original when creating new instance
                    newPrecioCosto: 105,
                    newPrecioVenta: 155,
                },
                newInstance: {
                    data: {
                        nombre: 'Test Product',
                        descripcion: 'Test Description',
                        precioCosto: 110,
                        precioVenta: 160,
                        stock: 5,
                        categoriaId: 'cat1',
                        unidadId: 'unit1',
                        vendorId: 'vendor1',
                        almacenId: 'alm1',
                        puntoDeVentaId: null,
                    },
                },
                weightedAverages: {
                    costPrice: { weightedAverage: 105 },
                    sellingPrice: { weightedAverage: 155 },
                },
            })

            // Mock transaction that fails on new instance creation
            const mockTransaction = vi.fn().mockImplementation(async (callback) => {
                const mockTx = {
                    producto: {
                        findUnique: vi.fn().mockResolvedValue(mockProduct),
                        create: vi.fn().mockRejectedValue(new Error('Unique constraint violation')),
                        update: vi.fn(),
                    },
                    gastoCompra: {
                        create: vi.fn(),
                    },
                }

                try {
                    return await callback(mockTx)
                } catch (error) {
                    throw error
                }
            })

            mockPrisma.$transaction = mockTransaction

            const request = createMockRequest(requestBody)
            const response = await POST(request)
            const responseData = await response.json()

            expect(response.status).toBe(409)
            expect(responseData.error.code).toBe('DUPLICATE_ENTRY')
            expect(responseData.error.message).toBe('A record with this product_instance already exists')
        })
    })

    describe('Concurrent Modification Detection', () => {
        it('should detect concurrent stock modification', async () => {
            const requestBody = {
                productoId: 'prod1',
                cantidad: 5,
            }

            // Mock workflow result
            const { executeProductInstanceCreationWorkflow } = await import('../../../../../lib/restock-utils')
            const mockWorkflow = executeProductInstanceCreationWorkflow as Mock
            mockWorkflow.mockReturnValue({
                needsNewInstance: false,
                originalProductUpdate: {
                    id: 'prod1',
                    newStock: 15,
                    newPrecioCosto: 100,
                    newPrecioVenta: 150,
                },
                weightedAverages: {
                    costPrice: { weightedAverage: 100 },
                    sellingPrice: { weightedAverage: 150 },
                },
            })

            // Mock transaction where product has been modified
            const mockTransaction = vi.fn().mockImplementation(async (callback) => {
                const mockTx = {
                    producto: {
                        findUnique: vi.fn().mockResolvedValue({
                            id: 'prod1',
                            stock: 12, // Different from original stock of 10
                            precioCosto: 100,
                            precioVenta: 150,
                        }),
                        update: vi.fn(),
                    },
                    gastoCompra: {
                        create: vi.fn(),
                    },
                }

                return await callback(mockTx)
            })

            mockPrisma.$transaction = mockTransaction

            const request = createMockRequest(requestBody)
            const response = await POST(request)
            const responseData = await response.json()

            expect(response.status).toBe(409)
            expect(responseData.error.code).toBe('CONCURRENT_MODIFICATION')
            expect(responseData.error.message).toBe('Product has been modified by another operation. Please refresh and try again.')
        })

        it('should detect concurrent price modification', async () => {
            const requestBody = {
                productoId: 'prod1',
                cantidad: 5,
            }

            // Mock workflow result
            const { executeProductInstanceCreationWorkflow } = await import('../../../../../lib/restock-utils')
            const mockWorkflow = executeProductInstanceCreationWorkflow as Mock
            mockWorkflow.mockReturnValue({
                needsNewInstance: false,
                originalProductUpdate: {
                    id: 'prod1',
                    newStock: 15,
                    newPrecioCosto: 100,
                    newPrecioVenta: 150,
                },
                weightedAverages: {
                    costPrice: { weightedAverage: 100 },
                    sellingPrice: { weightedAverage: 150 },
                },
            })

            // Mock transaction where product prices have been modified
            const mockTransaction = vi.fn().mockImplementation(async (callback) => {
                const mockTx = {
                    producto: {
                        findUnique: vi.fn().mockResolvedValue({
                            id: 'prod1',
                            stock: 10,
                            precioCosto: 105, // Different from original cost of 100
                            precioVenta: 150,
                        }),
                        update: vi.fn(),
                    },
                    gastoCompra: {
                        create: vi.fn(),
                    },
                }

                return await callback(mockTx)
            })

            mockPrisma.$transaction = mockTransaction

            const request = createMockRequest(requestBody)
            const response = await POST(request)
            const responseData = await response.json()

            expect(response.status).toBe(409)
            expect(responseData.error.code).toBe('CONCURRENT_MODIFICATION')
        })
    })

    describe('Transaction Timeout Handling', () => {
        it('should handle transaction timeout errors', async () => {
            const requestBody = {
                productoId: 'prod1',
                cantidad: 5,
            }

            // Mock workflow result
            const { executeProductInstanceCreationWorkflow } = await import('../../../../../lib/restock-utils')
            const mockWorkflow = executeProductInstanceCreationWorkflow as Mock
            mockWorkflow.mockReturnValue({
                needsNewInstance: false,
                originalProductUpdate: {
                    id: 'prod1',
                    newStock: 15,
                    newPrecioCosto: 100,
                    newPrecioVenta: 150,
                },
                weightedAverages: {
                    costPrice: { weightedAverage: 100 },
                    sellingPrice: { weightedAverage: 150 },
                },
            })

            // Mock transaction timeout
            mockPrisma.$transaction.mockRejectedValue(new Error('Transaction timeout'))

            const request = createMockRequest(requestBody)
            const response = await POST(request)
            const responseData = await response.json()

            expect(response.status).toBe(408)
            expect(responseData.error.code).toBe('TRANSACTION_TIMEOUT')
            expect(responseData.error.message).toBe('Operation took too long to complete. Please try again.')
        })
    })

    describe('Data Validation in Transaction', () => {
        it('should validate cost calculation within transaction', async () => {
            const requestBody = {
                productoId: 'prod1',
                cantidad: 5,
                precioCosto: -10, // Invalid negative price
            }

            // Mock workflow result
            const { executeProductInstanceCreationWorkflow } = await import('../../../../../lib/restock-utils')
            const mockWorkflow = executeProductInstanceCreationWorkflow as Mock
            mockWorkflow.mockReturnValue({
                needsNewInstance: false,
                originalProductUpdate: {
                    id: 'prod1',
                    newStock: 15,
                    newPrecioCosto: -5, // This would result in invalid calculation
                    newPrecioVenta: 150,
                },
                weightedAverages: {
                    costPrice: { weightedAverage: -5 },
                    sellingPrice: { weightedAverage: 150 },
                },
            })

            // Mock transaction that detects invalid calculation
            const mockTransaction = vi.fn().mockImplementation(async (callback) => {
                const mockTx = {
                    producto: {
                        findUnique: vi.fn().mockResolvedValue(mockProduct),
                        update: vi.fn().mockResolvedValue(mockProduct),
                    },
                    gastoCompra: {
                        create: vi.fn().mockImplementation((data) => {
                            // Simulate validation that would catch negative total
                            if (data.data.total <= 0) {
                                throw new Error('Invalid cost calculation')
                            }
                            return Promise.resolve({ id: 'gasto1', ...data.data })
                        }),
                    },
                }

                return await callback(mockTx)
            })

            mockPrisma.$transaction = mockTransaction

            const request = createMockRequest(requestBody)
            const response = await POST(request)
            const responseData = await response.json()

            expect(response.status).toBe(400)
            expect(responseData.error.code).toBe('INVALID_COST_PRICE')
            expect(responseData.error.message).toBe('Cost price must be a positive number')
        })

        it('should validate stock calculation within transaction', async () => {
            const requestBody = {
                productoId: 'prod1',
                cantidad: 5,
            }

            // Mock workflow result with invalid stock
            const { executeProductInstanceCreationWorkflow } = await import('../../../../../lib/restock-utils')
            const mockWorkflow = executeProductInstanceCreationWorkflow as Mock
            mockWorkflow.mockReturnValue({
                needsNewInstance: false,
                originalProductUpdate: {
                    id: 'prod1',
                    newStock: -5, // Invalid negative stock
                    newPrecioCosto: 100,
                    newPrecioVenta: 150,
                },
                weightedAverages: {
                    costPrice: { weightedAverage: 100 },
                    sellingPrice: { weightedAverage: 150 },
                },
            })

            const request = createMockRequest(requestBody)
            const response = await POST(request)
            const responseData = await response.json()

            expect(response.status).toBe(400)
            expect(responseData.error.code).toBe('CALCULATION_ERROR')
            expect(responseData.error.message).toBe('Invalid calculation detected: invalid_stock')
        })
    })

    describe('Transaction Success Scenarios', () => {
        it('should complete transaction successfully for simple restock', async () => {
            const requestBody = {
                productoId: 'prod1',
                cantidad: 5,
            }

            // Mock workflow result
            const { executeProductInstanceCreationWorkflow } = await import('../../../../../lib/restock-utils')
            const mockWorkflow = executeProductInstanceCreationWorkflow as Mock
            mockWorkflow.mockReturnValue({
                needsNewInstance: false,
                originalProductUpdate: {
                    id: 'prod1',
                    newStock: 15,
                    newPrecioCosto: 100,
                    newPrecioVenta: 150,
                },
                weightedAverages: {
                    costPrice: { weightedAverage: 100 },
                    sellingPrice: { weightedAverage: 150 },
                },
            })

            const updatedProduct = { ...mockProduct, stock: 15 }
            const expectedGastoCompra = {
                id: 'gasto1',
                productoId: 'prod1',
                vendorId: 'vendor1',
                cantidad: 5,
                precioUnitario: 100,
                total: 500,
                descripcion: 'Restock - Test Product',
                producto: mockProduct,
                vendor: mockProduct.vendor,
            }

            // Mock successful transaction
            const mockTransaction = vi.fn().mockImplementation(async (callback) => {
                const mockTx = {
                    producto: {
                        findUnique: vi.fn().mockResolvedValue(mockProduct),
                        update: vi.fn().mockResolvedValue(updatedProduct),
                    },
                    gastoCompra: {
                        create: vi.fn().mockResolvedValue(expectedGastoCompra),
                    },
                }

                return await callback(mockTx)
            })

            mockPrisma.$transaction = mockTransaction

            const request = createMockRequest(requestBody)
            const response = await POST(request)
            const responseData = await response.json()

            expect(response.status).toBe(200)
            expect(responseData.success).toBe(true)
            expect(responseData.data.producto).toEqual(updatedProduct)
            expect(responseData.data.gastoCompra).toEqual(expect.objectContaining(expectedGastoCompra))
            expect(responseData.data.productInstance).toBeNull()
        })

        it('should complete transaction successfully with new product instance', async () => {
            const requestBody = {
                productoId: 'prod1',
                cantidad: 5,
                precioCosto: 110,
                precioVenta: 160,
            }

            // Mock workflow result for new instance
            const { executeProductInstanceCreationWorkflow } = await import('../../../../../lib/restock-utils')
            const mockWorkflow = executeProductInstanceCreationWorkflow as Mock
            mockWorkflow.mockReturnValue({
                needsNewInstance: true,
                reason: 'both_prices_changed',
                originalProductUpdate: {
                    id: 'prod1',
                    newStock: 10,
                    newPrecioCosto: 105,
                    newPrecioVenta: 155,
                },
                newInstance: {
                    data: {
                        nombre: 'Test Product',
                        descripcion: 'Test Description',
                        precioCosto: 110,
                        precioVenta: 160,
                        stock: 5,
                        categoriaId: 'cat1',
                        unidadId: 'unit1',
                        vendorId: 'vendor1',
                        almacenId: 'alm1',
                        puntoDeVentaId: null,
                    },
                },
                weightedAverages: {
                    costPrice: { weightedAverage: 105 },
                    sellingPrice: { weightedAverage: 155 },
                },
            })

            const updatedProduct = { ...mockProduct, precioCosto: 105, precioVenta: 155 }
            const newInstance = {
                id: 'prod2',
                nombre: 'Test Product',
                descripcion: 'Test Description',
                precioCosto: 110,
                precioVenta: 160,
                stock: 5,
                categoriaId: 'cat1',
                unidadId: 'unit1',
                vendorId: 'vendor1',
                almacenId: 'alm1',
                puntoDeVentaId: null,
                categoria: mockProduct.categoria,
                unidad: mockProduct.unidad,
                vendor: mockProduct.vendor,
                almacen: mockProduct.almacen,
            }
            const expectedGastoCompra = {
                id: 'gasto1',
                productoId: 'prod2',
                vendorId: 'vendor1',
                cantidad: 5,
                precioUnitario: 110,
                total: 550,
                descripcion: 'Restock - Test Product (Nueva instancia por cambio de precios)',
                producto: newInstance,
                vendor: mockProduct.vendor,
            }

            // Mock successful transaction with new instance
            const mockTransaction = vi.fn().mockImplementation(async (callback) => {
                const mockTx = {
                    producto: {
                        findUnique: vi.fn().mockResolvedValue(mockProduct),
                        create: vi.fn().mockResolvedValue(newInstance),
                        update: vi.fn().mockResolvedValue(updatedProduct),
                    },
                    gastoCompra: {
                        create: vi.fn().mockResolvedValue(expectedGastoCompra),
                    },
                }

                return await callback(mockTx)
            })

            mockPrisma.$transaction = mockTransaction

            const request = createMockRequest(requestBody)
            const response = await POST(request)
            const responseData = await response.json()

            expect(response.status).toBe(200)
            expect(responseData.success).toBe(true)
            expect(responseData.data.producto).toEqual(updatedProduct)
            expect(responseData.data.productInstance).toEqual(newInstance)
            expect(responseData.data.gastoCompra).toEqual(expect.objectContaining(expectedGastoCompra))
            expect(responseData.data.restockDetails.pricesChanged).toBe(true)
        })
    })
})