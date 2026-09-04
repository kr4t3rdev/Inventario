import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { NextRequest } from 'next/server';

const { prismaMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      contrato: { findMany: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
      servicios: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
      ventaServicios: { count: vi.fn() },
      compraServicio: { count: vi.fn() },
      ofertaItem: { count: vi.fn() },
    },
  };
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

import { GET as getContracts } from '../contracts/route';
import { GET as getContractById, DELETE as deleteContract } from '../contracts/[id]/route';
import { GET as getServices, POST as createService } from '../services/route';
import { DELETE as deleteService } from '../services/[id]/route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const contratoRow = {
  contratoId: 'ct1',
  clienteId: 'cl1',
  numeroContrato: 'CON-0001',
  observaciones: 'Servicio anual',
  monto: 1250,
  estado: 'ANULADO',
  fechaInicio: new Date('2025-01-01T00:00:00.000Z'),
  fechaFin: null,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-02T00:00:00.000Z'),
  cliente: { nombre: 'Cliente A' },
};

const servicioRow = {
  servicioId: 's1',
  nombre: 'Instalación',
  descripcion: 'Servicio de instalación',
  precio: 500,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-02T00:00:00.000Z'),
};

describe('Mobile API: contracts & services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTenantId = 'tenant-1';
  });

  it('GET /api/mobile/contracts mapea ANULADO → CANCELADO y titulo ← numeroContrato', async () => {
    (prismaMock.contrato.findMany as Mock).mockResolvedValue([contratoRow]);

    const response = await getContracts(new NextRequest('http://localhost/api/mobile/contracts'));
    const data = await response.json();

    expect(data.items[0]).toMatchObject({
      contratoId: 'ct1',
      titulo: 'CON-0001',
      estado: 'CANCELADO',
      monto: 1250,
      cliente: { nombre: 'Cliente A' },
    });
  });

  it('GET /api/mobile/services emite estado ACTIVO', async () => {
    (prismaMock.servicios.findMany as Mock).mockResolvedValue([servicioRow]);

    const response = await getServices(new NextRequest('http://localhost/api/mobile/services'));
    const data = await response.json();

    expect(data.items[0]).toEqual({
      servicioId: 's1',
      nombre: 'Instalación',
      descripcion: 'Servicio de instalación',
      precio: 500,
      estado: 'ACTIVO',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
    });
  });

  it('GET /api/mobile/contracts/[id] devuelve 404 si no es del tenant', async () => {
    (prismaMock.contrato.findFirst as Mock).mockResolvedValue(null);

    const response = await getContractById(new NextRequest('http://localhost/api/mobile/contracts/ct1'), ctx('ct1'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe('NOT_FOUND');
  });

  it('POST /api/mobile/services crea con valores válidos', async () => {
    (prismaMock.servicios.create as Mock).mockResolvedValue(servicioRow);

    const request = new NextRequest('http://localhost/api/mobile/services', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Instalación', precio: 500, descripcion: 'Servicio de instalación' }),
    });
    const response = await createService(request);

    expect(response.status).toBe(201);
  });

  it('POST /api/mobile/services rechaza precio negativo (400)', async () => {
    const request = new NextRequest('http://localhost/api/mobile/services', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'X', precio: -1 }),
    });
    const response = await createService(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('DELETE /api/mobile/services/[id] bloquea si tiene referencias (409)', async () => {
    (prismaMock.servicios.findFirst as Mock).mockResolvedValue({ servicioId: 's1' });
    (prismaMock.ventaServicios.count as Mock).mockResolvedValue(1);
    (prismaMock.compraServicio.count as Mock).mockResolvedValue(0);
    (prismaMock.ofertaItem.count as Mock).mockResolvedValue(0);

    const response = await deleteService(new NextRequest('http://localhost/api/mobile/services/s1'), ctx('s1'));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('HAS_REFERENCES');
  });

  it('DELETE /api/mobile/contracts/[id] confirma borrado', async () => {
    (prismaMock.contrato.findFirst as Mock).mockResolvedValue({ contratoId: 'ct1' });
    (prismaMock.contrato.delete as Mock).mockResolvedValue({});

    const response = await deleteContract(new NextRequest('http://localhost/api/mobile/contracts/ct1'), ctx('ct1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, contratoId: 'ct1' });
  });
});