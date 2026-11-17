import { beforeEach, describe, expect, it, vi } from 'vitest';
import { guardarBorradorInicializacion, obtenerBorradorInicializacion } from './initialization-idempotency';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: vi.fn((fn) => fn(tx)) } }));
vi.mock('./accounting-tenant-lock-service', () => ({ acquireAccountingTenantLock: vi.fn() }));

const findFirst = vi.fn();
const create = vi.fn();
const updateMany = vi.fn();
const tx = { inicializacionContable: { findFirst, create, updateMany } } as never;
const base = { tenantId: 'tenant-a', idempotencyKey: 'draft-key' };
const draft = { fechaCorte: '2026-11-01', monedaFuncional: 'CUP', cuentas: [{ numeroCuenta: 'QA-001' }] };

describe('borrador reanudable de inicialización', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({ inicializacionId: 'init-a' });
    updateMany.mockResolvedValue({ count: 1 });
  });

  it('guarda un borrador nuevo bajo el bloqueo del tenant', async () => {
    const result = await guardarBorradorInicializacion({ ...base, borrador: draft });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'ReadCommitted' });
    expect(acquireAccountingTenantLock).toHaveBeenCalledWith(tx, 'tenant-a');
    expect(vi.mocked(acquireAccountingTenantLock).mock.invocationCallOrder[0]).toBeLessThan(findFirst.mock.invocationCallOrder[0]);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'tenant-a', idempotencyKey: 'draft-key', estado: 'BORRADOR' }),
    }));
    expect(result).toMatchObject({ idempotencyKey: 'draft-key', estado: 'BORRADOR' });
    expect(result.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('actualiza un borrador existente con la misma clave', async () => {
    findFirst.mockResolvedValue({ inicializacionId: 'init-a', idempotencyKey: 'draft-key', payloadHash: 'a'.repeat(64), estado: 'BORRADOR', borrador: draft });
    const result = await guardarBorradorInicializacion({ ...base, borrador: { ...draft, fechaCorte: '2026-11-02' } });
    expect(create).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ inicializacionId: 'init-a', tenantId: 'tenant-a', estado: 'BORRADOR' }),
    }));
    expect(result.estado).toBe('BORRADOR');
  });

  it('rechaza actualizar un borrador con otra clave', async () => {
    findFirst.mockResolvedValue({ inicializacionId: 'init-a', idempotencyKey: 'draft-key', payloadHash: 'a'.repeat(64), estado: 'BORRADOR', borrador: draft });
    await expect(guardarBorradorInicializacion({ ...base, idempotencyKey: 'otra-clave', borrador: draft }))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(create).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rechaza guardar un borrador si la inicialización ya está completada o en curso', async () => {
    findFirst.mockResolvedValue({ inicializacionId: 'init-a', idempotencyKey: 'draft-key', payloadHash: 'a'.repeat(64), estado: 'COMPLETADA', resultado: {} });
    await expect(guardarBorradorInicializacion({ ...base, borrador: draft }))
      .rejects.toMatchObject({ code: 'INITIALIZATION_ALREADY_COMPLETED' });
    findFirst.mockResolvedValue({ inicializacionId: 'init-a', idempotencyKey: 'draft-key', payloadHash: 'a'.repeat(64), estado: 'EN_PROGRESO', resultado: null });
    await expect(guardarBorradorInicializacion({ ...base, borrador: draft }))
      .rejects.toMatchObject({ code: 'INITIALIZATION_INCOMPLETE' });
  });

  it('rechaza un borrador con datos inválidos antes de consultar', async () => {
    await expect(guardarBorradorInicializacion({ ...base, borrador: { cuentas: [{ saldoInicial: '1.001' }] } })).rejects.toThrow();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('devuelve null cuando no hay borrador', async () => {
    expect(await obtenerBorradorInicializacion(base)).toBeNull();
  });

  it('retoma el borrador con la misma clave', async () => {
    findFirst.mockResolvedValue({ inicializacionId: 'init-a', idempotencyKey: 'draft-key', payloadHash: 'a'.repeat(64), estado: 'BORRADOR', borrador: draft });
    const result = await obtenerBorradorInicializacion(base);
    expect(result).toMatchObject({ idempotencyKey: 'draft-key', payloadHash: 'a'.repeat(64), borrador: draft });
  });

  it('rechaza retomar un borrador con otra clave o ya completado', async () => {
    findFirst.mockResolvedValue({ inicializacionId: 'init-a', idempotencyKey: 'draft-key', payloadHash: 'a'.repeat(64), estado: 'BORRADOR', borrador: draft });
    await expect(obtenerBorradorInicializacion({ ...base, idempotencyKey: 'otra-clave' }))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    findFirst.mockResolvedValue({ inicializacionId: 'init-a', idempotencyKey: 'draft-key', payloadHash: 'a'.repeat(64), estado: 'COMPLETADA', resultado: {} });
    await expect(obtenerBorradorInicializacion(base))
      .rejects.toMatchObject({ code: 'INITIALIZATION_ALREADY_COMPLETED' });
    findFirst.mockResolvedValue({ inicializacionId: 'init-a', idempotencyKey: 'draft-key', payloadHash: 'a'.repeat(64), estado: 'EN_PROGRESO', resultado: null });
    await expect(obtenerBorradorInicializacion(base))
      .rejects.toMatchObject({ code: 'INITIALIZATION_INCOMPLETE' });
  });

  it('rechaza retomar un borrador corrupto', async () => {
    findFirst.mockResolvedValue({ inicializacionId: 'init-a', idempotencyKey: 'draft-key', payloadHash: 'a'.repeat(64), estado: 'BORRADOR', borrador: [] });
    await expect(obtenerBorradorInicializacion(base))
      .rejects.toMatchObject({ code: 'INITIALIZATION_INCOMPLETE' });
  });
});
