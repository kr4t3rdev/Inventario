import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/lib/prisma', () => ({
  prisma: { stockMoveLine: { groupBy: vi.fn() }, producto: { findMany: vi.fn() } },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getRotacionInventarioAction } from '@/features/reportes-financieros/actions-rotacion';
import { calcularRotacionInventario, resolverPeriodoRotacion } from '../lib/rotacion-inventario';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const user: AuthenticatedUser = { userId: 'u1', name: 'Test', email: 't@t.com', role: 'admin', isActive: true, tenantId: 'tenant-1', tenantRole: 'manager' };
const periodo = { inicio: new Date('2026-10-01T00:00:00.000Z'), fin: new Date('2026-11-01T00:00:00.000Z') };
const nombres = new Map([['p1', 'Aceite']]);

describe('resolverPeriodoRotacion', () => {
  it('incluye el día final completo en UTC', () => {
    const resuelto = resolverPeriodoRotacion(new Date('2026-10-01T12:00:00Z'), new Date('2026-10-31T23:59:59Z'));
    expect(`${resuelto.inicio.toISOString()} - ${resuelto.fin.toISOString()}`).toBe('2026-10-01T00:00:00.000Z - 2026-11-01T00:00:00.000Z');
  });
});

describe('calcularRotacionInventario', () => {
  it('divide las salidas del periodo entre las existencias promedio', () => {
    const resultado = calcularRotacionInventario(
      { inicial: new Map([['p1', 20]]), final: new Map([['p1', 10]]), salidas: new Map([['p1', -10]]) }, nombres, periodo,
    );
    expect(resultado.porProducto[0]).toMatchObject({
      productoId: 'p1', productoNombre: 'Aceite', unidadesSalidas: 10, existenciasPromedio: 15, rotacion: 0.67, sinExistencias: false,
    });
  });

  it('reporta rotación 0 con existencias y sin salidas en el periodo', () => {
    const resultado = calcularRotacionInventario(
      { inicial: new Map([['p1', 8]]), final: new Map([['p1', 8]]), salidas: new Map() }, nombres, periodo,
    );
    expect(resultado.porProducto).toHaveLength(1);
    expect(resultado.porProducto[0]).toMatchObject({ unidadesSalidas: 0, rotacion: 0, sinExistencias: false });
  });

  it('omite productos sin existencias ni salidas y marca rotación nula con salidas sin stock', () => {
    const resultado = calcularRotacionInventario(
      { inicial: new Map(), final: new Map([['p1', 0], ['p2', 0]]), salidas: new Map([['p2', -3]]) },
      new Map([['p1', 'Vacío'], ['p2', 'Anomalía']]), periodo,
    );
    expect(resultado.porProducto.map((producto) => producto.productoId)).toEqual(['p2']);
    expect(resultado.porProducto[0]).toMatchObject({ rotacion: null, sinExistencias: true });
    expect(resultado.periodo.fin).toBe('2026-11-01T00:00:00.000Z');
    expect(resultado.definicion).toContain('existencias promedio');
  });
});

describe('getRotacionInventarioAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    vi.mocked(prisma.producto.findMany).mockResolvedValue([{ id: 'p1', nombre: 'Aceite' }] as never);
    vi.mocked(prisma.stockMoveLine.groupBy).mockResolvedValue([] as never);
  });

  it('calcula la rotación con el kardex del tenant y el periodo semiabierto', async () => {
    vi.mocked(prisma.stockMoveLine.groupBy)
      .mockResolvedValueOnce([{ productoId: 'p1', _sum: { cantidad: 20 } }] as never)
      .mockResolvedValueOnce([{ productoId: 'p1', _sum: { cantidad: 10 } }] as never)
      .mockResolvedValueOnce([{ productoId: 'p1', _sum: { cantidad: -10 } }] as never);

    const result = await getRotacionInventarioAction({ fechaDesde: new Date('2026-10-01'), fechaHasta: new Date('2026-10-31') });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('No se generó la rotación');
    expect(result.data.porProducto[0]).toMatchObject({ productoId: 'p1', unidadesSalidas: 10, rotacion: 0.67 });
    expect(prisma.stockMoveLine.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        createdAt: { gte: new Date('2026-10-01T00:00:00.000Z'), lt: new Date('2026-11-01T00:00:00.000Z') },
      }),
    }));
  });

  it('rechaza un periodo invertido sin consultar el kardex', async () => {
    const result = await getRotacionInventarioAction({ fechaDesde: new Date('2026-10-31'), fechaHasta: new Date('2026-10-01') });
    expect(result.success).toBe(false);
    expect(prisma.stockMoveLine.groupBy).not.toHaveBeenCalled();
  });
});
