import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { NextRequest } from 'next/server';

const { prismaMock } = vi.hoisted(() => {
  const categoria = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const unidad = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const producto = {
    count: vi.fn(),
  };
  return { prismaMock: { categoria, unidad, producto } };
});

let currentTenantId: string | null = 'tenant-1';

vi.mock('@/lib/prisma', async () => {
  const actual = await vi.importActual('@/lib/prisma');
  return { ...actual, default: prismaMock, prisma: prismaMock };
});

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(async () => ({
    user: { userId: 'user-test', tenantId: currentTenantId },
  })),
}));

import { GET as getCategories, POST as createCategory } from '../categories/route';
import { GET as getCategoryById, PUT as updateCategory, DELETE as deleteCategory } from '../categories/[id]/route';
import { GET as getUnits, POST as createUnit } from '../units/route';
import { GET as getUnitById, PUT as updateUnit, DELETE as deleteUnit } from '../units/[id]/route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const categoryRow = {
  catId: 'c1',
  nombre: 'Bebidas',
  descripcion: 'Refrescos',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-02T00:00:00.000Z'),
};

const unitRow = {
  unidadId: 'u1',
  nombre: 'Unidad',
  simbolo: 'u',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-02T00:00:00.000Z'),
};

describe('Mobile API: categories & units', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTenantId = 'tenant-1';
  });

  it('GET /api/mobile/categories mapea catId → categoryId', async () => {
    (prismaMock.categoria.findMany as Mock).mockResolvedValue([categoryRow]);

    const response = await getCategories(new NextRequest('http://localhost/api/mobile/categories'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toEqual({
      categoryId: 'c1',
      nombre: 'Bebidas',
      descripcion: 'Refrescos',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
    });
  });

  it('POST /api/mobile/categories crea una categoría con nombre válido', async () => {
    (prismaMock.categoria.create as Mock).mockResolvedValue(categoryRow);

    const request = new NextRequest('http://localhost/api/mobile/categories', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Bebidas', descripcion: 'Refrescos' }),
    });
    const response = await createCategory(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.categoryId).toBe('c1');
    expect(prismaMock.categoria.create).toHaveBeenCalledWith({
      data: { nombre: 'Bebidas', descripcion: 'Refrescos', tenantId: 'tenant-1' },
      select: expect.any(Object),
    });
  });

  it('POST /api/mobile/categories rechaza nombre vacío con 400', async () => {
    const request = new NextRequest('http://localhost/api/mobile/categories', {
      method: 'POST',
      body: JSON.stringify({ nombre: '   ' }),
    });
    const response = await createCategory(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/mobile/categories exige tenant (403)', async () => {
    currentTenantId = null;
    const response = await getCategories(new NextRequest('http://localhost/api/mobile/categories'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('TENANT_REQUIRED');
  });

  it('GET /api/mobile/categories/[id] devuelve 404 si no es del tenant', async () => {
    (prismaMock.categoria.findFirst as Mock).mockResolvedValue(null);

    const response = await getCategoryById(new NextRequest('http://localhost/api/mobile/categories/c1'), ctx('c1'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe('NOT_FOUND');
  });

  it('PUT /api/mobile/categories/[id] actualiza nombre y devuelve mapeado', async () => {
    (prismaMock.categoria.findFirst as Mock).mockResolvedValue({ catId: 'c1' });
    (prismaMock.categoria.update as Mock).mockResolvedValue({ ...categoryRow, nombre: 'Bebidas 2' });

    const request = new NextRequest('http://localhost/api/mobile/categories/c1', {
      method: 'PUT',
      body: JSON.stringify({ nombre: 'Bebidas 2' }),
    });
    const response = await updateCategory(request, ctx('c1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nombre).toBe('Bebidas 2');
  });

  it('DELETE /api/mobile/categories/[id] confirma borrado', async () => {
    (prismaMock.categoria.findFirst as Mock).mockResolvedValue({ catId: 'c1' });
    (prismaMock.categoria.delete as Mock).mockResolvedValue({});

    const response = await deleteCategory(new NextRequest('http://localhost/api/mobile/categories/c1'), ctx('c1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, categoryId: 'c1' });
  });

  it('GET /api/mobile/units mapea simbolo → abreviatura', async () => {
    (prismaMock.unidad.findMany as Mock).mockResolvedValue([unitRow]);

    const response = await getUnits(new NextRequest('http://localhost/api/mobile/units'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items[0]).toEqual({
      unitId: 'u1',
      nombre: 'Unidad',
      abreviatura: 'u',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
    });
  });

  it('POST /api/mobile/units crea con simbolo desde abreviatura', async () => {
    (prismaMock.unidad.create as Mock).mockResolvedValue(unitRow);

    const request = new NextRequest('http://localhost/api/mobile/units', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Unidad', abreviatura: 'u' }),
    });
    const response = await createUnit(request);

    expect(response.status).toBe(201);
    expect(prismaMock.unidad.create).toHaveBeenCalledWith({
      data: { nombre: 'Unidad', simbolo: 'u', tenantId: 'tenant-1' },
      select: expect.any(Object),
    });
  });

  it('POST /api/mobile/units rechaza sin nombre (400)', async () => {
    const request = new NextRequest('http://localhost/api/mobile/units', {
      method: 'POST',
      body: JSON.stringify({ abreviatura: 'u' }),
    });
    const response = await createUnit(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/mobile/units mapea P2002 a 409 CONFLICT', async () => {
    (prismaMock.unidad.create as Mock).mockRejectedValue({
      code: 'P2002',
      meta: { target: ['tenantId', 'nombre'] },
    });

    const request = new NextRequest('http://localhost/api/mobile/units', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Unidad', abreviatura: 'u' }),
    });
    const response = await createUnit(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('CONFLICT');
  });

  it('DELETE /api/mobile/units/[id] rechaza si está en uso (409 IN_USE)', async () => {
    (prismaMock.unidad.findFirst as Mock).mockResolvedValue({ unidadId: 'u1' });
    (prismaMock.producto.count as Mock).mockResolvedValue(3);

    const response = await deleteUnit(new NextRequest('http://localhost/api/mobile/units/u1'), ctx('u1'));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('IN_USE');
  });
});