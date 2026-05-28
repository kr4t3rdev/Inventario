import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    receta: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    producto: {
      findUnique: vi.fn(),
    },
    ordenProduccion: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (fn: Function) => async (request: NextRequest, params?: unknown) =>
    fn(request, params, { userId: 'user-test', tenantId: 'tenant-1', role: 'admin' }),
  withAuthPost: (fn: Function) => async (request: NextRequest, params?: unknown) =>
    fn(request, params, { userId: 'user-test', tenantId: 'tenant-1', role: 'admin' }),
}));

vi.mock('@/lib/utils/produccion', () => ({
  calculateCostoUnitarioReceta: vi.fn(() => 10),
}));

import { prisma } from '@/lib/prisma';
import { POST as createReceta } from '../recetas/route';
import { POST as createOrden } from '../ordenes/route';

describe('production recipe output guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza crear receta sin producto de salida', async () => {
    const request = new NextRequest('http://localhost/api/produccion/recetas', {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Jarabe 1L',
        rendimiento: 1,
      }),
    });

    const response = await createReceta(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/producto final/i);
  });

  it('rechaza crear orden con receta legacy sin producto configurado', async () => {
    vi.mocked(prisma.receta.findUnique).mockResolvedValueOnce({
      recetaId: 'receta-1',
      productoId: null,
      RecetaIngrediente: [],
    } as never);

    const request = new NextRequest('http://localhost/api/produccion/ordenes', {
      method: 'POST',
      body: JSON.stringify({
        recetaId: 'receta-1',
        cantidad: 2,
      }),
    });

    const response = await createOrden(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/producto final/i);
    expect(prisma.ordenProduccion.create).not.toHaveBeenCalled();
  });
});
