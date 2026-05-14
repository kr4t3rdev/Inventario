/**
 * @description Tests unitarios para Server Actions de productos.
 * Sigue TDD: RED → GREEN → REFACTOR.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mockeamos dependencias ANTES de importar el módulo
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/generated/prisma', () => {
  class MockPrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, opts: { code: string; clientVersion: string }) {
      super(message);
      this.code = opts.code;
      this.name = 'PrismaClientKnownRequestError';
    }
  }
  return {
    Prisma: {
      PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
      PrismaClientValidationError: class extends Error {
        constructor(message: string, clientVersion: string) {
          super(message);
          this.name = 'PrismaClientValidationError';
        }
      },
    },
  };
});
vi.mock('@/lib/prisma', () => {
  const tx = {
    producto: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    precioProducto: {
      upsert: vi.fn(),
    },
    gastoCompra: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    categoria: {
      findUnique: vi.fn(),
    },
  };
  return {
    prisma: {
      producto: tx.producto,
      precioProducto: tx.precioProducto,
      gastoCompra: tx.gastoCompra,
      categoria: tx.categoria,
      miEmpresa: {
        findFirst: vi.fn().mockResolvedValue({ usaCodigoEan13: false }),
      },
      $transaction: vi.fn().mockImplementation(
        async (callback: (tx: typeof tx) => unknown) => callback(tx),
      ),
    },
  };
});
vi.mock('@/lib/services/stock-ubicacion-service', () => ({
  upsertStockUbicacion: vi.fn(),
}));
vi.mock('@/lib/restock-utils', () => {
  const actual = vi.importActual('@/lib/restock-utils');
  return {
    ...actual,
    executeProductInstanceCreationWorkflow: vi.fn(),
  };
});

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { executeProductInstanceCreationWorkflow } from '@/lib/restock-utils';
import {
  getProductosAction,
  createProductoAction,
  updateProductoAction,
  deleteProductoAction,
  restockProductoAction,
} from '@/features/productos/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Helpers ───────────────────────────────────────────────

const mockUser: AuthenticatedUser = {
  userId: 'user-test-1',
  name: 'Test',
  email: 'test@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-test',
  tenantRole: 'admin',
};

const mockProducto = {
  id: 'prod-1',
  nombre: 'Producto Test',
  descripcion: 'Descripción',
  precioCosto: 100,
  precioVenta: 200,
  stock: 50,
  stockMinimo: 10,
  codigoInterno: '12345678901',
  proveedorCodigo: null,
  categoriaId: 'cat-1',
  subcategoriaId: null,
  unidadId: 'unidad-1',
  vendorId: null,
  almacenId: 'almacen-1',
  puntoDeVentaId: null,
  fotos: [],
  tenantId: 'tenant-test',
  esCompuesto: false,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

// ─── Tests ─────────────────────────────────────────────────

describe('Productos Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getProductosAction ───────────────────────

  describe('getProductosAction', () => {
    it('retorna lista de productos del tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findMany).mockResolvedValue([mockProducto]);

      const result = await getProductosAction();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].nombre).toBe('Producto Test');
      expect(prisma.producto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-test' }),
        })
      );
    });

    it('retorna lista vacía si no hay productos', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findMany).mockResolvedValue([]);

      const result = await getProductosAction();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  // ─── createProductoAction ─────────────────────

  describe('createProductoAction', () => {
    const validInput = {
      nombre: 'Nuevo Producto',
      descripcion: 'Descripción',
      precioCosto: 500,
      precioVenta: 1000,
      stock: 100,
      stockMinimo: 5,
      codigoInterno: null as string | null,
      proveedorCodigo: null as string | null,
      categoriaId: 'cat-1',
      subcategoriaId: null as string | null,
      unidadId: 'unidad-1',
      vendorId: null as string | null,
      almacenId: 'almacen-1',
      puntoDeVentaId: null as string | null,
      fotos: [],
    };

    it('crea producto exitosamente con datos válidos', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.create).mockResolvedValue(mockProducto);

      const result = await createProductoAction(validInput);

      expect(result.success).toBe(true);
      expect(prisma.producto.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nombre: 'Nuevo Producto',
            tenantId: 'tenant-test',
          }),
        })
      );
    });

    it('retorna error de validación si el nombre está vacío', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const result = await createProductoAction({ ...validInput, nombre: '' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBeDefined();
    });

    it('retorna error de validación si el precio es negativo', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const result = await createProductoAction({ ...validInput, precioCosto: -10 });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBeDefined();
    });
  });

  // ─── updateProductoAction ─────────────────────

  describe('updateProductoAction', () => {
    const validUpdate = {
      id: 'prod-1',
      nombre: 'Producto Actualizado',
      precioVenta: 300,
    };

    it('actualiza producto exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(mockProducto);
      vi.mocked(prisma.producto.update).mockResolvedValue({ ...mockProducto, nombre: 'Producto Actualizado' });

      const result = await updateProductoAction(validUpdate);

      expect(result.success).toBe(true);
      expect(prisma.producto.update).toHaveBeenCalled();
    });

    it('retorna error si el producto no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(null);

      const result = await updateProductoAction(validUpdate);

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('no encontrado');
    });
  });

  // ─── deleteProductoAction ─────────────────────

  describe('deleteProductoAction', () => {
    it('elimina producto exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(mockProducto);
      vi.mocked(prisma.producto.delete).mockResolvedValue(mockProducto);

      const result = await deleteProductoAction('prod-1');

      expect(result.success).toBe(true);
      expect(prisma.producto.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'prod-1' } })
      );
    });

    it('retorna error si el producto no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(null);

      const result = await deleteProductoAction('prod-noexiste');

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('no encontrado');
    });
  });

  // ─── Auth requerido ───────────────────────────

  describe('auth requerido', () => {
    it('getProductosAction retorna AUTH_REQUIRED sin usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await getProductosAction();

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });

  // ─── restockProductoAction ─────────────────────

  describe('restockProductoAction', () => {
    const mockProductoCompleto = {
      ...mockProducto,
      vendorId: 'vendor-1',
      almacenId: 'almacen-1',
      categoria: { catId: 'cat-1', nombre: 'Categoría Test' },
      unidad: { unidadId: 'unidad-1', simbolo: 'u' },
      vendor: { vendorId: 'vendor-1', nombre: 'Vendor Test' },
      almacen: { almacenId: 'almacen-1', nombre: 'Almacén Test' },
      fotos: [],
      esCompuesto: false,
      codigoNegocio: null,
      puntoDeVentaId: null,
      proveedorCodigo: null,
      subcategoriaId: null,
    };

    const mockGastoCompra = {
      gastoCompraId: 'gasto-1',
      productoId: 'prod-1',
      vendorId: 'vendor-1',
      cantidad: 5,
      precioUnitario: 100,
      total: 500,
      fechaCompra: new Date(),
      descripcion: 'Restock - Producto Test',
      periodo: '2025-05',
      numeroFactura: null,
      tenantId: 'tenant-test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockWorkflowResult = {
      needsNewInstance: false,
      originalProductUpdate: {
        id: 'prod-1',
        newStock: 55,
        newPrecioCosto: 100,
        newPrecioVenta: 200,
      },
      weightedAverages: {
        costPrice: {
          weightedAverage: 100,
          totalQuantity: 55,
          totalValue: 5500,
        },
        sellingPrice: {
          weightedAverage: 200,
          totalQuantity: 55,
          totalValue: 11000,
        },
      },
    };

    const validRestockInput = {
      productoId: 'prod-1',
      cantidad: 5,
    };

    // Mock de transacción que simula el callback ejecutándose y retornando lo esperado
    function mockTransaction(result: unknown) {
      vi.mocked(prisma.$transaction).mockImplementation(
        async (cb: Function, _options?: any) => {
          await cb(mockTx);
          return result;
        },
      );
    }

    // Cliente de transacción mockeado con todas las operaciones necesarias
    const mockTx = {
      producto: {
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      gastoCompra: {
        create: vi.fn(),
      },
      compraProducto: {
        create: vi.fn(),
        update: vi.fn(),
      },
      tipoPago: {
        findFirst: vi.fn(),
      },
      cuentaBancaria: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      reconciliacionGasto: {
        create: vi.fn(),
      },
      cuentaPorPagar: {
        create: vi.fn(),
      },
      stockUbicacion: {
        upsert: vi.fn(),
      },
    };

    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(
        mockProductoCompleto,
      );
      vi.mocked(executeProductInstanceCreationWorkflow).mockReturnValue(
        mockWorkflowResult,
      );
    });

    // ── 3.7: Payload inválido → VALIDATION_ERROR ──

    it('retorna VALIDATION_ERROR si productoId está vacío', async () => {
      const result = await restockProductoAction({
        productoId: '',
        cantidad: 5,
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('VALIDATION_ERROR');
    });

    it('retorna VALIDATION_ERROR si cantidad es 0', async () => {
      const result = await restockProductoAction({
        productoId: 'prod-1',
        cantidad: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('VALIDATION_ERROR');
    });

    it('retorna VALIDATION_ERROR con tipoRestock inválido', async () => {
      const result = await restockProductoAction({
        productoId: 'prod-1',
        cantidad: 1,
        tipoRestock: 'modo_invalido' as any,
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('VALIDATION_ERROR');
    });

    // ── 3.6: Producto no existe → NOT_FOUND ──

    it('retorna NOT_FOUND si el producto no existe', async () => {
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(null);

      const result = await restockProductoAction(validRestockInput);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
      expect(result.error!.message).toContain('no encontrado');
    });

    // ── 3.2: Restock simple (solo cantidad) ──

    it('restock simple: incrementa stock y actualiza StockUbicacion', async () => {
      vi.mocked(prisma.producto.update).mockResolvedValue({
        ...mockProductoCompleto,
        stock: 55,
      });
      mockTx.producto.update.mockResolvedValue({
        ...mockProductoCompleto,
        stock: 55,
      });
      mockTx.gastoCompra.create.mockResolvedValue(mockGastoCompra);
      mockTx.compraProducto.create.mockResolvedValue({
        compraProductoId: 'compra-1',
      });
      // Proveer cuenta para que el flujo PAGO_COMPLETO por defecto funcione
      mockTx.tipoPago.findFirst.mockResolvedValue({
        tipoId: 'tipo-1',
        cuentaDefecto: 'cuenta-1',
      });
      mockTx.cuentaBancaria.findUnique.mockResolvedValue({
        cuentaId: 'cuenta-1',
        isActive: true,
      });
      mockTx.reconciliacionGasto.create.mockResolvedValue({});
      mockTx.cuentaBancaria.update.mockResolvedValue({});

      mockTransaction({
        producto: { ...mockProductoCompleto, stock: 55 },
        gastoCompra: mockGastoCompra,
        newProductInstance: null,
        compraProducto: { compraProductoId: 'compra-1' },
        workflowResult: mockWorkflowResult,
      });

      const result = await restockProductoAction(validRestockInput);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.producto.stock).toBe(55);
      expect(result.data!.gastoCompra.cantidad).toBe(5);
    });

    // ── 3.3: Restock con PAGO_COMPLETO ──

    it('PAGO_COMPLETO: crea GastoCompra PAGADA y decrementa cuenta', async () => {
      mockTx.producto.update.mockResolvedValue({
        ...mockProductoCompleto,
        stock: 60,
      });
      mockTx.gastoCompra.create.mockResolvedValue({
        ...mockGastoCompra,
        gastoCompraId: 'gasto-pago-1',
      });
      mockTx.compraProducto.create.mockResolvedValue({
        compraProductoId: 'compra-pago-1',
      });
      mockTx.tipoPago.findFirst.mockResolvedValue({
        tipoId: 'tipo-1',
        cuentaDefecto: 'cuenta-1',
      });
      mockTx.cuentaBancaria.findUnique.mockResolvedValue({
        cuentaId: 'cuenta-1',
        isActive: true,
      });
      mockTx.reconciliacionGasto.create.mockResolvedValue({});
      mockTx.cuentaBancaria.update.mockResolvedValue({});

      mockTransaction({
        producto: { ...mockProductoCompleto, stock: 60 },
        gastoCompra: {
          ...mockGastoCompra,
          gastoCompraId: 'gasto-pago-1',
        },
        newProductInstance: null,
        compraProducto: { compraProductoId: 'compra-pago-1' },
        workflowResult: mockWorkflowResult,
      });

      const result = await restockProductoAction({
        productoId: 'prod-1',
        cantidad: 10,
        precioCosto: 100,
        formaPago: 'PAGO_COMPLETO',
        estado: 'PAGADA',
        cuentaId: 'cuenta-1',
      });

      expect(result.success).toBe(true);
      // Verificar que se llamó a reconcile y update de cuenta
      expect(mockTx.reconciliacionGasto.create).toHaveBeenCalled();
      expect(mockTx.cuentaBancaria.update).toHaveBeenCalled();
    });

    // ── 3.4: Restock con PAGO_PARCIAL ──

    it('PAGO_PARCIAL: crea CuentaPorPagar y NO decrementa cuenta', async () => {
      mockTx.producto.update.mockResolvedValue({
        ...mockProductoCompleto,
        stock: 60,
      });
      mockTx.gastoCompra.create.mockResolvedValue({
        ...mockGastoCompra,
        gastoCompraId: 'gasto-parcial-1',
      });
      mockTx.compraProducto.create.mockResolvedValue({
        compraProductoId: 'compra-parcial-1',
      });
      mockTx.tipoPago.findFirst.mockResolvedValue(null);
      mockTx.cuentaBancaria.findUnique.mockResolvedValue(null);
      mockTx.cuentaPorPagar.create.mockResolvedValue({
        cuentaPorPagarId: 'cpp-1',
        montoDeuda: 500,
        saldoPendiente: 500,
        estado: 'PENDIENTE',
      });

      mockTransaction({
        producto: { ...mockProductoCompleto, stock: 60 },
        gastoCompra: {
          ...mockGastoCompra,
          gastoCompraId: 'gasto-parcial-1',
        },
        newProductInstance: null,
        compraProducto: { compraProductoId: 'compra-parcial-1' },
        workflowResult: mockWorkflowResult,
      });

      const result = await restockProductoAction({
        productoId: 'prod-1',
        cantidad: 10,
        precioCosto: 50,
        formaPago: 'PAGO_PARCIAL',
        estado: 'PENDIENTE',
      });

      expect(result.success).toBe(true);
      // NO debe llamar reconciliacion ni update de cuenta
      expect(mockTx.reconciliacionGasto.create).not.toHaveBeenCalled();
      expect(mockTx.cuentaBancaria.update).not.toHaveBeenCalled();
      // Debe crear CuentaPorPagar
      expect(mockTx.cuentaPorPagar.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estado: 'PENDIENTE',
          }),
        }),
      );
    });

    // ── 3.5: Restock con moneda extranjera ──

    it('moneda extranjera: maneja conversión de moneda correctamente', async () => {
      mockTx.producto.update.mockResolvedValue({
        ...mockProductoCompleto,
        stock: 55,
      });
      mockTx.gastoCompra.create.mockResolvedValue({
        ...mockGastoCompra,
        gastoCompraId: 'gasto-usd-1',
        total: 250, // 5 * 50 USD
      });
      mockTx.compraProducto.create.mockResolvedValue({
        compraProductoId: 'compra-usd-1',
      });
      mockTx.tipoPago.findFirst.mockResolvedValue({
        tipoId: 'tipo-1',
        cuentaDefecto: 'cuenta-1',
      });
      mockTx.cuentaBancaria.findUnique.mockResolvedValue({
        cuentaId: 'cuenta-1',
        isActive: true,
      });
      mockTx.reconciliacionGasto.create.mockResolvedValue({});
      mockTx.cuentaBancaria.update.mockResolvedValue({});

      mockTransaction({
        producto: { ...mockProductoCompleto, stock: 55 },
        gastoCompra: {
          ...mockGastoCompra,
          gastoCompraId: 'gasto-usd-1',
          total: 250,
        },
        newProductInstance: null,
        compraProducto: { compraProductoId: 'compra-usd-1' },
        workflowResult: mockWorkflowResult,
      });

      const result = await restockProductoAction({
        productoId: 'prod-1',
        cantidad: 5,
        precioCosto: 50,
        formaPago: 'PAGO_COMPLETO',
        moneda: 'USD',
        tasaCambio: 24,
        montoConvertido: 1200,
        monedaOriginal: 'USD',
        montoOriginal: 250,
      });

      expect(result.success).toBe(true);
      // Verificar que la reconciliación usa datos de moneda extranjera
      expect(mockTx.reconciliacionGasto.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            moneda: 'USD',
            tasaCambio: 24,
            montoConvertido: 1200,
          }),
        }),
      );
      // El saldo se decrementa con montoConvertido (1200 CUP)
      expect(mockTx.cuentaBancaria.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { saldo: { decrement: 1200 } },
        }),
      );
    });

    // ── 3.8: tipoRestock = nueva_instancia ──

    it('tipoRestock nueva_instancia: crea nuevo producto y aplica restock a copia', async () => {
      const mockNewInstance = {
        ...mockProductoCompleto,
        id: 'prod-new-1',
        nombre: 'Producto Test',
        stock: 5,
        precioCosto: 120,
        precioVenta: 180,
        vendorId: 'vendor-1',
        almacenId: 'almacen-1',
        codigoInterno: '12345678901',
        categoriaId: 'cat-1',
        categoria: { catId: 'cat-1', nombre: 'Categoría Test' },
        unidad: { unidadId: 'unidad-1', simbolo: 'u' },
        vendor: { vendorId: 'vendor-1', nombre: 'Vendor Test' },
        almacen: { almacenId: 'almacen-1', nombre: 'Almacén Test' },
      };

      const newInstanceWorkflow = {
        needsNewInstance: true,
        reason: 'both_prices_changed' as const,
        originalProductUpdate: {
          id: 'prod-1',
          newStock: 50, // original no cambia
          newPrecioCosto: 100,
          newPrecioVenta: 200,
        },
        newInstance: {
          data: {
            nombre: 'Producto Test',
            descripcion: null,
            codigoInterno: '12345678901',
            precioCosto: 120,
            precioVenta: 180,
            stock: 5,
            fotos: [],
            categoriaId: 'cat-1',
            unidadId: 'unidad-1',
            vendorId: 'vendor-1',
            almacenId: 'almacen-1',
            puntoDeVentaId: null,
          },
          stock: 5,
          linking: {
            originalProductId: 'prod-1',
            newProductId: 'temp-id',
            sharedAttributes: {},
            linkingType: 'price_variant',
            createdAt: new Date().toISOString(),
          },
        },
        weightedAverages: mockWorkflowResult.weightedAverages,
      };

      vi.mocked(executeProductInstanceCreationWorkflow).mockReturnValue(
        newInstanceWorkflow,
      );
      mockTx.producto.create.mockResolvedValue(mockNewInstance);
      mockTx.gastoCompra.create.mockResolvedValue({
        ...mockGastoCompra,
        productoId: 'prod-new-1',
        gastoCompraId: 'gasto-new-1',
      });
      mockTx.compraProducto.create.mockResolvedValue({
        compraProductoId: 'compra-new-1',
      });
      // Proveer cuenta para flujo PAGO_COMPLETO
      mockTx.tipoPago.findFirst.mockResolvedValue({
        tipoId: 'tipo-1',
        cuentaDefecto: 'cuenta-1',
      });
      mockTx.cuentaBancaria.findUnique.mockResolvedValue({
        cuentaId: 'cuenta-1',
        isActive: true,
      });
      mockTx.reconciliacionGasto.create.mockResolvedValue({});
      mockTx.cuentaBancaria.update.mockResolvedValue({});
      mockTx.cuentaPorPagar.create.mockResolvedValue({});
      // También mockear findUnique dentro de la transacción (para re-fetch del original)
      mockTx.producto.findUnique.mockResolvedValue(mockProductoCompleto);

      mockTransaction({
        producto: mockNewInstance,
        gastoCompra: {
          ...mockGastoCompra,
          productoId: 'prod-new-1',
          gastoCompraId: 'gasto-new-1',
        },
        newProductInstance: mockNewInstance,
        compraProducto: { compraProductoId: 'compra-new-1' },
        workflowResult: newInstanceWorkflow,
      });

      const result = await restockProductoAction({
        productoId: 'prod-1',
        cantidad: 5,
        precioCosto: 120,
        precioVenta: 180,
        tipoRestock: 'nueva_instancia',
      });

      expect(result.success).toBe(true);
      // El producto retornado debe ser la nueva instancia
      expect(result.data!.producto.id).toBe('prod-new-1');
      // Debe haber creado la nueva instancia
      expect(mockTx.producto.create).toHaveBeenCalled();
      // NO debe haber actualizado el original
      expect(mockTx.producto.update).not.toHaveBeenCalled();
    });

    // ── Auth / Tenant ──

    it('retorna AUTH_REQUIRED sin usuario autenticado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await restockProductoAction(validRestockInput);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
