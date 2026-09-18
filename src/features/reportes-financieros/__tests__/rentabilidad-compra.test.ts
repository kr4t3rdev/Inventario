import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    compraDocumento: { findFirst: vi.fn() },
    purchaseAllocation: { findMany: vi.fn() },
  },
}));
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getRentabilidadCompraAction } from '@/features/reportes-financieros/actions-rentabilidad-compra';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const u: AuthenticatedUser = {
  userId: 'u1',
  name: 'T',
  email: 't@t.com',
  role: 'admin',
  isActive: true,
  tenantId: 't1',
  tenantRole: 'admin',
};

describe('getRentabilidadCompraAction — ingresos proporcionales a la asignación FIFO', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calcula ingresos como cantidad asignada × precioUnitario, no el total de la línea completa', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue({
      compraDocumentoId: 'c1',
      numeroFactura: 'F-1',
      fechaCompra: new Date('2026-08-01T00:00:00.000Z'),
      total: 600,
      estado: 'COMPLETADA',
      formaPago: 'EFECTIVO',
      proveedor: { vendorId: 'v1', nombre: 'Proveedor' },
    items: [
        {
          compraDocumentoItemId: 'ci1',
          productoId: 'p1',
          cantidad: 10,
          precioUnitario: 60,
          totalLinea: 600,
          producto: { id: 'p1', nombre: 'Arroz' },
        },
      ],
    });

    // Una línea de venta de 10 uds a $100 (total $1000) fue satisfecha en
    // parte (3 uds) por esta compra. El ingreso correcto es 3 × $100 = $300,
    // no el total completo de la línea ($1000).
    vi.mocked(prisma.purchaseAllocation.findMany).mockResolvedValue([
      {
        cantidad: 3,
        ventaItem: {
          precioUnitario: 100,
          total: 1000,
          createdAt: new Date('2026-08-10T00:00:00.000Z'),
        },
      },
    ]);

    const r = await getRentabilidadCompraAction('c1');

    expect(r.success).toBe(true);
    const producto = r.data!.productos[0];
    expect(producto.unidadesVendidas).toBe(3);
    expect(producto.ingresos).toBe(300);
    expect(producto.costoVendido).toBe(180);
    expect(producto.ganancia).toBe(120);
    expect(producto.margen).toBe(40);
    expect(r.data!.resumen.totalVendido).toBe(300);
    expect(r.data!.resumen.costoTotalVendido).toBe(180);
    expect(r.data!.resumen.gananciaTotal).toBe(120);
  });
});