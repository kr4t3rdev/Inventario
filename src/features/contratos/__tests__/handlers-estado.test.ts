/**
 * @description Tests de handlers de estado de contratos (CTF-1): bulk por id con
 *              fallidos en 200 y aprobación enrutada por la máquina de estados
 *              con aprobador server-side.
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
    tenantMembership: { findFirst: vi.fn() },
    cliente: { update: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    vendor: { findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contratos/lib/numeroContratoGenerator', () => ({
  generarProximoConsecutivo: vi.fn(),
  formatearNumeroContrato: vi.fn(),
  crearContratoConConsecutivo: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import {
  bulkUpdateContratoStatusHandler,
  createContratoAprobacionHandler,
} from '@/features/contratos/api/handlers';

const userTenantA = {
  userId: 'user-a',
  tenantId: 'tenant-A',
  role: 'admin',
  name: 'User A',
  email: 'a@test.com',
  isActive: true,
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

function req(url: string, init?: RequestInit): any {
  return new NextRequestShim(url, init);
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

const contratoPendiente = {
  contratoId: 'ct-1',
  tenantId: 'tenant-A',
  numeroContrato: 'CV-0001',
  tipo: 'COMPRA_VENTA',
  estado: 'PENDIENTE_APROBACION',
};

describe('CTF-1 handlers de estado de contratos', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authenticateUser).mockResolvedValue({ user: userTenantA } as never);
  });

  describe('bulkUpdateContratoStatusHandler', () => {
    it('responde 200 con actualizados y fallidos por id', async () => {
      vi.mocked(prisma.contrato.findMany)
        .mockResolvedValueOnce([
          { contratoId: 'ct-1', estado: 'PENDIENTE_APROBACION' },
          { contratoId: 'ct-2', estado: 'FINALIZADO' },
        ] as never)
        .mockResolvedValueOnce([{ contratoId: 'ct-1', estado: 'APROBADO' }] as never);
      vi.mocked(prisma.contrato.updateMany).mockResolvedValue({ count: 1 } as never);

      const res = await bulkUpdateContratoStatusHandler(
        req('http://localhost/api/contratos/bulk/update-status', {
          method: 'POST',
          body: JSON.stringify({ ids: ['ct-1', 'ct-2'], estado: 'APROBADO' }),
        }),
      ) as Response;
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.actualizados).toEqual(['ct-1']);
      expect(json.fallidos).toEqual([
        { contratoId: 'ct-2', motivo: 'No se puede cambiar un contrato de FINALIZADO a APROBADO' },
      ]);
      expect(prisma.contrato.updateMany).toHaveBeenCalledWith({
        where: {
          contratoId: { in: ['ct-1'] },
          tenantId: 'tenant-A',
          estado: { in: ['PENDIENTE_APROBACION'] },
        },
        data: { estado: 'APROBADO' },
      });
    });

    it('reconcilia tras el claim: un contrato anulado concurrentemente queda como fallido (B-2)', async () => {
      vi.mocked(prisma.contrato.findMany)
        .mockResolvedValueOnce([
          { contratoId: 'ct-1', estado: 'PENDIENTE_APROBACION' },
          { contratoId: 'ct-2', estado: 'PENDIENTE_APROBACION' },
        ] as never)
        .mockResolvedValueOnce([{ contratoId: 'ct-1', estado: 'APROBADO' }] as never);
      vi.mocked(prisma.contrato.updateMany).mockResolvedValue({ count: 1 } as never);

      const res = await bulkUpdateContratoStatusHandler(
        req('http://localhost/api/contratos/bulk/update-status', {
          method: 'POST',
          body: JSON.stringify({ ids: ['ct-1', 'ct-2'], estado: 'APROBADO' }),
        }),
      ) as Response;
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.actualizados).toEqual(['ct-1']);
      expect(json.fallidos).toEqual([
        { contratoId: 'ct-2', motivo: 'El contrato cambió de estado concurrentemente' },
      ]);
    });

    it('no responde 500 cuando todas las transiciones son inválidas', async () => {
      vi.mocked(prisma.contrato.findMany).mockResolvedValue([
        { contratoId: 'ct-1', estado: 'BORRADOR' },
      ] as never);

      const res = await bulkUpdateContratoStatusHandler(
        req('http://localhost/api/contratos/bulk/update-status', {
          method: 'POST',
          body: JSON.stringify({ ids: ['ct-1'], estado: 'ACTIVO' }),
        }),
      ) as Response;
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.actualizados).toEqual([]);
      expect(json.fallidos).toHaveLength(1);
      expect(prisma.contrato.updateMany).not.toHaveBeenCalled();
    });

    it('reporta los ids inexistentes como fallidos', async () => {
      vi.mocked(prisma.contrato.findMany)
        .mockResolvedValueOnce([{ contratoId: 'ct-1', estado: 'PENDIENTE_APROBACION' }] as never)
        .mockResolvedValueOnce([{ contratoId: 'ct-1', estado: 'APROBADO' }] as never);
      vi.mocked(prisma.contrato.updateMany).mockResolvedValue({ count: 1 } as never);

      const res = await bulkUpdateContratoStatusHandler(
        req('http://localhost/api/contratos/bulk/update-status', {
          method: 'POST',
          body: JSON.stringify({ ids: ['ct-1', 'ct-inexistente'], estado: 'APROBADO' }),
        }),
      ) as Response;
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.actualizados).toEqual(['ct-1']);
      expect(json.fallidos).toEqual([
        { contratoId: 'ct-inexistente', motivo: 'Contrato no encontrado' },
      ]);
    });
  });

  describe('createContratoAprobacionHandler', () => {
    beforeEach(() => {
      vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({ membershipId: 'm-1' } as never);
      vi.mocked(prisma.contratoAprobacion.create).mockResolvedValue({} as never);
    });

    it('aprobación sobre PENDIENTE_APROBACION transiciona a APROBADO con aprobador server-side', async () => {
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue(contratoPendiente as never);

      const res = await createContratoAprobacionHandler(
        req('http://localhost/api/contratos/ct-1/aprobaciones', {
          method: 'POST',
          body: JSON.stringify({ nivel: 1, aprobadorId: 'user-9', estado: 'APROBADO' }),
        }),
        params('ct-1'),
      ) as Response;

      vi.mocked(prisma.contrato.updateMany).mockResolvedValue({ count: 1 } as never);

      expect(res.status).toBe(200);
      expect(prisma.contrato.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ contratoId: 'ct-1', tenantId: 'tenant-A', estado: 'PENDIENTE_APROBACION' }),
          data: expect.objectContaining({
            estado: 'APROBADO',
            aprobadoPor: 'user-9',
            fechaAprobacion: expect.any(Date),
          }),
        }),
      );
    });

    it('aprobación sobre contrato no pendiente se registra sin cambiar el estado', async () => {
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ ...contratoPendiente, estado: 'BORRADOR' } as never);

      const res = await createContratoAprobacionHandler(
        req('http://localhost/api/contratos/ct-1/aprobaciones', {
          method: 'POST',
          body: JSON.stringify({ nivel: 1, aprobadorId: 'user-9', estado: 'APROBADO' }),
        }),
        params('ct-1'),
      ) as Response;

      expect(res.status).toBe(200);
      expect(prisma.contratoAprobacion.create).toHaveBeenCalled();
      expect(prisma.contrato.updateMany).not.toHaveBeenCalled();
    });

    it('una anulación concurrente no se revive: el claim condicional afecta 0 filas (B-2)', async () => {
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue(contratoPendiente as never);
      vi.mocked(prisma.contrato.updateMany).mockResolvedValue({ count: 0 } as never);

      const res = await createContratoAprobacionHandler(
        req('http://localhost/api/contratos/ct-1/aprobaciones', {
          method: 'POST',
          body: JSON.stringify({ nivel: 1, aprobadorId: 'user-9', estado: 'APROBADO' }),
        }),
        params('ct-1'),
      ) as Response;

      expect(res.status).toBe(200);
      // La aprobación queda registrada pero el estado del contrato no cambia.
      expect(prisma.contratoAprobacion.create).toHaveBeenCalled();
      expect(prisma.contrato.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estado: 'PENDIENTE_APROBACION' }),
          data: expect.objectContaining({ estado: 'APROBADO' }),
        }),
      );
    });

    it('aprobación sobre contrato terminal no muta el contrato', async () => {
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ ...contratoPendiente, estado: 'FINALIZADO' } as never);

      await createContratoAprobacionHandler(
        req('http://localhost/api/contratos/ct-1/aprobaciones', {
          method: 'POST',
          body: JSON.stringify({ nivel: 1, aprobadorId: 'user-9', estado: 'APROBADO' }),
        }),
        params('ct-1'),
      );

      expect(prisma.contrato.updateMany).not.toHaveBeenCalled();
    });
  });
});
