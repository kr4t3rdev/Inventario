/**
 * @description Tests de aislamiento de tenant para la API REST de contratos (CU-01, RED).
 * @param {void} No aplica - suite de tests
 * @returns {void} Aserciones vitest
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Transacción interactiva (B-2): el helper de firmas relee el estado y hace
// claim condicional dentro de la transacción.
const mockTx = vi.hoisted(() => ({
  contrato: { findFirst: vi.fn(), updateMany: vi.fn() },
  contratoFirma: { create: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)),
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
    tenantMembership: { findFirst: vi.fn() },
    cliente: { update: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    vendor: { findFirst: vi.fn() },
    tipoContratoCustom: { findFirst: vi.fn() },
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
  crearContratoConConsecutivo: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import { recordOwnerAsset } from '@/lib/upload/cloudinary-admin';
import { resolveUploadPolicy } from '@/lib/upload/upload-policy';
import { crearContratoConConsecutivo } from '@/features/contratos/lib/numeroContratoGenerator';
import {
  getContratoByIdHandler,
  updateContratoHandler,
  deleteContratoHandler,
  bulkUpdateContratoStatusHandler,
  bulkDeleteContratosHandler,
  createContratoVersionHandler,
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
  createContratoHandler,
} from '@/features/contratos/api/handlers';

const userTenantA = {
  userId: 'user-a',
  tenantId: 'tenant-A',
  role: 'user',
  planFeatures: { contratos: true },
  permissions: new Set(['ventas.contratos.gestionar']),
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

  const nestedAndBulkHandlers = [
    ['GET alertas', (request: NextRequestShim) => getContratoAlertasHandler(request as never, params('ct-a')), 'GET', '/alertas'],
    ['POST alertas', (request: NextRequestShim) => createContratoAlertaHandler(request as never, params('ct-a')), 'POST', '/alertas'],
    ['GET aprobaciones', (request: NextRequestShim) => getContratoAprobacionesHandler(request as never, params('ct-a')), 'GET', '/aprobaciones'],
    ['POST aprobaciones', (request: NextRequestShim) => createContratoAprobacionHandler(request as never, params('ct-a')), 'POST', '/aprobaciones'],
    ['GET archivos', (request: NextRequestShim) => getContratoArchivosHandler(request as never, params('ct-a')), 'GET', '/archivos'],
    ['POST archivos', (request: NextRequestShim) => createContratoArchivoHandler(request as never, params('ct-a')), 'POST', '/archivos'],
    ['GET firmas', (request: NextRequestShim) => getContratoFirmasHandler(request as never, params('ct-a')), 'GET', '/firmas'],
    ['POST firmas', (request: NextRequestShim) => createContratoFirmaHandler(request as never, params('ct-a')), 'POST', '/firmas'],
    ['POST versiones', (request: NextRequestShim) => createContratoVersionHandler(request as never, params('ct-a')), 'POST', '/versiones'],
    ['POST check-diff', (request: NextRequestShim) => checkContratoVersionDiffHandler(request as never, params('ct-a')), 'POST', '/versiones/check-diff'],
    ['POST bulk update-status', (request: NextRequestShim) => bulkUpdateContratoStatusHandler(request as never), 'POST', '/bulk/update-status'],
    ['POST bulk delete', (request: NextRequestShim) => bulkDeleteContratosHandler(request as never), 'POST', '/bulk/delete'],
  ] as const;

  it.each(nestedAndBulkHandlers)(
    '%s rechaza Basic antes de Prisma, lectura de payload o efectos externos',
    async (_label, invoke, method, path) => {
      vi.mocked(authenticateUser).mockResolvedValue({
        user: { ...userTenantA, planFeatures: { contratos: false } },
      } as never);
      const request = req(`http://localhost/api/contratos/ct-a${path}`, {
        method,
        body: JSON.stringify({ ids: ['ct-a'], estado: 'ACTIVO' }),
      }) as NextRequestShim;
      const jsonSpy = vi.spyOn(request, 'json');
      const formDataSpy = vi.spyOn(request, 'formData');

      const response = (await invoke(request)) as Response;
      const responseBody = await response.json();

      expect(response.status).toBe(403);
      expect(responseBody.code).toBe('FEATURE_NOT_AVAILABLE');
      expect(jsonSpy).not.toHaveBeenCalled();
      expect(formDataSpy).not.toHaveBeenCalled();
      expect([
        prisma.$transaction,
        prisma.contrato.findFirst,
        prisma.contrato.findMany,
        prisma.contrato.create,
        prisma.contrato.update,
        prisma.contrato.updateMany,
        prisma.contrato.delete,
        prisma.contrato.deleteMany,
        prisma.contratoVersion.findFirst,
        prisma.contratoVersion.create,
        prisma.contratoFirma.findMany,
        prisma.contratoFirma.create,
        prisma.contratoAprobacion.findMany,
        prisma.contratoAprobacion.create,
        prisma.contratoArchivo.findMany,
        prisma.contratoArchivo.create,
        prisma.contratoAlerta.findMany,
        prisma.contratoAlerta.create,
        prisma.tenantMembership.findFirst,
        prisma.cliente.update,
        prisma.cliente.updateMany,
        recordOwnerAsset,
        resolveUploadPolicy,
      ].some((mock) => vi.mocked(mock).mock.calls.length > 0)).toBe(false);
    },
  );

  it.each([
    ['GET /api/contratos', (request: NextRequestShim) => getContratosHandler(request as never)],
    ['POST /api/contratos', (request: NextRequestShim) => createContratoHandler(request as never)],
    ['GET /api/contratos/:id', (request: NextRequestShim) => getContratoByIdHandler(request as never, params('ct-a'))],
    ['PUT /api/contratos/:id', (request: NextRequestShim) => updateContratoHandler(request as never, params('ct-a'))],
    ['DELETE /api/contratos/:id', (request: NextRequestShim) => deleteContratoHandler(request as never, params('ct-a'))],
  ])('%s rechaza plan Básico antes de leer o escribir Prisma', async (_label, invoke) => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: { ...userTenantA, planFeatures: { contratos: false } } } as never);
    const response = await invoke(req('http://localhost/api/contratos') as NextRequestShim);
    expect(response.status).toBe(403);
    expect(prisma.contrato.findMany).not.toHaveBeenCalled();
    expect(prisma.contrato.count).not.toHaveBeenCalled();
    expect(prisma.contrato.findFirst).not.toHaveBeenCalled();
    expect(prisma.contrato.create).not.toHaveBeenCalled();
    expect(prisma.contrato.update).not.toHaveBeenCalled();
    expect(prisma.contrato.delete).not.toHaveBeenCalled();
  });

  it.each([
    ['POST /api/contratos', (request: NextRequestShim) => createContratoHandler(request as never)],
    ['PUT /api/contratos/:id', (request: NextRequestShim) => updateContratoHandler(request as never, params('ct-a'))],
    ['DELETE /api/contratos/:id', (request: NextRequestShim) => deleteContratoHandler(request as never, params('ct-a'))],
  ])('%s exige tenant antes de consultar Prisma para administrador global', async (_label, invoke) => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { userId: 'admin-1', role: 'admin', planFeatures: { contratos: false } },
    } as never);

    const response = await invoke(req('http://localhost/api/contratos/ct-a', {
      method: 'PUT',
      body: JSON.stringify({ observaciones: 'Cambio' }),
    }) as NextRequestShim);

    expect(response.status).toBe(403);
    expect(prisma.contrato.findFirst).not.toHaveBeenCalled();
    expect(prisma.contrato.findUnique).not.toHaveBeenCalled();
    expect(prisma.contrato.update).not.toHaveBeenCalled();
    expect(prisma.contrato.delete).not.toHaveBeenCalled();
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
    expect(prisma.vendor.findFirst).not.toHaveBeenCalled();
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
    vi.mocked(prisma.contrato.findMany).mockResolvedValue([
      { contratoId: 'ct-a', estado: 'BORRADOR' },
    ] as never);
    vi.mocked(prisma.contrato.updateMany).mockResolvedValue({ count: 1 } as never);
    await bulkUpdateContratoStatusHandler(
      req('http://localhost/api/contratos/bulk/update-status', { method: 'POST', body: JSON.stringify({ ids: ['ct-a', 'ct-b'], estado: 'PENDIENTE_APROBACION' }) }) as never,
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

  // ─── Relaciones externas: deben validar pertenencia al tenant (fix F-05) ───

  it('POST firma con firmante de otro tenant devuelve 404', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-a', tenantId: 'tenant-A' } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(null as never);
    const res = (await createContratoFirmaHandler(
      req('http://localhost/api/contratos/ct-a/firmas', {
        method: 'POST',
        body: JSON.stringify({ firmanteId: 'user-B', tipoFirma: 'INTERNO' }),
      }) as never,
      params('ct-a'),
    )) as Response;
    expect(res.status).toBe(404);
    expect(prisma.contratoFirma.create).not.toHaveBeenCalled();
    expect(prisma.tenantMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-A', userId: 'user-B' }) }),
    );
  });

  it('POST firma con firmante del mismo tenant es aceptada', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-a', tenantId: 'tenant-A' } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({ userId: 'user-a' } as never);
    vi.mocked(mockTx.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-a', estado: 'BORRADOR' } as never);
    vi.mocked(mockTx.contratoFirma.create).mockResolvedValue({ firmaId: 'f1' } as never);
    const res = (await createContratoFirmaHandler(
      req('http://localhost/api/contratos/ct-a/firmas', {
        method: 'POST',
        body: JSON.stringify({ firmanteId: 'user-a', tipoFirma: 'INTERNO' }),
      }) as never,
      params('ct-a'),
    )) as Response;
    expect(res.status).toBe(200);
  });

  it('POST aprobación con aprobador de otro tenant devuelve 404', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-a', tenantId: 'tenant-A' } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(null as never);
    const res = (await createContratoAprobacionHandler(
      req('http://localhost/api/contratos/ct-a/aprobaciones', {
        method: 'POST',
        body: JSON.stringify({ nivel: 1, aprobadorId: 'user-B' }),
      }) as never,
      params('ct-a'),
    )) as Response;
    expect(res.status).toBe(404);
    expect(prisma.contratoAprobacion.create).not.toHaveBeenCalled();
  });

  it('POST archivo con versión de otro contrato devuelve 404', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-a', tenantId: 'tenant-A' } as never);
    vi.mocked(prisma.contratoVersion.findFirst).mockResolvedValue(null as never);
    const res = (await createContratoArchivoHandler(
      req('http://localhost/api/contratos/ct-a/archivos', {
        method: 'POST',
        body: JSON.stringify({
          versionId: 'v-externa',
          tipo: 'DOCUMENTO',
          rutaArchivo: 'https://res.cloudinary.com/demo/raw/x.pdf',
          nombreArchivo: 'x.pdf',
          cloudinaryPublicId: 'pub-id-1',
          mimeType: 'application/pdf',
          bytes: 3,
        }),
      }) as never,
      params('ct-a'),
    )) as Response;
    expect(res.status).toBe(404);
    expect(prisma.contratoArchivo.create).not.toHaveBeenCalled();
    expect(prisma.contratoVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ versionId: 'v-externa', contratoId: 'ct-a' }) }),
    );
  });

  it.each(['custom-b', 'valor-libre'])('POST tipo %s no existente/no propio devuelve 404 sin crear contrato', async (tipo) => {
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: 'cli-a' } as never);
    vi.mocked(prisma.tipoContratoCustom.findFirst).mockResolvedValue(null as never);
    const res = (await createContratoHandler(
      req('http://localhost/api/contratos', {
        method: 'POST',
        body: JSON.stringify({ tipo, tenantId: 'tenant-B', fechaInicio: '2026-01-01T00:00:00.000Z', clienteId: 'cli-a' }),
      }) as never,
    )) as Response;

    expect(res.status).toBe(404);
    expect(prisma.tipoContratoCustom.findFirst).toHaveBeenCalledWith({
      where: { tipoCustomId: tipo, tenantId: 'tenant-A', activo: true },
      select: { tipoCustomId: true },
    });
    expect(crearContratoConConsecutivo).not.toHaveBeenCalled();
    expect(prisma.contrato.create).not.toHaveBeenCalled();
  });

  it('POST permite asignar tipo personalizado activo propio e ignora tenant recibido', async () => {
    vi.mocked(prisma.tipoContratoCustom.findFirst).mockResolvedValue({ tipoCustomId: 'custom-a' } as never);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: 'cli-a' } as never);
    vi.mocked(crearContratoConConsecutivo).mockImplementation(async ({ create }: never) =>
      (create as (payload: Record<string, unknown>) => Promise<unknown>)({
        tipo: 'custom-a',
        numeroContrato: 'CUS-0001',
        contratoId: 'ct-a',
      }));
    vi.mocked(prisma.contrato.create).mockResolvedValue({ contratoId: 'ct-a', tipo: 'custom-a' } as never);
    vi.mocked(prisma.contratoVersion.create).mockResolvedValue({} as never);

    const res = (await createContratoHandler(
      req('http://localhost/api/contratos', {
        method: 'POST',
        body: JSON.stringify({
          tipo: 'custom-a',
          tenantId: 'tenant-B',
          fechaInicio: '2026-01-01T00:00:00.000Z',
          clienteId: 'cli-a',
        }),
      }) as never,
    )) as Response;

    expect(res.status).toBe(200);
    expect(prisma.tipoContratoCustom.findFirst).toHaveBeenCalledWith({
      where: { tipoCustomId: 'custom-a', tenantId: 'tenant-A', activo: true },
      select: { tipoCustomId: true },
    });
    expect(crearContratoConConsecutivo).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-A' }));
  });

  it.each(['COMPRA_VENTA', 'SERVICIO', 'PROVEEDOR', 'ARRENDAMIENTO', 'OTRO'])(
    'POST acepta tipo integrado %s sin buscar tipo personalizado', async (tipo) => {
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: 'cli-a' } as never);
      vi.mocked(crearContratoConConsecutivo).mockImplementation(async ({ create }: never) =>
        (create as (payload: Record<string, unknown>) => Promise<unknown>)({
          tipo,
          numeroContrato: 'CUS-0001',
          contratoId: 'ct-a',
        }));
      vi.mocked(prisma.contrato.create).mockResolvedValue({ contratoId: 'ct-a', tipo } as never);
      vi.mocked(prisma.contratoVersion.create).mockResolvedValue({} as never);

      const res = (await createContratoHandler(
        req('http://localhost/api/contratos', {
          method: 'POST',
          body: JSON.stringify({ tipo, fechaInicio: '2026-01-01T00:00:00.000Z', clienteId: 'cli-a' }),
        }) as never,
      )) as Response;

      expect(res.status).toBe(200);
      expect(prisma.tipoContratoCustom.findFirst).not.toHaveBeenCalled();
    },
  );

  it('PUT rechaza tipo personalizado de otro tenant antes de actualizar', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-a', tenantId: 'tenant-A', tipo: 'OTRO' } as never);
    vi.mocked(prisma.tipoContratoCustom.findFirst).mockResolvedValue(null as never);
    const res = (await updateContratoHandler(
      req('http://localhost/api/contratos/ct-a', {
        method: 'PUT',
        body: JSON.stringify({ tipo: 'custom-b', tenantId: 'tenant-B' }),
      }) as never,
      params('ct-a'),
    )) as Response;

    expect(res.status).toBe(404);
    expect(prisma.tipoContratoCustom.findFirst).toHaveBeenCalledWith({
      where: { tipoCustomId: 'custom-b', tenantId: 'tenant-A', activo: true },
      select: { tipoCustomId: true },
    });
    expect(prisma.contrato.update).not.toHaveBeenCalled();
  });

  it('PUT permite asignar tipo personalizado activo propio', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-a', tenantId: 'tenant-A', tipo: 'OTRO' } as never);
    vi.mocked(prisma.tipoContratoCustom.findFirst).mockResolvedValue({ tipoCustomId: 'custom-a' } as never);
    vi.mocked(prisma.contrato.update).mockResolvedValue({ contratoId: 'ct-a', tipo: 'custom-a' } as never);

    const res = (await updateContratoHandler(
      req('http://localhost/api/contratos/ct-a', {
        method: 'PUT',
        body: JSON.stringify({ tipo: 'custom-a' }),
      }) as never,
      params('ct-a'),
    )) as Response;

    expect(res.status).toBe(200);
    expect(prisma.contrato.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { contratoId: 'ct-a' },
      data: expect.objectContaining({ tipo: 'custom-a' }),
    }));
  });

  it('PUT conserva tipo propio archivado pero valida propietario y contrato en el tenant', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-a', tenantId: 'tenant-A', tipo: 'custom-a' } as never);
    vi.mocked(prisma.tipoContratoCustom.findFirst).mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ tipoCustomId: 'custom-a' } as never);
    vi.mocked(prisma.contrato.update).mockResolvedValue({ contratoId: 'ct-a' } as never);
    const res = (await updateContratoHandler(
      req('http://localhost/api/contratos/ct-a', {
        method: 'PUT',
        body: JSON.stringify({ tipo: 'custom-a' }),
      }) as never,
      params('ct-a'),
    )) as Response;

    expect(res.status).toBe(200);
    expect(prisma.tipoContratoCustom.findFirst).toHaveBeenNthCalledWith(2, {
      where: { tipoCustomId: 'custom-a', tenantId: 'tenant-A', activo: false },
      select: { tipoCustomId: true },
    });
    expect(prisma.contrato.update).toHaveBeenCalledTimes(1);
  });

  it('PUT contrato con clienteId de otro tenant devuelve 404', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-a', tenantId: 'tenant-A', tipo: 'OTRO' } as never);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null as never);
    const res = (await updateContratoHandler(
      req('http://localhost/api/contratos/ct-a', {
        method: 'PUT',
        body: JSON.stringify({ clienteId: 'cli-B' }),
      }) as never,
      params('ct-a'),
    )) as Response;
    expect(res.status).toBe(404);
    expect(prisma.contrato.update).not.toHaveBeenCalled();
  });

  it('PUT contrato con vendorId de otro tenant devuelve 404', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-a', tenantId: 'tenant-A', tipo: 'OTRO' } as never);
    vi.mocked(prisma.vendor.findFirst).mockResolvedValue(null as never);
    const res = (await updateContratoHandler(
      req('http://localhost/api/contratos/ct-a', {
        method: 'PUT',
        body: JSON.stringify({ vendorId: 'ven-B' }),
      }) as never,
      params('ct-a'),
    )) as Response;
    expect(res.status).toBe(404);
    expect(prisma.contrato.update).not.toHaveBeenCalled();
  });

  it('PUT contrato ignora aprobadoPor del payload (CTF-2: ciclo de vida no escribible)', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-a', tenantId: 'tenant-A', tipo: 'OTRO' } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.contrato.update).mockResolvedValue({ contratoId: 'ct-a' } as never);
    const res = (await updateContratoHandler(
      req('http://localhost/api/contratos/ct-a', {
        method: 'PUT',
        body: JSON.stringify({ aprobadoPor: 'user-B' }),
      }) as never,
      params('ct-a'),
    )) as Response;
    expect(res.status).toBe(200);
    expect(prisma.tenantMembership.findFirst).not.toHaveBeenCalled();
    expect(prisma.contrato.update).toHaveBeenCalledTimes(1);
    const call = vi.mocked(prisma.contrato.update).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.aprobador).toBeUndefined();
  });
});
