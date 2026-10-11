import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionError } from '@/lib/server-actions/types';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { runCashActionWithReplay } from '@/features/contabilidad/services/cash-action-replay';

const { validate } = vi.hoisted(() => ({ validate: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/services/with-period-validation', () => ({
  withPeriodValidation: <T>(
    extractDate: (input: T) => Date,
    handler: (input: T, user: AuthenticatedUser) => Promise<void>,
  ) => async (input: T, user: AuthenticatedUser) => {
    await validate(extractDate(input), user);
    return handler(input, user);
  },
}));

const user: AuthenticatedUser = {
  userId: 'actor', tenantId: 'tenant', name: 'Actor', email: 'actor@test.local',
  role: 'regularUser', isActive: true, tenantRole: 'manager',
};

describe('runCashActionWithReplay — límites del guard y replay', () => {
  beforeEach(() => vi.resetAllMocks());

  it('devuelve el replay autorizado sin ejecutar guard ni writer', async () => {
    const operation = { id: 'confirmed' };
    const write = vi.fn();
    expect(await runCashActionWithReplay({ user,
      findReplay: async () => operation, write })).toBe(operation);
    expect(validate).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('entrega al writer exactamente la fecha y actor validados', async () => {
    const operation = { id: 'new' };
    const write = vi.fn().mockResolvedValue(operation);
    expect(await runCashActionWithReplay({ user,
      findReplay: async () => null, write })).toBe(operation);
    expect(write).toHaveBeenCalledWith(validate.mock.calls[0][0]);
    expect(validate).toHaveBeenCalledWith(expect.any(Date), user);
  });

  it.each(['PERIODO_CERRADO', 'PERIODO_APROBADO', 'PERIODO_EN_CIERRE'])(
    '%s relee un commit concurrente sin nueva escritura', async (code) => {
      const operation = { id: 'concurrent' };
      validate.mockRejectedValue(new ActionError('Período protegido', code));
      const findReplay = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(operation);
      const write = vi.fn();
      expect(await runCashActionWithReplay({ user, findReplay, write })).toBe(operation);
      expect(write).not.toHaveBeenCalled();
    },
  );

  it('conserva el rechazo del período si no hay operación confirmada', async () => {
    const error = new ActionError('Cerrado', 'PERIODO_CERRADO');
    validate.mockRejectedValue(error);
    const write = vi.fn();
    await expect(runCashActionWithReplay({ user,
      findReplay: async () => null, write })).rejects.toBe(error);
    expect(write).not.toHaveBeenCalled();
  });

  it('conserva el conflicto del replay que confirmó durante el guard', async () => {
    validate.mockRejectedValue(new ActionError('Cerrado', 'PERIODO_CERRADO'));
    const conflict = new ActionError('Payload divergente', 'IDEMPOTENCY_CONFLICT');
    const findReplay = vi.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(conflict);
    await expect(runCashActionWithReplay({ user, findReplay, write: vi.fn() }))
      .rejects.toBe(conflict);
  });

  it('no encubre un error inesperado del guard mediante replay', async () => {
    const error = new Error('Auditoría no disponible');
    validate.mockRejectedValue(error);
    const findReplay = vi.fn().mockResolvedValue(null);
    await expect(runCashActionWithReplay({ user, findReplay, write: vi.fn() }))
      .rejects.toBe(error);
    expect(findReplay).toHaveBeenCalledTimes(1);
  });

  it('no encubre fallos de posting del writer mediante una relectura', async () => {
    const error = new ActionError('Fallo SQL', 'PERIODO_CERRADO');
    const findReplay = vi.fn().mockResolvedValue(null);
    await expect(runCashActionWithReplay({ user, findReplay,
      write: vi.fn().mockRejectedValue(error) })).rejects.toBe(error);
    expect(findReplay).toHaveBeenCalledTimes(1);
  });
});
