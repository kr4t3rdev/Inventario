import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  create: vi.fn().mockRejectedValue(new Error('existing identity')),
  tenantCreate: vi.fn(),
  disconnect: vi.fn(),
  construct: vi.fn(),
  commitFailure: false,
  deleted: [] as string[],
}));
vi.mock('../../../src/generated/prisma', () => ({
  PrismaClient: class {
    constructor() { state.construct(); }
    $disconnect = state.disconnect;
    $executeRawUnsafe = vi.fn(() => { state.deleted.push('schema'); return 0; });
    $transaction = async (callback: (tx: unknown) => Promise<unknown>) => {
      const result = await callback({
      tenant: { create: state.tenantCreate, deleteMany: vi.fn(() => { state.deleted.push('tenant'); return { count: 1 }; }) },
      user: { create: state.create, deleteMany: vi.fn(() => { state.deleted.push('user'); return { count: 1 }; }) },
      plan: { findFirst: vi.fn().mockResolvedValue({ planId: 'test-plan' }) },
      review: { upsert: vi.fn(), deleteMany: vi.fn(() => { state.deleted.push('review'); return { count: 1 }; }) },
      tenantMembership: { upsert: vi.fn(), deleteMany: vi.fn(() => { state.deleted.push('membership'); return { count: 1 }; }) },
      tenantLicense: { upsert: vi.fn(), deleteMany: vi.fn(() => { state.deleted.push('license'); return { count: 1 }; }) },
      producto: { upsert: vi.fn(), deleteMany: vi.fn(() => { state.deleted.push('producto'); return { count: 2 }; }) },
      servicios: { upsert: vi.fn(), deleteMany: vi.fn(() => { state.deleted.push('servicio'); return { count: 2 }; }) },
      vendor: { upsert: vi.fn(), deleteMany: vi.fn(() => { state.deleted.push('vendor'); return { count: 1 }; }) },
      cliente: { upsert: vi.fn(), deleteMany: vi.fn(() => { state.deleted.push('cliente'); return { count: 1 }; }) },
      unidad: { upsert: vi.fn(), deleteMany: vi.fn(() => { state.deleted.push('unidad'); return { count: 2 }; }) },
      categoria: { upsert: vi.fn(), deleteMany: vi.fn(() => { state.deleted.push('categoria'); return { count: 1 }; }) },
      almacen: { upsert: vi.fn(), deleteMany: vi.fn(() => { state.deleted.push('almacen'); return { count: 1 }; }) },
      });
      if (state.commitFailure) throw new Error('commit failed');
      return result;
    };
  },
}));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hash') } }));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); state.deleted.length = 0; });

const safe = 'postgresql://test:test@127.0.0.1:5433/tcp_test_run1';
const cases = [
  ['missing opt-in', 'ALLOW_DISPOSABLE_TEST_DB', ''],
  ['remote target', 'DATABASE_URL', 'postgresql://test:test@remote.invalid:5433/tcp_test_run1'],
  ['alternate direct target', 'DIRECT_URL', 'postgresql://test:test@remote.invalid:5433/tcp_test_run1'],
  ['production mode', 'NODE_ENV', 'production'],
  ['missing password', 'E2E_TEST_PASSWORD', ''],
];

/** @description Set only explicit safe test environment values. @returns {void} */
function environment() {
  vi.stubEnv('ALLOW_DISPOSABLE_TEST_DB', '1');
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DATABASE_URL', safe);
  vi.stubEnv('DATABASE_URL_TEST', safe);
  vi.stubEnv('DIRECT_URL', safe);
  vi.stubEnv('E2E_TEST_PASSWORD', 'test-only-password-not-used');
}

it.each(cases)('rejects %s before Prisma construction', async (_label, key, value) => {
  environment();
  vi.stubEnv(key, value);
  const { run } = await import('../../seed-e2e-user');
  await expect(run()).rejects.toThrow();
  expect(state.construct).not.toHaveBeenCalled();
  expect(state.tenantCreate).not.toHaveBeenCalled();
  expect(state.create).not.toHaveBeenCalled();
});

it('does not reset an existing identity and disconnects on collision', async () => {
  environment();
  const { run } = await import('../../seed-e2e-user');
  await expect(run()).rejects.toThrow('existing identity');
  expect(state.create).toHaveBeenCalledOnce();
  expect(state.create.mock.calls[0][0].data.role).not.toBe('admin');
  expect(state.disconnect).toHaveBeenCalledOnce();
});

it('never logs success if transaction commit fails, and disconnects', async () => {
  environment();
  state.create.mockResolvedValueOnce({ userId: 'isolated-user' });
  state.commitFailure = true;
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    const { run } = await import('../../seed-e2e-user');
    await expect(run()).rejects.toThrow('commit failed');
    expect(log).not.toHaveBeenCalled();
    expect(state.disconnect).toHaveBeenCalledOnce();
  } finally { state.commitFailure = false; log.mockRestore(); }
});

it('returns fixture ownership and removes every owned record during teardown', async () => {
  environment();
  state.create.mockResolvedValueOnce({ userId: 'isolated-user' });
  const { cleanup, run } = await import('../../seed-e2e-user');
  const ownership = await run();
  expect(ownership.tenantId).toMatch(/^e2e-/);
  expect(ownership.userId).toBe('isolated-user');
  expect(ownership.email).toMatch(/^e2e-.*@test\.invalid$/);
  await cleanup(ownership);
  expect(state.deleted).toEqual(['schema']);
  expect(state.disconnect).toHaveBeenCalledTimes(2);
});
