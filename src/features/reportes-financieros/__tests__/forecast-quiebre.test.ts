import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/lib/prisma', () => ({
  prisma: { stockUbicacion: { groupBy: vi.fn() }, stockMoveLine: { groupBy: vi.fn() }, producto: { findMany: vi.fn() } },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getForecastQuiebreAction } from '@/features/reportes-financieros/actions-forecast';
import { calcularForecastQuiebre, resolverVentanaForecast } from '../lib/forecast-quiebre';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const user: AuthenticatedUser = { userId: 'u1', name: 'Test', email: 't@t.com', role: 'admin', isActive: true, tenantId: 'tenant-1', tenantRole: 'manager' };
const corte = new Date('2026-10-31T00:00:00.000Z');
const ventana = resolverVentanaForecast(corte, 30);
const nombre = new Map([['p1', 'Aceite']]);

describe('forecast de quiebre', () => {
  it('calcula ventana de N días hasta el final UTC de la fecha de corte', () => {
    expect(ventana.inicio.toISOString()).toBe('2026-10-02T00:00:00.000Z');
    expect(ventana.fin.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('estima días y fecha de quiebre con demanda suficiente', () => {
    const salida = [1, 5, 10].map((dia) => ({ productoId: 'p1', dia: `2026-10-${dia}`, unidades: 10 }));
    const res = calcularForecastQuiebre(new Map([['p1', 100]]), salida, nombre, ventana);
    expect(res.ventana).toMatchObject({ dias: 30, minDias: 7, maxDias: 180 });
    expect(res.porProducto[0]).toMatchObject({ disponibilidad: 100, consumoTotal: 30, diasActivos: 3, tasaDiaria: 1, diasHastaQuiebre: 100, estado: 'estimado' });
    expect(res.porProducto[0].fechaQuiebre).toBe('2027-02-08T00:00:00.000Z');
    expect(res.supuestos).toContain('reservas');
  });

  it('no estima con demanda cero ni con días activos insuficientes', () => {
    const res = calcularForecastQuiebre(
      new Map([['p1', 20], ['p2', 20]]), [{ productoId: 'p2', dia: '2026-10-01', unidades: 8 }], nombre, ventana,
    );
    expect(res.porProducto.find((p) => p.productoId === 'p1')).toMatchObject({ estado: 'sin_demanda', diasHastaQuiebre: null });
    expect(res.porProducto.find((p) => p.productoId === 'p2')).toMatchObject({ estado: 'datos_insuficientes', fechaQuiebre: null });
  });

  it('consulta stock disponible y salidas dentro de la ventana con tenant scope', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    vi.mocked(prisma.stockUbicacion.groupBy).mockResolvedValue([{ productoId: 'p1', _sum: { cantidadDisponible: 100 } }] as never);
    vi.mocked(prisma.stockMoveLine.groupBy).mockResolvedValue([{ productoId: 'p1', createdAt: new Date('2026-10-05T12:00:00Z'), _sum: { cantidad: -10 } }] as never);
    vi.mocked(prisma.producto.findMany).mockResolvedValue([{ id: 'p1', nombre: 'Aceite' }] as never);

    const res = await getForecastQuiebreAction({ fechaCorte: corte, ventanaDias: 30 });
    expect(res.success).toBe(true);
    expect(prisma.stockUbicacion.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-1' } }));
    expect(prisma.stockMoveLine.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      tenantId: 'tenant-1', tipoOrigen: 'VENTA', cantidad: { lt: 0 }, createdAt: { gte: ventana.inicio, lt: ventana.fin },
    }) }));
  });

  it('rechaza ventanas fuera de los límites', async () => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    const res = await getForecastQuiebreAction({ ventanaDias: 181 });
    expect(res.success).toBe(false);
    expect(prisma.stockMoveLine.groupBy).not.toHaveBeenCalled();
  });
});
