/**
 * @description Tests unitarios para Server Actions de ofertas.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/ventas/services/facturacion-workflow', () => ({ applyFacturacionCobroWorkflow: vi.fn() }));
vi.mock('@/lib/services/anticipos-workflow', () => ({ applyAnticipoAllocations: vi.fn() }));
vi.mock('@/features/turnos-pos', () => ({ getOrCreateTurnoActivo: vi.fn() }));
vi.mock('@/lib/services/fifo-allocation', () => ({ allocateFifoForSale: vi.fn() }));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({ upsertStockUbicacion: vi.fn() }));

const mockTx = {
  $queryRaw: vi.fn().mockResolvedValue([]),
  oferta: { update: vi.fn() },
  venta: { create: vi.fn() },
  ventaServicios: { create: vi.fn() },
  servicios: { findFirst: vi.fn() },
  cliente: { findFirst: vi.fn() },
  factura: { create: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  cuentaPorCobrar: {
    findFirst: vi.fn().mockResolvedValue({ id: 'cxc-1', monedaOriginal: 'CUP',
      monedaFuncional: 'CUP', montoOriginal: 1000, tasaCambio: 1,
      montoDeuda: 1000, montoDeudaFuncional: 1000 }),
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  serieFacturacion: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  producto: { findUnique: vi.fn() },
  stockUbicacion: { findUnique: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    oferta: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    cliente: { findFirst: vi.fn() },
    producto: { findFirst: vi.fn() },
    turnoPuntoVenta: { findFirst: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(mockTx)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getOfertasAction,
  getOfertaByIdAction,
  createOfertaAction,
  updateOfertaAction,
  deleteOfertaAction,
  facturarOfertaAction,
} from '@/features/ofertas/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { applyFacturacionCobroWorkflow } from '@/features/ventas/services/facturacion-workflow';
import { applyAnticipoAllocations } from '@/lib/services/anticipos-workflow';
import { getOrCreateTurnoActivo } from '@/features/turnos-pos';
import { allocateFifoForSale } from '@/lib/services/fifo-allocation';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'manager',
};

describe('Ofertas Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrCreateTurnoActivo).mockResolvedValue({
      success: true,
      data: { turnoId: 'turno-1' },
    } as any);
  });

  describe('getOfertasAction', () => {
    it('retorna lista del tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findMany).mockResolvedValue([]);
      const result = await getOfertasAction();
      expect(result.success).toBe(true);
    });
  });

  describe('getOfertaByIdAction', () => {
    it('retorna oferta por ID', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ ofertaId: 'of-1' } as any);
      const result = await getOfertaByIdAction('of-1');
      expect(result.success).toBe(true);
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue(null);
      const result = await getOfertaByIdAction('of-noexiste');
      expect(result.success).toBe(false);
      if (result.success) expect.unreachable('Se esperaba que la accion fallara');
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  describe('createOfertaAction', () => {
    it('crea oferta exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: 'cli-1', nombre: 'Test' } as never);
      vi.mocked(prisma.producto.findFirst).mockResolvedValue({
        id: 'prod-1', tenantId: 'tenant-test', precioVenta: 1000, precios: [],
      } as any);
      vi.mocked(prisma.oferta.create).mockResolvedValue({ ofertaId: 'of-1' } as any);

      const result = await createOfertaAction({
        clienteId: 'cli-1', subtotal: 1000, impuestos: 0, total: 1000,
        items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 1000, total: 1000 }],
      });

      expect(result.success).toBe(true);
    });

    it('rechaza si cliente no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null);

      const result = await createOfertaAction({
        clienteId: 'cli-noexiste', subtotal: 1000, impuestos: 0, total: 1000,
        items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 1000, total: 1000 }],
      });

      expect(result.success).toBe(false);
    });
  });

  describe('updateOfertaAction', () => {
    it('actualiza estado exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ ofertaId: 'of-1' } as never);
      vi.mocked(prisma.oferta.update).mockResolvedValue({} as any);

      const result = await updateOfertaAction({ ofertaId: 'of-1', estado: 'ACEPTADA' });
      expect(result.success).toBe(true);
    });
  });

  describe('facturarOfertaAction', () => {
    it('exige permiso de gestión de ofertas antes de consultar la oferta', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        ...mockUser,
        role: 'regularUser',
        tenantRole: 'manager',
        permissions: new Set<string>(),
        planFeatures: { ofertas: true },
      });

      const result = await facturarOfertaAction({ ofertaId: 'of-1', puntoDeVentaId: 'pv-1' });

      expect(result.success).toBe(false);
      if (result.success) expect.unreachable('Se esperaba que la accion fallara');
      expect(result.error!.code).toBe('FORBIDDEN');
      expect(prisma.oferta.findFirst).not.toHaveBeenCalled();
    });

    it('factura oferta exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({
        id: 'of-1', numeroOferta: 'OF-000001', estado: 'PENDIENTE', clienteId: 'cli-1',
        tenantId: 'tenant-test', subtotal: 1000, impuestos: 0, total: 1000,
        items: [{
          productoId: 'prod-1',
          servicioId: null,
          cantidad: 2,
          precioUnitario: 500,
          total: 1000,
        }],
        cliente: { clienteId: 'cli-1', nombre: 'Test' },
      } as any);
      mockTx.serieFacturacion.findFirst.mockResolvedValue({
        serieId: 'serie-1',
        prefijo: 'FV',
        consecutivo: 5,
        esPorDefecto: true,
      });
      mockTx.serieFacturacion.update.mockResolvedValue({
        serieId: 'serie-1',
        prefijo: 'FV',
        consecutivo: 6,
      });
      mockTx.venta.create.mockResolvedValue({ ventaId: 'ven-1' });
      mockTx.factura.create.mockResolvedValue({ idFactura: 'fac-1' });
      mockTx.producto.findUnique.mockResolvedValue({
        id: 'prod-1',
        nombre: 'Producto Test',
        tenantId: 'tenant-test',
      } as any);
      mockTx.stockUbicacion.findUnique.mockResolvedValue({
        cantidadDisponible: 10,
      } as any);
      vi.mocked(applyFacturacionCobroWorkflow).mockResolvedValue({
        tipoVencimiento: 'contra_pago',
        reconciliacionId: 'rec-1',
      });

      const result = await facturarOfertaAction({ ofertaId: 'of-1', puntoDeVentaId: 'pv-1' });

      expect(result.success).toBe(true);
      expect(mockTx.venta.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-test',
            puntoDeVentaId: 'pv-1',
            clienteId: 'cli-1',
            ofertaId: 'of-1',
            turnoId: 'turno-1',
            total: 1000,
          }),
        }),
      );
      expect(mockTx.factura.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ventaId: 'ven-1',
            clienteId: 'cli-1',
            serieId: 'serie-1',
          }),
        }),
      );
      expect(applyFacturacionCobroWorkflow).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          ventaId: 'ven-1',
          facturaId: 'fac-1',
          clienteId: 'cli-1',
          montoTotal: 1000,
          tenantId: 'tenant-test',
        }),
      );
      expect(upsertStockUbicacion).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          productoId: 'prod-1',
          tipoUbicacion: 'punto_venta',
          ubicacionId: 'pv-1',
          delta: -2,
        }),
      );
      expect(allocateFifoForSale).toHaveBeenCalledWith(mockTx, 'tenant-test', 'ven-1');
    });

    it('crea VentaItem y VentaServicios para una oferta mixta', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({
        id: 'of-mix', estado: 'PENDIENTE', clienteId: 'cli-1', tenantId: 'tenant-test',
        subtotal: 300, impuestos: 0, total: 300,
        items: [
          { productoId: 'prod-1', servicioId: null, cantidad: 2, precioUnitario: 100, total: 200 },
          { productoId: null, servicioId: 'srv-1', cantidad: 1, precioUnitario: 100, total: 100, servicio: { moneda: 'CUP' } },
        ],
        cliente: { clienteId: 'cli-1', nombre: 'Test' },
      } as any);
      mockTx.serieFacturacion.findFirst.mockResolvedValue({ serieId: 'serie-1', prefijo: 'FV', consecutivo: 1 });
      mockTx.serieFacturacion.update.mockResolvedValue({ consecutivo: 2 });
      mockTx.venta.create.mockResolvedValue({ ventaId: 'ven-mix' });
      mockTx.servicios.findFirst.mockResolvedValue({ servicioId: 'srv-1', moneda: 'CUP', nombre: 'Srv' });
      mockTx.ventaServicios.create.mockResolvedValue({ ventaServicioId: 'vs-1' });
      mockTx.factura.create.mockResolvedValue({ idFactura: 'fac-mix' });
      mockTx.producto.findUnique.mockResolvedValue({ id: 'prod-1', nombre: 'P', tenantId: 'tenant-test' });
      mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 10 });
      vi.mocked(applyFacturacionCobroWorkflow).mockResolvedValue({ tipoVencimiento: 'contra_pago', reconciliacionId: null });

      const result = await facturarOfertaAction({ ofertaId: 'of-mix', puntoDeVentaId: 'pv-1' });

      expect(result.success).toBe(true);
      expect(mockTx.servicios.findFirst).toHaveBeenCalledWith({
        where: { servicioId: 'srv-1', tenantId: 'tenant-test' },
        select: { servicioId: true, moneda: true, nombre: true },
      });
      expect(mockTx.venta.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          items: { create: [{ productoId: 'prod-1', cantidad: 2, precioUnitario: 100, total: 200 }] },
        }),
      }));
      expect(mockTx.ventaServicios.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ servicioId: 'srv-1', cantidad: 1, total: 100, moneda: 'CUP' }),
      }));
    });

    it('rechaza oferta ya facturada', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({
        ofertaId: 'of-1', estado: 'FACTURADA', tenantId: 'tenant-test',
      } as never);

      const result = await facturarOfertaAction({ ofertaId: 'of-1', puntoDeVentaId: 'pv-1' });

      expect(result.success).toBe(false);
      if (result.success) expect.unreachable('Se esperaba que la accion fallara');
      expect(result.error!.message).toContain('ya fue facturada');
    });

    it('usa contexto FACTURA_OFERTA al aplicar anticipos', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({
        id: 'of-1', estado: 'PENDIENTE', clienteId: 'cli-1',
        tenantId: 'tenant-test', subtotal: 1000, impuestos: 0, total: 1000,
        items: [],
        cliente: { clienteId: 'cli-1', nombre: 'Test' },
      } as any);
      vi.mocked(applyFacturacionCobroWorkflow).mockResolvedValue({
        ventaId: 'ven-1', facturaId: 'fac-1', tipoVencimiento: 'fecha', reconciliacionId: null,
      } as any);
      vi.mocked(applyAnticipoAllocations).mockResolvedValue([]);
      mockTx.factura.create.mockResolvedValue({ idFactura: 'fac-1' });
      // Gate de cupo (remediación): el anticipo crea CxC por vencimiento; el
      // validador bajo lock consulta límite y CxC del cliente en la tx.
      mockTx.cliente.findFirst.mockResolvedValue({ clienteId: 'cli-1', limiteCredito: null });
      mockTx.cuentaPorCobrar.findMany.mockResolvedValue([]);
      mockTx.cuentaPorCobrar.findFirst.mockResolvedValue({
        id: 'cxc-1', monedaOriginal: 'CUP', monedaFuncional: 'CUP', montoOriginal: 1000,
        tasaCambio: 1, montoDeuda: 1000, montoDeudaFuncional: 1000,
      });

      const result = await facturarOfertaAction({
        ofertaId: 'of-1',
        puntoDeVentaId: 'pv-1',
        anticipoCobroId: 'ant-1',
        idempotencyKey: 'idem-1',
      });

      expect(result.success).toBe(true);
      expect(applyAnticipoAllocations).toHaveBeenCalledWith(
        mockTx,
        [{ anticipoId: 'ant-1', montoAplicado: 1000 }],
        expect.objectContaining({
          documentoDestinoId: 'fac-1',
          contexto: 'FACTURA_OFERTA',
          usuarioId: 'user-1',
        }),
      );
      expect(applyFacturacionCobroWorkflow).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ tipoVencimiento: 'fecha', montoTotal: 1000 }),
      );
      expect(mockTx.cuentaPorCobrar.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ montoPagado: 1000, estado: 'PAGADA' }),
      }));
      expect(mockTx.factura.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: { estado: 'PAGADA' },
      }));
    });
  });

  describe('deleteOfertaAction', () => {
    it('elimina oferta exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ ofertaId: 'of-1' } as never);
      vi.mocked(prisma.oferta.delete).mockResolvedValue({} as any);
      const result = await deleteOfertaAction('of-1');
      expect(result.success).toBe(true);
    });
  });

  describe('auth requerido', () => {
    it('retorna AUTH_REQUIRED', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const result = await getOfertasAction();
      expect(result.success).toBe(false);
      if (result.success) expect.unreachable('Se esperaba que la accion fallara');
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
