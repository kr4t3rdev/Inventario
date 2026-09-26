/**
 * @description Tests para aislamiento tenant de servicios y VentaServicios en facturarOfertaWorkflow.
 * Cuando una oferta mixta (producto + servicio) se factura, el workflow debe revalidar
 * el servicio por tenant dentro de la transacción.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTx = {
  serieFacturacion: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  oferta: { update: vi.fn() },
  venta: { create: vi.fn() },
  ventaServicios: { create: vi.fn() },
  factura: { create: vi.fn() },
  producto: { findUnique: vi.fn(), findFirst: vi.fn() },
  stockUbicacion: { findUnique: vi.fn() },
  servicios: { findFirst: vi.fn() },
};

vi.mock('@/lib/services/stock-ubicacion-service', () => ({
  upsertStockUbicacion: vi.fn(),
}));
vi.mock('@/lib/services/fifo-allocation', () => ({
  allocateFifoForSale: vi.fn(),
}));
vi.mock('@/features/ventas/services/facturacion-workflow', () => ({
  applyFacturacionCobroWorkflow: vi.fn(),
}));

import { facturarOfertaWorkflow } from '@/features/ofertas/services/facturar-oferta-workflow';
import { applyFacturacionCobroWorkflow } from '@/features/ventas/services/facturacion-workflow';

describe('facturarOfertaWorkflow – aislamiento de servicios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(applyFacturacionCobroWorkflow).mockResolvedValue({
      tipoVencimiento: 'contra_pago',
      reconciliacionId: null,
    } as any);
    mockTx.serieFacturacion.findFirst.mockResolvedValue({
      serieId: 'serie-1', prefijo: 'FV', consecutivo: 1, esPorDefecto: true,
    } as any);
    mockTx.serieFacturacion.update.mockResolvedValue({ consecutivo: 2 });
    mockTx.venta.create.mockResolvedValue({ ventaId: 'ven-1' });
    mockTx.factura.create.mockResolvedValue({ idFactura: 'fac-1' });
    mockTx.producto.findUnique.mockResolvedValue({
      id: 'prod-1', nombre: 'Producto', tenantId: 'tenant-A', precioCosto: 5,
    } as any);
    mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 10 });
  });

  it('rechaza cuando el servicio pertenece a otro tenant', async () => {
    mockTx.servicios.findFirst.mockResolvedValue(null);

    await expect(
      facturarOfertaWorkflow(mockTx as any, {
        tenantId: 'tenant-A',
        ofertaId: 'of-b',
        clienteId: 'cli-1',
        puntoDeVentaId: 'pv-1',
        items: [],
        servicios: [{
          servicioId: 'srv-b',
          cantidad: 1,
          precioUnitario: 100,
          total: 100,
          moneda: 'CUP',
        }],
        subtotal: 100,
        impuestos: 0,
        total: 100,
        observaciones: null,
        cargoTransporte: 0,
        serieId: null,
        tipoVencimiento: null,
        fechaVencimiento: null,
        cuentaBancariaId: null,
        usuarioId: 'user-1',
      }),
    ).rejects.toThrow('Servicio no encontrado');

    expect(mockTx.servicios.findFirst).toHaveBeenCalledWith({
      where: { servicioId: 'srv-b', tenantId: 'tenant-A' },
      select: { servicioId: true, moneda: true, nombre: true },
    });
  });

  it('crea VentaServicios cuando el servicio pertenece al tenant', async () => {
    mockTx.servicios.findFirst.mockResolvedValue({
      servicioId: 'srv-1', moneda: 'CUP', nombre: 'Srv',
    });
    mockTx.ventaServicios.create.mockResolvedValue({ ventaServicioId: 'vs-1' });

    const resultado = await facturarOfertaWorkflow(mockTx as any, {
      tenantId: 'tenant-A',
      ofertaId: 'of-1',
      clienteId: 'cli-1',
      puntoDeVentaId: 'pv-1',
      items: [],
      servicios: [{
        servicioId: 'srv-1', cantidad: 1, precioUnitario: 100, total: 100, moneda: 'CUP',
      }],
      subtotal: 100,
      impuestos: 0,
      total: 100,
      observaciones: null,
      cargoTransporte: 0,
      serieId: null,
      tipoVencimiento: null,
      fechaVencimiento: null,
      cuentaBancariaId: null,
      usuarioId: 'user-1',
    });

    expect(resultado.ventaId).toBe('ven-1');
    expect(mockTx.ventaServicios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-A',
          servicioId: 'srv-1',
          total: 100,
        }),
      }),
    );
  });

  it('usa la moneda real del servicio dentro de la transacción', async () => {
    mockTx.servicios.findFirst.mockResolvedValue({
      servicioId: 'srv-1', moneda: 'USD', nombre: 'Srv USD',
    });
    mockTx.ventaServicios.create.mockResolvedValue({ ventaServicioId: 'vs-1' });

    await facturarOfertaWorkflow(mockTx as any, {
      tenantId: 'tenant-A',
      ofertaId: 'of-2',
      clienteId: 'cli-1',
      puntoDeVentaId: 'pv-1',
      items: [],
      servicios: [{ servicioId: 'srv-1', cantidad: 1, precioUnitario: 50, total: 50, moneda: 'CUP' }],
      subtotal: 50, impuestos: 0, total: 50, observaciones: null, cargoTransporte: 0,
      serieId: null, tipoVencimiento: null, fechaVencimiento: null, cuentaBancariaId: null,
      usuarioId: 'user-1',
    });

    expect(mockTx.ventaServicios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ moneda: 'USD' }),
      }),
    );
  });
});
