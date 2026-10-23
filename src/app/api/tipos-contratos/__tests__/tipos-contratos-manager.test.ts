/**
 * @description Tests de endurecimiento de tipos de contrato custom (CU-02, solo manager).
 * @param {void} No aplica - suite de tests
 * @returns {void} Aserciones vitest
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: { tipoContratoCustom: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), delete: vi.fn() } },
  prisma: { tipoContratoCustom: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), delete: vi.fn() } },
}));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
  // CTF-4: la ruta se envuelve con withAuth; en este test pasa directo para
  // seguir evaluando la lógica interna contra authenticateUser mockeado.
  withAuth: (handler: (req: unknown, ctx: unknown) => unknown) => (req: unknown, ctx: unknown) => handler(req, ctx),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import prismaDefault from '@/lib/prisma';
import { GET, POST } from '@/app/api/tipos-contratos/route';
import { DELETE } from '@/app/api/tipos-contratos/[id]/route';

const manager = { userId: 'm-1', tenantId: 't-1', tenantRole: 'manager', role: 'user', planFeatures: { contratos: false }, permissions: new Set(['config.tipos-contrato.crear', 'config.tipos-contrato.eliminar', 'ventas.contratos.gestionar']), name: 'M', email: 'm@t.com', isActive: true };
const dependiente = { userId: 'd-1', tenantId: 't-1', tenantRole: 'dependiente', role: 'user', planFeatures: { contratos: true }, name: 'D', email: 'd@t.com', isActive: true };

function postReq(body: unknown): any {
  return { nextUrl: new URL('http://localhost/api/tipos-contratos'), json: async () => body } as never;
}

function getReq(search = ''): any {
  return { nextUrl: new URL(`http://localhost/api/tipos-contratos${search}`) } as never;
}

describe('CU-02 tipos custom solo manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['GET', () => GET(postReq({}), {})],
    ['POST', () => POST(postReq({ nombre: 'Especial' }), {})],
    ['DELETE', () => DELETE(postReq({}), { params: Promise.resolve({ id: 'tc-1' }) })],
  ])('%s rechaza plan Básico antes de acceder a Prisma', async (method, invoke) => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: manager } as never);
    const response = await invoke() as Response;
    expect(response.status).toBe(403);
    const db = prismaDefault as any;
    expect(db.tipoContratoCustom.findMany).not.toHaveBeenCalled();
    expect(db.tipoContratoCustom.findUnique).not.toHaveBeenCalled();
    expect(db.tipoContratoCustom.updateMany).not.toHaveBeenCalled();
    expect(db.tipoContratoCustom.create).not.toHaveBeenCalled();
    expect(db.tipoContratoCustom.delete).not.toHaveBeenCalled();
  });

  it('deniega creación a rol dependiente con 403', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: dependiente } as never);
    const res = (await POST(postReq({ nombre: 'Especial' }), {})) as Response;
    expect(res.status).toBe(403);
    const db = prismaDefault as any;
    expect(db.tipoContratoCustom.create).not.toHaveBeenCalled();
  });

  it('permite creación a manager', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: { ...manager, planFeatures: { contratos: true } } } as never);
    const db = prismaDefault as any;
    db.tipoContratoCustom.findUnique.mockResolvedValue(null);
    db.tipoContratoCustom.create.mockResolvedValue({ tipoCustomId: 'tc-1', nombre: 'Especial' });
    const res = (await POST(postReq({ nombre: 'Especial' }), {})) as Response;
    expect(res.status).toBe(201);
  });

  it('permite al administrador global con tenant seleccionado omitir la licencia', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        userId: 'admin-1',
        role: 'admin',
        tenantId: 't-1',
        planFeatures: { contratos: false },
      },
    } as never);
    const db = prismaDefault as any;
    db.tipoContratoCustom.findUnique.mockResolvedValue(null);
    db.tipoContratoCustom.create.mockResolvedValue({ tipoCustomId: 'tc-2', nombre: 'Global' });

    const response = await POST(postReq({ nombre: 'Global' }), {}) as Response;

    expect(response.status).toBe(201);
    expect(db.tipoContratoCustom.create).toHaveBeenCalledOnce();
  });

  it.each([
    ['POST', () => POST(postReq({ nombre: 'Global' }), {})],
    ['DELETE', () => DELETE(postReq({}), { params: Promise.resolve({ id: 'tc-1' }) })],
  ])('%s exige tenant para tipos custom incluso al administrador global', async (_method, invoke) => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { userId: 'admin-1', role: 'admin', permissions: new Set() },
    } as never);

    const response = await invoke() as Response;

    expect(response.status).toBe(403);
    const db = prismaDefault as any;
    expect(db.tipoContratoCustom.findUnique).not.toHaveBeenCalled();
    expect(db.tipoContratoCustom.updateMany).not.toHaveBeenCalled();
    expect(db.tipoContratoCustom.create).not.toHaveBeenCalled();
    expect(db.tipoContratoCustom.delete).not.toHaveBeenCalled();
  });

  it.each([
    ['', true],
    ['?activos=false', false],
  ])('GET restringe los tipos al tenant y conserva el filtro activo %s', async (search, activo) => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { ...manager, planFeatures: { contratos: true } },
    } as never);
    const db = prismaDefault as any;
    db.tipoContratoCustom.findMany.mockResolvedValue([]);

    const response = await GET(getReq(search), {}) as Response;

    expect(response.status).toBe(200);
    expect(db.tipoContratoCustom.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't-1', activo },
      }),
    );
  });

  it('POST ignora tenantId enviado por el cliente y usa el tenant autenticado', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { ...manager, planFeatures: { contratos: true } },
    } as never);
    const db = prismaDefault as any;
    db.tipoContratoCustom.findFirst.mockResolvedValue(null);
    db.tipoContratoCustom.create.mockResolvedValue({ tipoCustomId: 'tc-own', nombre: 'Propio' });

    const response = await POST(postReq({ nombre: 'Propio', tenantId: 'tenant-victim' }), {}) as Response;

    expect(response.status).toBe(201);
    expect(db.tipoContratoCustom.findFirst).toHaveBeenCalledWith({
      where: { nombre: 'Propio', tenantId: 't-1' },
    });
    expect(db.tipoContratoCustom.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 't-1', creadoPor: 'm-1' }),
      }),
    );
  });

  it('POST responde 409 si ya existe el nombre en el mismo tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { ...manager, planFeatures: { contratos: true } },
    } as never);
    const db = prismaDefault as any;
    db.tipoContratoCustom.findFirst.mockResolvedValue({ tipoCustomId: 'tc-existing' });

    const response = await POST(postReq({ nombre: 'Existente' }), {}) as Response;

    expect(response.status).toBe(409);
    expect(db.tipoContratoCustom.create).not.toHaveBeenCalled();
  });

  it('POST devuelve 400 ante un nombre inválido', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { ...manager, planFeatures: { contratos: true } },
    } as never);

    const response = await POST(postReq({ nombre: 'x' }), {}) as Response;

    expect(response.status).toBe(400);
    expect(prismaDefault.tipoContratoCustom.findFirst).not.toHaveBeenCalled();
  });

  it('GET, POST y DELETE traducen fallas de base de datos sin exponer detalles', async () => {
    const logError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { ...manager, planFeatures: { contratos: true } },
    } as never);
    const db = prismaDefault as any;
    db.tipoContratoCustom.findMany.mockRejectedValue(new Error('private database detail'));
    db.tipoContratoCustom.findFirst.mockRejectedValue(new Error('private database detail'));
    db.tipoContratoCustom.updateMany.mockRejectedValue(new Error('private database detail'));

    const getResponse = await GET(getReq(), {}) as Response;
    const postResponse = await POST(postReq({ nombre: 'Válido' }), {}) as Response;
    const deleteResponse = await DELETE(postReq({}), {
      params: Promise.resolve({ id: 'tc-own' }),
    }) as Response;

    expect(getResponse.status).toBe(500);
    expect(await getResponse.json()).toEqual({ error: 'Failed to fetch tipos de contratos' });
    expect(postResponse.status).toBe(500);
    expect(await postResponse.json()).toEqual({ error: 'Failed to create tipo de contrato' });
    expect(deleteResponse.status).toBe(500);
    expect(await deleteResponse.json()).toEqual({ error: 'Failed to delete tipo de contrato' });
    expect(logError).toHaveBeenCalledTimes(3);
    logError.mockRestore();
  });

  it('DELETE archiva solo el tipo activo del tenant y conserva la fila', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { ...manager, planFeatures: { contratos: true } },
    } as never);
    const db = prismaDefault as any;
    db.tipoContratoCustom.findFirst.mockResolvedValue({ tipoCustomId: 'tc-own' });
    db.tipoContratoCustom.updateMany.mockResolvedValue({ count: 1 });

    const response = await DELETE(postReq({}), { params: Promise.resolve({ id: 'tc-own' }) }) as Response;

    expect(response.status).toBe(200);
    expect(db.tipoContratoCustom.updateMany).toHaveBeenCalledWith({
      where: { tipoCustomId: 'tc-own', tenantId: 't-1', activo: true },
      data: { activo: false },
    });
    expect(db.tipoContratoCustom.delete).not.toHaveBeenCalled();
  });

  it.each(['foreign', 'legacy-null'])('%s type ID is not accessible or archived', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { ...manager, planFeatures: { contratos: true } },
    } as never);
    const db = prismaDefault as any;
    db.tipoContratoCustom.updateMany.mockResolvedValue({ count: 0 });

    const response = await DELETE(postReq({}), { params: Promise.resolve({ id: 'tc-hidden' }) }) as Response;

    expect(response.status).toBe(404);
    expect(db.tipoContratoCustom.updateMany).toHaveBeenCalledWith({
      where: { tipoCustomId: 'tc-hidden', tenantId: 't-1', activo: true },
      data: { activo: false },
    });
    expect(db.tipoContratoCustom.delete).not.toHaveBeenCalled();
  });
});
