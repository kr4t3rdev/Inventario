/**
 * @description Tests de endurecimiento de tipos de contrato custom (CU-02, solo manager).
 * @param {void} No aplica - suite de tests
 * @returns {void} Aserciones vitest
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: { tipoContratoCustom: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn() } },
  prisma: { tipoContratoCustom: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn() } },
}));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import prismaDefault from '@/lib/prisma';
import { POST } from '@/app/api/tipos-contratos/route';

const manager = { userId: 'm-1', tenantId: 't-1', tenantRole: 'manager', role: 'user', name: 'M', email: 'm@t.com', isActive: true };
const dependiente = { userId: 'd-1', tenantId: 't-1', tenantRole: 'dependiente', role: 'user', name: 'D', email: 'd@t.com', isActive: true };

function postReq(body: unknown): any {
  return { nextUrl: new URL('http://localhost/api/tipos-contratos'), json: async () => body } as never;
}

describe('CU-02 tipos custom solo manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deniega creación a rol dependiente con 403', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: dependiente } as never);
    const res = (await POST(postReq({ nombre: 'Especial' }))) as Response;
    expect(res.status).toBe(403);
    const db = prismaDefault as any;
    expect(db.tipoContratoCustom.create).not.toHaveBeenCalled();
  });

  it('permite creación a manager', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: manager } as never);
    const db = prismaDefault as any;
    db.tipoContratoCustom.findUnique.mockResolvedValue(null);
    db.tipoContratoCustom.create.mockResolvedValue({ tipoCustomId: 'tc-1', nombre: 'Especial' });
    const res = (await POST(postReq({ nombre: 'Especial' }))) as Response;
    expect(res.status).toBe(201);
  });
});
