/**
 * @description Tests de saneamiento del PUT de contratos (CTF-2): numeración y
 *              ciclo de vida (estado, numeroContrato, fechaAprobacion,
 *              aprobadoPor) no son escribibles por el cliente; la edición de
 *              contenido sigue funcionando.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn().mockResolvedValue(null) },
}));
vi.mock('@/features/contratos/lib/numeroContratoGenerator', () => ({
  generarProximoConsecutivo: vi.fn(),
  formatearNumeroContrato: vi.fn(),
  crearContratoConConsecutivo: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    contratoVersion: { create: vi.fn() },
    contratoAprobacion: { findMany: vi.fn(), create: vi.fn() },
    tenantMembership: { findFirst: vi.fn() },
    cliente: { findFirst: vi.fn(), update: vi.fn() },
    vendor: { findFirst: vi.fn() },
  },
}));
vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import { updateContratoAction } from '@/features/contratos/actions';
import { updateContratoHandler } from '@/features/contratos/api/handlers';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'manager',
};

const contratoExistente = {
  contratoId: 'ct-1',
  tenantId: 'tenant-test',
  numeroContrato: 'COMPRA_VENTA-2025-001',
  numeroConsecutivo: 1,
  tipo: 'COMPRA_VENTA',
  estado: 'BORRADOR',
  clienteId: 'cli-1',
  fechaInicio: new Date(),
  creadoPor: 'user-1',
};

const camposProtegidos = {
  estado: 'ACTIVO',
  numeroContrato: 'X-001',
  fechaAprobacion: new Date().toISOString(),
  aprobadoPor: 'user-9',
};

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

describe('CTF-2 saneamiento del PUT de contratos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue(contratoExistente as any);
    vi.mocked(prisma.contrato.update).mockResolvedValue(contratoExistente as any);
  });

  describe('updateContratoAction', () => {
    it('ignora estado, numeroContrato, fechaAprobacion y aprobadoPor del payload', async () => {
      const result = await updateContratoAction({
        contratoId: 'ct-1',
        monto: '500',
        ...camposProtegidos,
      } as any);

      expect(result.success).toBe(true);
      expect(prisma.contrato.update).toHaveBeenCalledTimes(1);
      const call = vi.mocked(prisma.contrato.update).mock.calls[0][0] as any;
      expect(call.data.monto).toBe('500');
      expect(call.data.estado).toBeUndefined();
      expect(call.data.numeroContrato).toBeUndefined();
      expect(call.data.fechaAprobacion).toBeUndefined();
      expect(call.data.aprobador).toBeUndefined();
    });

    it('mantiene la edición de contenido (monto y observaciones)', async () => {
      const result = await updateContratoAction({
        contratoId: 'ct-1',
        monto: '700',
        observaciones: 'Actualización de contenido',
      } as any);

      expect(result.success).toBe(true);
      expect(prisma.contrato.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contratoId: 'ct-1' },
          data: expect.objectContaining({ monto: '700', observaciones: 'Actualización de contenido' }),
        }),
      );
    });
  });

  describe('updateContratoHandler', () => {
    const req = () => new NextRequestShim('http://localhost/api/contratos/ct-1', {
      method: 'PUT',
      body: JSON.stringify({
        observaciones: 'Contenido editable',
        ...camposProtegidos,
      }),
    });

    it('ignora estado, numeroContrato, fechaAprobacion y aprobadoPor del payload', async () => {
      const res = await updateContratoHandler(req() as any, { params: Promise.resolve({ id: 'ct-1' }) }) as Response;
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(prisma.contrato.update).toHaveBeenCalledTimes(1);
      const call = vi.mocked(prisma.contrato.update).mock.calls[0][0] as any;
      expect(call.data.observaciones).toBe('Contenido editable');
      expect(call.data.estado).toBeUndefined();
      expect(call.data.numeroContrato).toBeUndefined();
      expect(call.data.fechaAprobacion).toBeUndefined();
      expect(call.data.aprobador).toBeUndefined();
      void json;
    });

    it('no consulta membresía para aprobadoPor porque ya no es escribible', async () => {
      await updateContratoHandler(req() as any, { params: Promise.resolve({ id: 'ct-1' }) });

      expect(prisma.tenantMembership.findFirst).not.toHaveBeenCalled();
    });

    it('mantiene la edición de contenido (observaciones)', async () => {
      const res = await updateContratoHandler(req() as any, { params: Promise.resolve({ id: 'ct-1' }) }) as Response;

      expect(res.status).toBe(200);
      expect(prisma.contrato.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ observaciones: 'Contenido editable' }),
        }),
      );
    });
  });
});
