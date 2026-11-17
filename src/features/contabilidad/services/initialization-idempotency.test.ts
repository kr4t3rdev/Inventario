import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runIdempotentInitialization } from './initialization-idempotency';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: vi.fn((fn) => fn(tx)) } }));
vi.mock('./accounting-tenant-lock-service', () => ({ acquireAccountingTenantLock: vi.fn() }));

const findFirst = vi.fn();
const create = vi.fn();
const updateMany = vi.fn();
const tx = { inicializacionContable: { findFirst, create, updateMany } } as never;
const input = { tenantId: 'tenant-a', idempotencyKey: 'key-a', payloadHash: 'a'.repeat(64) };

describe('idempotencia de inicialización contable', () => {
  beforeEach(() => { vi.clearAllMocks(); findFirst.mockResolvedValue(null); create.mockResolvedValue({ inicializacionId: 'init-a' }); updateMany.mockResolvedValue({ count: 1 }); });

  it('bloquea el tenant y persiste el resultado de la operación en la transacción recibida', async () => {
    const execute = vi.fn().mockResolvedValue({ periodoId: 'periodo-a' });
    const result = await runIdempotentInitialization(input, execute);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'ReadCommitted' });
    expect(acquireAccountingTenantLock).toHaveBeenCalledWith(tx, 'tenant-a');
    expect(vi.mocked(acquireAccountingTenantLock).mock.invocationCallOrder[0]).toBeLessThan(findFirst.mock.invocationCallOrder[0]);
    expect(execute).toHaveBeenCalledWith(tx);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a', inicializacionId: 'init-a', estado: 'EN_PROGRESO' }) }));
    expect(result).toEqual({ replayed: false, resultado: { periodoId: 'periodo-a' } });
  });

  it('devuelve resultado previo sin ejecutar de nuevo', async () => {
    findFirst.mockResolvedValue({ idempotencyKey: input.idempotencyKey, payloadHash: input.payloadHash, estado: 'COMPLETADA', resultado: { periodoId: 'periodo-a' } });
    const execute = vi.fn();
    expect(await runIdempotentInitialization(input, execute)).toEqual({ replayed: true, resultado: { periodoId: 'periodo-a' } });
    expect(execute).not.toHaveBeenCalled();
  });

  it('rechaza clave reutilizada con otra carga', async () => {
    findFirst.mockResolvedValue({ idempotencyKey: input.idempotencyKey, payloadHash: 'b'.repeat(64), estado: 'COMPLETADA', resultado: {} });
    const execute = vi.fn();
    await expect(runIdempotentInitialization(input, execute)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('rechaza una segunda inicialización del tenant aunque use otra clave', async () => {
    findFirst.mockResolvedValue({
      idempotencyKey: 'key-anterior', payloadHash: input.payloadHash,
      estado: 'COMPLETADA', resultado: { periodoId: 'periodo-a' },
    });
    const execute = vi.fn();
    await expect(runIdempotentInitialization({ ...input, idempotencyKey: 'key-nueva' }, execute))
      .rejects.toMatchObject({ code: 'INITIALIZATION_ALREADY_COMPLETED' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('no repite operaciones en curso o resultados corruptos', async () => {
    findFirst.mockResolvedValue({ idempotencyKey: input.idempotencyKey, payloadHash: input.payloadHash, estado: 'EN_PROGRESO', resultado: null });
    await expect(runIdempotentInitialization(input, vi.fn())).rejects.toMatchObject({ code: 'INITIALIZATION_INCOMPLETE' });
    findFirst.mockResolvedValue({ idempotencyKey: input.idempotencyKey, payloadHash: input.payloadHash, estado: 'COMPLETADA', resultado: [] });
    await expect(runIdempotentInitialization(input, vi.fn())).rejects.toMatchObject({ code: 'INITIALIZATION_INCOMPLETE' });
  });

  it('rechaza entradas inválidas antes de consultar o ejecutar', async () => {
    await expect(runIdempotentInitialization({ ...input, payloadHash: 'bad' }, vi.fn())).rejects.toThrow();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('rechaza un resultado no serializable y la operación queda para rollback', async () => {
    await expect(runIdempotentInitialization(input, vi.fn().mockResolvedValue({ importe: NaN }))).rejects.toThrow();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rechaza si se perdió la actualización de la evidencia', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(runIdempotentInitialization(input, vi.fn().mockResolvedValue({ ok: true }))).rejects.toMatchObject({ code: 'INITIALIZATION_INCOMPLETE' });
  });

  it('reanuda un borrador con la misma clave aunque la carga final cambie', async () => {
    findFirst.mockResolvedValue({ inicializacionId: 'init-a', idempotencyKey: input.idempotencyKey, payloadHash: 'b'.repeat(64), estado: 'BORRADOR', borrador: {} });
    const execute = vi.fn().mockResolvedValue({ periodoId: 'periodo-a' });
    const result = await runIdempotentInitialization(input, execute);
    expect(execute).toHaveBeenCalledWith(tx);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ inicializacionId: 'init-a', tenantId: 'tenant-a', estado: 'BORRADOR' }),
      data: expect.objectContaining({ estado: 'EN_PROGRESO', payloadHash: input.payloadHash }),
    }));
    expect(result).toEqual({ replayed: false, resultado: { periodoId: 'periodo-a' } });
  });

  it('rechaza reanudar un borrador con otra clave', async () => {
    findFirst.mockResolvedValue({ inicializacionId: 'init-a', idempotencyKey: 'otra-clave', payloadHash: 'b'.repeat(64), estado: 'BORRADOR', borrador: {} });
    const execute = vi.fn();
    await expect(runIdempotentInitialization(input, execute)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(execute).not.toHaveBeenCalled();
  });
});
