/**
 * @description Tests unitarios para Server Actions de backups.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const backupEngineRun = vi.fn();
const backupEngineCtor = vi.fn();

vi.mock('@/features/backups/backup-engine', () => ({
  BackupEngine: class {
    constructor(options: unknown) {
      backupEngineCtor(options);
    }

    run = backupEngineRun;
  },
  validateBackupFile: vi.fn(),
}));

vi.mock('@/features/backups/storage', () => ({
  createStorage: vi.fn(() => ({ kind: 'mock-storage' })),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(),
    },
    backupLog: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { createBackupAction } from '@/features/backups/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'admin-1',
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin',
  isActive: true,
};

describe('Backups Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    backupEngineRun.mockResolvedValue(undefined);
    vi.mocked(prisma.backupLog.create).mockResolvedValue({
      backupLogId: 'log-1',
    } as never);
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
      tenantId: 'tenant-1',
    } as never);
  });

  it('inyecta el prisma singleton al BackupEngine', async () => {
    const result = await createBackupAction({ type: 'full' });

    expect(result.success).toBe(true);
    expect(backupEngineCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        prisma,
        storage: expect.any(Object),
      }),
    );
    expect(backupEngineRun).toHaveBeenCalledWith(
      { type: 'full', tenantId: undefined },
      'log-1',
      undefined,
      'admin-1',
    );
  });

  it('valida que el tenant exista antes de disparar backup por tenant', async () => {
    await createBackupAction({ type: 'tenant', tenantId: 'tenant-1' });

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      select: { tenantId: true },
    });
  });

  it('retorna NOT_FOUND si el tenant no existe', async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null as never);

    const result = await createBackupAction({ type: 'tenant', tenantId: 'tenant-x' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
    expect(backupEngineCtor).not.toHaveBeenCalled();
  });
});
