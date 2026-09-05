/**
 * @description Tests de aislamiento de tenant para la API REST de contratos (CU-01, RED).
 * @param {void} No aplica - suite de tests
 * @returns {void} Aserciones vitest
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    contratoVersion: { findFirst: vi.fn(), create: vi.fn() },
    contratoFirma: { findMany: vi.fn(), create: vi.fn() },
    contratoAprobacion: { findMany: vi.fn(), create: vi.fn() },
    contratoArchivo: { findMany: vi.fn(), create: vi.fn() },
    contratoAlerta: { findMany: vi.fn(), create: vi.fn() },
    cliente: { update: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    vendor: { findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/upload/cloudinary-admin', () => ({
  recordOwnerAsset: vi.fn(),
}));

vi.mock('@/lib/upload/upload-policy', () => ({
  resolveUploadPolicy: vi.fn(),
}));

vi.mock('uploadthing/server', () => ({
  UTApi: vi.fn(),
  UTFile: class MockUTFile extends File {},
}));

vi.mock('@/features/contratos/lib/numeroContratoGenerator', () => ({
  generarProximoConsecutivo: vi.fn(),
  formatearNumeroContrato: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import {
  getContratoByIdHandler,
  updateContratoHandler,
  deleteContratoHandler,
  bulkUpdateContratoStatusHandler,
  bulkDeleteContratosHandler,
  getContratoFirmasHandler,
  createContratoFirmaHandler,
  getContratoAprobacionesHandler,
  createContratoAprobacionHandler,
  getContratoAlertasHandler,
  createContratoAlertaHandler,
  getContratoArchivosHandler,
  createContratoArchivoHandler,
  checkContratoVersionDiffHandler,
  getContratosHandler,
} from '@/features/contratos/api/handlers';

const userTenantA = {
  userId: 'user-a',
  tenantId: 'tenant-A',
  role: 'admin',
  name: 'User A',
  email: 'a@test.com',
  isActive: true,
} as never;

// Contrato que pertenece al tenant B
const contratoTenantB = {
  contratoId: 'ct-b',
  tenantId: 'tenant-B',
  numeroContrato: 'CV-0001',
  tipo: 'COMPRA_VENTA',
  estado: 'ACTIVO',
} as never;

function req(url: string, init?: RequestInit): any {
  return new NextRequestShim(url, init);
}

// NextRequest mínimo: handlers usan request.nextUrl.searchParams, request.json(), request.formData()
class NextRequestShim {
  nextUrl: URL;
  private _init?: RequestInit;
  constructor(url: string, init?: RequestInit) {
    this.nextUrl = new URL(url);
    this._init = init;
  }
  async json() {
    return JSON.parse((this._init?.body as string) ?? '{}');
  }
  async formData() {
    return (this._init as any)?.formData ?? { get: () => null };
  }
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('CU-01 aislamiento tenant API contratos (RED)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authenticateUser).mockResolvedValue({ user: userTenantA } as never);
  });

  it('GET lista solo devuelve contratos del tenant autenticado', async () => {
    vi.mocked(prisma.contrato.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.contrato.count).mockResolvedValue(0 as never);
    await getContratosHandler(req('http://localhost/api/contratos') as never);
    expect(prisma.contrato.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-A' }) }),
    );
  });

  it('GET /:id de otro tenant responde 404 igual que inexistente', async () => {
    // Simula: findFirst tenant-scoped no encuentra nada (el contrato es de B)
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.contrato.findUnique).mockResolvedValue(contratoTenantB as never);
    const res = (await getContratoByIdHandler(req('http://localhost/api/contratos/ct-b') as never, params('ct-b'))) as Response;
    expect(res.status).toBe(404);
  });

  it('PUT /:id de otro tenant responde 404', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.contrato.findUnique).mockResolvedValue(contratoTenantB as never);
    const res = (await updateContratoHandler(
      req('http://localhost/api/contratos/ct-b', { method: 'PUT', body: JSON.stringify({ estado: 'ACTIVO' }) }) as never,
      params('ct-b'),
    )) as Response;
    expect(res.status).toBe(404);
  });

  it('DELETE /:id de otro tenant responde 404 y no borra', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.contrato.findUnique).mockResolvedValue({ clienteId: null } as never);
    const res = (await deleteContratoHandler(req('http://localhost/api/contratos/ct-b', { method: 'DELETE' }) as never, params('ct-b'))) as Response;
    expect(res.status).toBe(404);
    expect(prisma.contrato.delete).not.toHaveBeenCalled();
  });

  it('bulk update-status no toca contratos de otro tenant', async () => {
    vi.mocked(prisma.contrato.updateMany).mockResolvedValue({ count: 0 } as never);
    await bulkUpdateContratoStatusHandler(
      req('http://localhost/api/contratos/bulk/update-status', { method: 'POST', body: JSON.stringify({ ids: ['ct-b'], estado: 'ACTIVO' }) }) as never,
    );
    expect(prisma.contrato.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-A' }) }),
    );
  });

  it('bulk delete no toca contratos de otro tenant', async () => {
    vi.mocked(prisma.contrato.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.contrato.deleteMany).mockResolvedValue({ count: 0 } as never);
    await bulkDeleteContratosHandler(
      req('http://localhost/api/contratos/bulk/delete', { method: 'POST', body: JSON.stringify({ ids: ['ct-b'] }) }) as never,
    );
    const findWhere = vi.mocked(prisma.contrato.findMany).mock.calls[0]?.[0] as any;
    expect(findWhere?.where).toEqual(expect.objectContaining({ tenantId: 'tenant-A' }));
  });

  it('GET firmas de otro tenant responde 404', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.contratoFirma.findMany).mockResolvedValue([{ firmaId: 'f1' }] as never);
    const res = (await getContratoFirmasHandler(req('http://localhost/api/contratos/ct-b/firmas') as never, params('ct-b'))) as Response;
    expect(res.status).toBe(404);
  });

  it('POST firma en contrato de otro tenant responde 404', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null as never);
    const res = (await createContratoFirmaHandler(
      req('http://localhost/api/contratos/ct-b/firmas', {
        method: 'POST',
        body: JSON.stringify({ firmanteId: 'user-a', tipoFirma: 'INTERNO' }),
      }) as never,
      params('ct-b'),
    )) as Response;
    expect(res.status).toBe(404);
    expect(prisma.contratoFirma.create).not.toHaveBeenCalled();
  });

  it('POST firma con payload inválido responde 400', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-a', tenantId: 'tenant-A' } as never);
    const res = (await createContratoFirmaHandler(
      req('http://localhost/api/contratos/ct-a/firmas', {
        method: 'POST',
        body: JSON.stringify({ firmanteId: '', tipoFirma: 'INVALIDO' }),
      }) as never,
      params('ct-a'),
    )) as Response;
    expect(res.status).toBe(400);
  });

  it('GET aprobaciones de otro tenant responde 404', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.contratoAprobacion.findMany).mockResolvedValue([{ aprobacionId: 'a1' }] as never);
    const res = (await getContratoAprobacionesHandler(req('http://localhost/api/contratos/ct-b/aprobaciones') as never, params('ct-b'))) as Response;
    expect(res.status).toBe(404);
  });

  it('POST aprobación en contrato de otro tenant responde 404', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null as never);
    const res = (await createContratoAprobacionHandler(
      req('http://localhost/api/contratos/ct-b/aprobaciones', {
        method: 'POST',
        body: JSON.stringify({ nivel: 1, aprobadorId: 'user-a' }),
      }) as never,
      params('ct-b'),
    )) as Response;
    expect(res.status).toBe(404);
  });

  it('GET alertas de otro tenant responde 404', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.contratoAlerta.findMany).mockResolvedValue([{ alertaId: 'al1' }] as never);
    const res = (await getContratoAlertasHandler(req('http://localhost/api/contratos/ct-b/alertas') as never, params('ct-b'))) as Response;
    expect(res.status).toBe(404);
  });

  it('POST alerta en contrato de otro tenant responde 404', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null as never);
    const res = (await createContratoAlertaHandler(
      req('http://localhost/api/contratos/ct-b/alertas', {
        method: 'POST',
        body: JSON.stringify({ tipo: 'VENCIMIENTO', fechaAlerta: new Date().toISOString(), mensaje: 'x' }),
      }) as never,
      params('ct-b'),
    )) as Response;
    expect(res.status).toBe(404);
  });

  it('GET archivos de otro tenant responde 404', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.contratoArchivo.findMany).mockResolvedValue([{ archivoId: 'ar1' }] as never);
    const res = (await getContratoArchivosHandler(req('http://localhost/api/contratos/ct-b/archivos') as never, params('ct-b'))) as Response;
    expect(res.status).toBe(404);
  });

  it('check-diff en contrato de otro tenant responde 404', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.contratoVersion.findFirst).mockResolvedValue({ versionId: 'v1', archivos: [] } as never);
    const fakeForm = { get: (k: string) => (k === 'file' ? ({ name: 'a.pdf', type: 'application/pdf', size: 3, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as any) : null) };
    const res = (await checkContratoVersionDiffHandler(
      req('http://localhost/api/contratos/ct-b/versiones/check-diff', { method: 'POST', formData: fakeForm } as any) as never,
      params('ct-b'),
    )) as Response;
    expect(res.status).toBe(404);
  });
});
