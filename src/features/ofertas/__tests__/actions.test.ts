/**
 * @description Tests unitarios para Server Actions de ofertas.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from "@/test/action-response";

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/ventas/services/facturacion-workflow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/ventas/services/facturacion-workflow')>();
  return { ...actual, applyFacturacionCobroWorkflow: vi.fn() };
});
vi.mock('@/lib/services/anticipos-workflow', () => ({ applyAnticipoAllocations: vi.fn() }));
vi.mock('@/features/turnos-pos', () => ({ getOrCreateTurnoActivo: vi.fn() }));
vi.mock('@/lib/services/fifo-allocation', () => ({ allocateFifoForSale: vi.fn() }));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({ upsertStockUbicacion: vi.fn() }));

const mockTx = {
  $executeRaw: vi.fn(),
  oferta: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  venta: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
  ventaServicios: { create: vi.fn() },
  servicios: { findFirst: vi.fn() },
  factura: { create: vi.fn() },
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
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      delete: vi.fn(),
    },
    cliente: { findFirst: vi.fn() },
    listaPrecio: { findFirst: vi.fn() },
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

const mockCliente = {
  clienteId: 'cli-1',
  tenantId: 'tenant-test',
  nombre: 'Test',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  direccion: null,
  logoUrl: null,
  numeroContrato: null,
  numeroCuentaCUP: null,
  numeroCuentaUSD: null,
  telefono: null,
  listaPrecioId: null,
  taxIdCliente: null,
  limiteCredito: null,
};

describe('Ofertas Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.oferta.updateMany.mockResolvedValue({ count: 1 } as any);
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
      expect(expectActionFailure(result).error!.code).toBe('NOT_FOUND');
    });
  });

  describe('createOfertaAction', () => {
    it('crea oferta exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: 'cli-1', nombre: 'Test' } as any);
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

    it('E-1 reintenta la creación cuando el número colisiona (P2002)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue(mockCliente);
      vi.mocked(prisma.producto.findFirst).mockResolvedValue({
        id: 'prod-1', tenantId: 'tenant-test', precioVenta: 1000, precios: [],
      } as any);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ numeroOferta: 'OF-000006' } as any);
      const p2002 = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      vi.mocked(prisma.oferta.create)
        .mockRejectedValueOnce(p2002)
        .mockResolvedValueOnce({ ofertaId: 'of-1', numeroOferta: 'OF-000007' } as any);

      const result = await createOfertaAction({
        clienteId: 'cli-1', subtotal: 1000, impuestos: 0, total: 1000,
        items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 1000, total: 1000 }],
      });

      expect(result.success).toBe(true);
      expect(prisma.oferta.create).toHaveBeenCalledTimes(2);
    });

    it('resuelve el precio con la cadena cliente > default del tenant (LP-1.3)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      // Cliente sin lista; el tenant tiene una default con entrada 120.
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
        clienteId: 'cli-1', nombre: 'Test', listaPrecioId: null,
      } as any);
      vi.mocked(prisma.listaPrecio.findFirst).mockResolvedValue({ id: 'lp-default' } as any);
      vi.mocked(prisma.producto.findFirst).mockResolvedValue({
        id: 'prod-1', tenantId: 'tenant-test', precioVenta: 1000,
        precios: [{ listaPrecioId: 'lp-default', precio: 120 }],
      } as any);
      vi.mocked(prisma.oferta.create).mockResolvedValue({ ofertaId: 'of-1' } as any);

      const result = await createOfertaAction({
        clienteId: 'cli-1', subtotal: 1000, impuestos: 0, total: 1000,
        items: [{ productoId: 'prod-1', cantidad: 2, precioUnitario: 1000, total: 2000 }],
      });

      expect(result.success).toBe(true);
      // El server re-resuelve: la default del tenant (120) manda sobre el
      // precio base (1000) y sobre el precioUnitario que mandó el cliente.
      expect(prisma.oferta.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: {
              create: [expect.objectContaining({ precioUnitario: 120, total: 240 })],
            },
          }),
        }),
      );
      // El lookup de la default va scoped al tenant.
      expect(prisma.listaPrecio.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-test', esDefault: true }),
        }),
      );
    });

    it('la lista del cliente gana sobre la default del tenant en ofertas', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
        clienteId: 'cli-1', nombre: 'Test', listaPrecioId: 'lp-cliente',
      } as any);
      vi.mocked(prisma.listaPrecio.findFirst).mockResolvedValue({ id: 'lp-default' } as any);
      vi.mocked(prisma.producto.findFirst).mockResolvedValue({
        id: 'prod-1', tenantId: 'tenant-test', precioVenta: 1000,
        precios: [
          { listaPrecioId: 'lp-default', precio: 120 },
          { listaPrecioId: 'lp-cliente', precio: 100 },
        ],
      } as any);
      vi.mocked(prisma.oferta.create).mockResolvedValue({ ofertaId: 'of-2' } as any);

      const result = await createOfertaAction({
        clienteId: 'cli-1', subtotal: 1000, impuestos: 0, total: 1000,
        items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 1000, total: 1000 }],
      });

      expect(result.success).toBe(true);
      expect(prisma.oferta.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: {
              create: [expect.objectContaining({ precioUnitario: 100, total: 100 })],
            },
          }),
        }),
      );
    });

    it('E-3 rechaza impuestos que superan el subtotal resuelto (TAX_INVALID)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue(mockCliente);
      vi.mocked(prisma.producto.findFirst).mockResolvedValue({
        id: 'prod-1', tenantId: 'tenant-test', precioVenta: 100, precios: [],
      } as any);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue(null);

      const result = await createOfertaAction({
        clienteId: 'cli-1', subtotal: 200, impuestos: 500, total: 700,
        items: [{ productoId: 'prod-1', cantidad: 2, precioUnitario: 100, total: 200 }],
      });

      expect(result.success).toBe(false);
      if (result.success) throw new Error("Expected action failure");
      expect(result.error!.code).toBe('TAX_INVALID');
      expect(prisma.oferta.create).not.toHaveBeenCalled();
    });

    it('E-3 ignora subtotal/total del payload y persiste montos recalculados', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue(mockCliente);
      vi.mocked(prisma.producto.findFirst).mockResolvedValue({
        id: 'prod-1', tenantId: 'tenant-test', precioVenta: 100, precios: [],
      } as any);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.oferta.create).mockResolvedValue({ id: 'of-1' } as any);

      const result = await createOfertaAction({
        clienteId: 'cli-1', subtotal: 1, impuestos: 40, total: 99999,
        items: [{ productoId: 'prod-1', cantidad: 2, precioUnitario: 9999, total: 9999 }],
      });

      expect(result.success).toBe(true);
      expect(prisma.oferta.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 200,
            impuestos: 40,
            total: 240,
            items: { create: [expect.objectContaining({ precioUnitario: 100, total: 200 })] },
          }),
        }),
      );
    });
  });

  describe('updateOfertaAction', () => {
    it('actualiza estado exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ id: 'of-1', estado: 'PENDIENTE' } as any);
      vi.mocked(prisma.oferta.updateMany).mockResolvedValue({ count: 1 } as any);

      mockTx.oferta.findFirst.mockResolvedValue({ id: 'of-1', estado: 'PENDIENTE' });
      const result = await updateOfertaAction({ ofertaId: 'of-1', estado: 'ACEPTADA' });
      expect(result.success).toBe(true);
    });
  });

  describe('facturarOfertaAction', () => {
		it('bloquea facturar oferta a plazo cuando Básico no incluye CxC', async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				role: 'manager',
				planFeatures: { ofertas: true, 'cuentas-cobrar': false },
			} as AuthenticatedUser);

			const result = await facturarOfertaAction({
				ofertaId: 'of-1',
				puntoDeVentaId: 'pv-1',
				tipoVencimiento: 'plazo',
				fechaVencimiento: '2026-11-15',
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error?.code).toBe('FEATURE_NOT_AVAILABLE');
			expect(prisma.$transaction).not.toHaveBeenCalled();
		});

		it('does not gate a workflow alias that normalizes to immediate payment', async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				role: 'manager',
				planFeatures: { ofertas: true, 'cuentas-cobrar': false },
			} as AuthenticatedUser);

			const result = await facturarOfertaAction({
				ofertaId: 'of-1',
				puntoDeVentaId: 'pv-1',
				tipoVencimiento: 'contraentrega',
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error?.code).not.toBe('FEATURE_NOT_AVAILABLE');
		});

		it('blocks a blank maturity alias when a due date means the invoice is on credit', async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				role: 'manager',
				planFeatures: { ofertas: true, 'cuentas-cobrar': false },
			} as AuthenticatedUser);

			const result = await facturarOfertaAction({
				ofertaId: 'of-1',
				puntoDeVentaId: 'pv-1',
				tipoVencimiento: '',
				fechaVencimiento: '2026-11-15',
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error?.code).toBe('FEATURE_NOT_AVAILABLE');
			expect(prisma.$transaction).not.toHaveBeenCalled();
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
      mockTx.oferta.findFirst.mockResolvedValue({
        id: 'of-1', numeroOferta: 'OF-000001', estado: 'PENDIENTE', clienteId: 'cli-1',
        tenantId: 'tenant-test', subtotal: 1000, impuestos: 0, total: 1000,
        items: [{ productoId: 'prod-1', servicioId: null, cantidad: 2, precioUnitario: 500, total: 1000 }],
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
      mockTx.oferta.findFirst.mockResolvedValue({
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

    it('factura con los ítems releídos dentro de la transacción (bajo lock advisory)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      // Lectura externa obsoleta: el usuario cargó el detalle antes de una edición.
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({
        id: 'of-1', estado: 'PENDIENTE', clienteId: 'cli-1', tenantId: 'tenant-test',
        subtotal: 1000, impuestos: 0, total: 1000,
        items: [{ productoId: 'prod-1', servicioId: null, cantidad: 2, precioUnitario: 500, total: 1000 }],
        cliente: { clienteId: 'cli-1', nombre: 'Test' },
      } as any);
      // Lectura fresca dentro de la tx: una edición concurrente ya cambió los ítems.
      mockTx.oferta.findFirst.mockResolvedValue({
        id: 'of-1', estado: 'PENDIENTE', clienteId: 'cli-1', tenantId: 'tenant-test',
        subtotal: 240, impuestos: 0, total: 240,
        items: [{ productoId: 'prod-1', servicioId: null, cantidad: 2, precioUnitario: 120, total: 240 }],
        cliente: { clienteId: 'cli-1', nombre: 'Test' },
      } as any);
      mockTx.serieFacturacion.findFirst.mockResolvedValue({ serieId: 'serie-1', prefijo: 'FV', consecutivo: 5, esPorDefecto: true });
      mockTx.serieFacturacion.update.mockResolvedValue({ serieId: 'serie-1', consecutivo: 6 });
      mockTx.venta.create.mockResolvedValue({ ventaId: 'ven-1' });
      mockTx.factura.create.mockResolvedValue({ idFactura: 'fac-1' });
      mockTx.producto.findUnique.mockResolvedValue({ id: 'prod-1', nombre: 'P', tenantId: 'tenant-test' });
      mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 10 });
      vi.mocked(applyFacturacionCobroWorkflow).mockResolvedValue({ tipoVencimiento: 'contra_pago', reconciliacionId: 'rec-1' });

      const result = await facturarOfertaAction({ ofertaId: 'of-1', puntoDeVentaId: 'pv-1' });

      expect(result.success).toBe(true);
      expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(mockTx.venta.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            total: 240,
            items: { create: [expect.objectContaining({ precioUnitario: 120, total: 240 })] },
          }),
        }),
      );
      expect(mockTx.oferta.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'of-1', estado: 'PENDIENTE' }),
          data: { estado: 'FACTURADA' },
        }),
      );
    });

    it('aborta la facturación cuando el claim de FACTURADA pierde la carrera', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      const ofertaFacturable = {
        id: 'of-1', estado: 'PENDIENTE', clienteId: 'cli-1', tenantId: 'tenant-test',
        subtotal: 1000, impuestos: 0, total: 1000,
        items: [{ productoId: 'prod-1', servicioId: null, cantidad: 2, precioUnitario: 500, total: 1000 }],
        cliente: { clienteId: 'cli-1', nombre: 'Test' },
      };
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue(ofertaFacturable as any);
      mockTx.oferta.findFirst.mockResolvedValue(ofertaFacturable as any);
      mockTx.oferta.updateMany.mockResolvedValue({ count: 0 });
      mockTx.serieFacturacion.findFirst.mockResolvedValue({ serieId: 'serie-1', prefijo: 'FV', consecutivo: 5, esPorDefecto: true });
      mockTx.serieFacturacion.update.mockResolvedValue({ serieId: 'serie-1', consecutivo: 6 });
      mockTx.venta.create.mockResolvedValue({ ventaId: 'ven-1' });
      mockTx.factura.create.mockResolvedValue({ idFactura: 'fac-1' });
      mockTx.producto.findUnique.mockResolvedValue({ id: 'prod-1', nombre: 'P', tenantId: 'tenant-test' });
      mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 10 });
      vi.mocked(applyFacturacionCobroWorkflow).mockResolvedValue({ tipoVencimiento: 'contra_pago', reconciliacionId: 'rec-1' });

      const result = await facturarOfertaAction({ ofertaId: 'of-1', puntoDeVentaId: 'pv-1' });

      expect(result.success).toBe(false);
      if (result.success) throw new Error("Expected action failure");
      expect(result.error!.code).toBe('VALIDATION_ERROR');
      if (result.success) throw new Error("Expected action failure");
      expect(result.error!.message).toContain('cambió de estado');
    });

    it('rechaza oferta ya facturada', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({
        ofertaId: 'of-1', estado: 'FACTURADA', tenantId: 'tenant-test',
      } as any);

      const result = await facturarOfertaAction({ ofertaId: 'of-1', puntoDeVentaId: 'pv-1' });

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error!.message).toContain('ya fue facturada');
    });

    it('usa contexto FACTURA_OFERTA al aplicar anticipos', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({
        id: 'of-1', estado: 'PENDIENTE', clienteId: 'cli-1',
        tenantId: 'tenant-test', subtotal: 1000, impuestos: 0, total: 1000,
        items: [],
        cliente: { clienteId: 'cli-1', nombre: 'Test' },
      } as any);
      mockTx.oferta.findFirst.mockResolvedValue({
        id: 'of-1', estado: 'PENDIENTE', clienteId: 'cli-1', tenantId: 'tenant-test',
        subtotal: 1000, impuestos: 0, total: 1000, items: [],
        cliente: { clienteId: 'cli-1', nombre: 'Test' },
      } as any);
      vi.mocked(applyFacturacionCobroWorkflow).mockResolvedValue({ ventaId: 'ven-1' } as any);
      vi.mocked(applyAnticipoAllocations).mockResolvedValue([]);
      mockTx.factura.create.mockResolvedValue({ idFactura: 'fac-1' });

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
    });
  });

  describe('deleteOfertaAction', () => {
    it('elimina oferta exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ ofertaId: 'of-1' } as any);
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
      expect(expectActionFailure(result).error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
