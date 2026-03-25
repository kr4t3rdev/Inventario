import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const prismaMock = vi.hoisted(() => ({
  producto: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  transferencia: {
    aggregate: vi.fn(),
  },
  ventaItem: {
    aggregate: vi.fn(),
  },
  venta: {
    aggregate: vi.fn(),
  },
  categoria: {
    findUnique: vi.fn(),
  },
  gastoCompra: {
    create: vi.fn(),
  },
}));

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
  withAuthPost: (handler: any) => handler,
  withAuth: (handler: any) => handler,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

/**
 * @description Construye payload válido mínimo para crear/actualizar productos en pruebas.
 * @param {Record<string, unknown>} overrides - Campos a sobrescribir.
 * @returns {Record<string, unknown>} Payload listo para request.
 */
function buildProductPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nombre: 'Producto Test',
    descripcion: 'Descripción test',
    precioCosto: 100,
    precioVenta: 150,
    stock: 0,
    stockMinimo: 5,
    fotos: [],
    proveedorCodigo: '01',
    idSeccionCodigo: '14',
    especificoCodigo: '0285',
    surtidoCodigo: '0001',
    categoriaId: 'cat-1',
    unidadId: 'unit-1',
    almacenId: 'alm-1',
    ...overrides,
  };
}

describe('Productos API - código interno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.transferencia.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prismaMock.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prismaMock.venta.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prismaMock.producto.count.mockResolvedValue(0);
  });

  it('GET debe incluir codigoInterno en búsqueda por search', async () => {
    const { GET } = await import('../route');

    prismaMock.producto.findMany.mockResolvedValue([
      { id: 'prod-1', stock: 10, nombre: 'Producto 1', codigoInterno: '12345678901' },
    ]);
    prismaMock.producto.count.mockResolvedValue(1);

    const request = new NextRequest('http://localhost/api/productos?search=12345678901');
    const response = await GET(request, {}, { userId: 'user-1' });

    expect(response.status).toBe(200);

    const findManyArg = prismaMock.producto.findMany.mock.calls[0][0];
    expect(findManyArg.where.AND[0].OR).toContainEqual({
      codigoInterno: { contains: '12345678901' },
    });
  });

  it('POST debe rechazar codigoInterno con formato inválido', async () => {
    const { POST } = await import('../route');

    const request = new NextRequest('http://localhost/api/productos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildProductPayload({ codigoInterno: '1234' })),
    });

    const response = await POST(request, {}, { userId: 'user-1' });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('11 números');
  });

  it('POST debe rechazar segmentos EAN inválidos', async () => {
    const { POST } = await import('../route');

    const request = new NextRequest('http://localhost/api/productos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        buildProductPayload({
          proveedorCodigo: 'AA',
          idSeccionCodigo: '14',
          especificoCodigo: '0285',
          surtidoCodigo: '0001',
        }),
      ),
    });

    const response = await POST(request, {}, { userId: 'user-1' });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('dígitos');
  });

  it('POST debe devolver 409 cuando codigoInterno ya existe', async () => {
    const { POST } = await import('../route');

    prismaMock.producto.findFirst.mockResolvedValue({ id: 'prod-existente' });

    const request = new NextRequest('http://localhost/api/productos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildProductPayload({ codigoInterno: '12345678901' })),
    });

    const response = await POST(request, {}, { userId: 'user-1' });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('ya está asignado');
  });

  it('POST debe persistir codigoInterno normalizado cuando es válido', async () => {
    const { POST } = await import('../route');

    prismaMock.producto.findFirst.mockResolvedValue(null);
    prismaMock.producto.create.mockResolvedValue({
      id: 'prod-1',
      nombre: 'Producto Test',
      codigoInterno: '12345678901',
    });

    const request = new NextRequest('http://localhost/api/productos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildProductPayload({ codigoInterno: ' 12345678901 ' })),
    });

    const response = await POST(request, {}, { userId: 'user-1' });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.codigoInterno).toBe('12345678901');
    expect(prismaMock.producto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          codigoInterno: '12345678901',
        }),
      }),
    );
  });

  it('PATCH debe devolver 409 cuando codigoInterno pertenece a otro producto', async () => {
    const { PATCH } = await import('../[id]/route');

    prismaMock.producto.findFirst.mockResolvedValue({ id: 'otro-prod' });

    const request = new NextRequest('http://localhost/api/productos/prod-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildProductPayload({ codigoInterno: '12345678901' })),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'prod-1' }) }, { userId: 'user-1' });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('ya está asignado');
  });

  it('PATCH debe normalizar codigoInterno vacío a null', async () => {
    const { PATCH } = await import('../[id]/route');

    prismaMock.producto.findFirst.mockResolvedValue(null);
    prismaMock.producto.update.mockResolvedValue({
      id: 'prod-1',
      codigoInterno: null,
    });

    const request = new NextRequest('http://localhost/api/productos/prod-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildProductPayload({ codigoInterno: '' })),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'prod-1' }) }, { userId: 'user-1' });
    expect(response.status).toBe(200);
    expect(prismaMock.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          codigoInterno: null,
        }),
      }),
    );
  });
});
