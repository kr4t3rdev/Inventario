import { describe, expect, it, vi, beforeEach } from 'vitest';
import { expectActionFailure, expectActionSuccess } from "@/test/action-response";

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    oferta: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    venta: { create: vi.fn() },
    ventaServicios: { create: vi.fn() },
    cliente: { findFirst: vi.fn() },
    listaPrecio: { findFirst: vi.fn() },
    producto: { findFirst: vi.fn() },
    servicios: { findFirst: vi.fn() },
  },
  default: {
    oferta: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    venta: { create: vi.fn() },
    ventaServicios: { create: vi.fn() },
    cliente: { findFirst: vi.fn() },
    listaPrecio: { findFirst: vi.fn() },
    producto: { findFirst: vi.fn() },
    servicios: { findFirst: vi.fn() },
  },
}));
vi.mock('pdf-lib', () => ({
  PDFDocument: { create: vi.fn() },
  StandardFonts: { Helvetica: 'Helvetica', HelveticaBold: 'HelveticaBold' },
  rgb: vi.fn(() => ({})),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/turnos-pos', () => ({ getOrCreateTurnoActivo: vi.fn() }));
vi.mock('@/features/ventas/services/facturacion-workflow', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/ventas/services/facturacion-workflow')>()),
  applyFacturacionCobroWorkflow: vi.fn(),
}));
vi.mock('@/lib/services/anticipos-workflow', () => ({ applyAnticipoAllocations: vi.fn() }));
vi.mock('@/lib/services/fifo-allocation', () => ({ allocateFifoForSale: vi.fn() }));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({ upsertStockUbicacion: vi.fn() }));

import { authenticateUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { getOfertaPdfHandler, getOfertaExcelHandler } from '@/features/ofertas/api/handlers';
import { createOfertaAction } from '@/features/ofertas/actions';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';

vi.mock('@/lib/server-actions/get-current-user');

const user = {
  userId: 'u-a', name: 'A', email: 'a@test.com', role: 'admin', isActive: true,
  tenantId: 'tenant-a', tenantRole: 'admin',
} as never;

function request(): any {
  return { nextUrl: new URL('http://localhost/api/ofertas/of-b') };
}

describe('F-02 ofertas, RED de correcciones urgentes', () => {
  beforeEach(() => vi.resetAllMocks());

  it('PDF sin sesión responde 401', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ status: 401 } as never);
    const response = await getOfertaPdfHandler(request(), { params: Promise.resolve({ id: 'of-b' }) });
    expect(response.status).toBe(401);
  });

  it('PDF de otro tenant responde 404', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue(null as never);
    const response = await getOfertaPdfHandler(request(), { params: Promise.resolve({ id: 'of-b' }) });
    expect(response.status).toBe(404);
  });

  it('Excel de otro tenant responde 404', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue(null as never);
    const response = await getOfertaExcelHandler(request(), { params: Promise.resolve({ id: 'of-b' }) });
    expect(response.status).toBe(404);
  });

  it('recalcula precio y totales desde el catálogo', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: 'cli-a' } as never);
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-a', tenantId: 'tenant-a', precioVenta: 700, precios: [],
    } as never);
    vi.mocked(prisma.oferta.create).mockResolvedValue({ id: 'of-a' } as never);

    const result = await createOfertaAction({
      clienteId: 'cli-a', subtotal: 50, impuestos: 10, total: 60,
      items: [{ productoId: 'prod-a', cantidad: 2, precioUnitario: 25, total: 50 }],
    } as never);

    expect(result.success).toBe(true);
    expect(prisma.oferta.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ subtotal: 1400, total: 1410 }),
    }));
  });

  it('rechaza producto de otro tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: 'cli-a' } as never);
    vi.mocked(prisma.producto.findFirst).mockResolvedValue(null as never);
    const result = await createOfertaAction({
      clienteId: 'cli-a', subtotal: 100, impuestos: 0, total: 100,
      items: [{ productoId: 'prod-b', cantidad: 1, precioUnitario: 100, total: 100 }],
    } as never);
    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('NOT_FOUND');
  });
});
