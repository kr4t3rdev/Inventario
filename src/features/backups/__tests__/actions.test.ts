/**
 * @description Tests unitarios para Server Actions de backups.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from "@/test/action-response";

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: vi.fn(),
  requireTenant: (user: AuthenticatedUser) => user.tenantId,
}));

const backupEngineRun = vi.fn();
const backupEngineCtor = vi.fn();
const restoreEngineCtor = vi.fn();
const createStorageMock = vi.hoisted(() => vi.fn(() => ({
  kind: 'mock-storage',
  delete: vi.fn(),
  getDownloadUrl: vi.fn(),
})));
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    tenant: { findUnique: vi.fn() },
    backupLog: {
      create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(),
      count: vi.fn(), update: vi.fn(), updateMany: vi.fn(),
    },
  },
}));

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
  createStorage: createStorageMock,
}));

const restoreEngineRestore = vi.fn();
vi.mock('@/features/backups/restore-engine', () => ({
  RestoreEngine: class {
    constructor(options: unknown) {
      restoreEngineCtor(options);
    }

    restore = restoreEngineRestore;
  },
  TENANT_SQL_RESTORE_UNAVAILABLE_MESSAGE:
    'La restauración SQL por tenant no está disponible. El formato estructurado seguro aún no está habilitado.',
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/db/platform-prisma', () => ({ prismaPlatform: mockPrisma }));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  createBackupAction,
  deleteBackupAction,
  downloadBackupAction,
  getBackupAction,
  getBackupStatusAction,
  getBackupsAction,
  importBackupAction,
  restoreBackupAction,
} from '@/features/backups/actions';
import { createStorage } from '@/features/backups/storage';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'admin-1',
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin',
  isActive: true,
};

const tenantUser: AuthenticatedUser = {
  userId: 'user-1',
  name: 'Tenant user',
  email: 'user@test.com',
  role: 'regularUser',
  tenantId: 'tenant-1',
  isActive: true,
};

describe('Backups Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    backupEngineRun.mockResolvedValue(undefined);
    restoreEngineCtor.mockClear();
    vi.mocked(createStorage).mockClear();
    restoreEngineRestore.mockResolvedValue({ backupLogId: 'log-1', restoredTables: 1, restoredRows: 1 });
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
    expect(expectActionFailure(result).error?.code).toBe('NOT_FOUND');
    expect(backupEngineCtor).not.toHaveBeenCalled();
  });

  it('deniega a usuarios tenant crear backups globales o de otro tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(tenantUser);

    const full = await createBackupAction({ type: 'full' });
    const foreign = await createBackupAction({ type: 'tenant', tenantId: 'tenant-2' });

    expect(full.success).toBe(false);
    expect(foreign.success).toBe(false);
    expect(prisma.backupLog.create).not.toHaveBeenCalled();
    expect(backupEngineCtor).not.toHaveBeenCalled();
  });

  it('permite crear un backup del tenant autenticado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(tenantUser);

    const result = await createBackupAction({ type: 'tenant', tenantId: 'tenant-1' });

    expect(result.success).toBe(true);
    expect(prisma.backupLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'tenant', tenantId: 'tenant-1' }),
    }));
    expect(backupEngineRun).toHaveBeenCalledWith(
      { type: 'tenant', tenantId: 'tenant-1' }, 'log-1', undefined, 'user-1',
    );
  });

  it('fuerza tenant y tipo propio en listado y conteo', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(tenantUser);
    vi.mocked(prisma.backupLog.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.backupLog.count).mockResolvedValue(0 as never);

    await getBackupsAction({ type: 'full', tenantId: 'tenant-2' });

    expect(prisma.backupLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { type: 'tenant', tenantId: 'tenant-1' },
    }));
    expect(prisma.backupLog.count).toHaveBeenCalledWith({
      where: { type: 'tenant', tenantId: 'tenant-1' },
    });
  });

  it('oculta registros ajenos en todas las acciones por ID antes de efectos externos', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(tenantUser);
    vi.mocked(prisma.backupLog.findFirst).mockResolvedValue(null as never);

    const results = await Promise.all([
      getBackupAction({ backupLogId: 'foreign-log' }),
      getBackupStatusAction({ backupLogId: 'foreign-log' }),
      downloadBackupAction({ backupLogId: 'foreign-log' }),
      deleteBackupAction({ backupLogId: 'foreign-log' }),
      restoreBackupAction({ backupLogId: 'foreign-log', confirmation: 'RESTORE' }),
    ]);

    expect(results.every((result) => !result.success)).toBe(true);
    expect(prisma.backupLog.findFirst).toHaveBeenCalledTimes(5);
    for (const [call] of vi.mocked(prisma.backupLog.findFirst).mock.calls) {
      expect(call.where).toEqual(expect.objectContaining({
        backupLogId: 'foreign-log',
        tenantId: 'tenant-1',
        type: 'tenant',
      }));
    }
    expect(prisma.backupLog.update).not.toHaveBeenCalled();
    expect(restoreEngineRestore).not.toHaveBeenCalled();
  });

  it('deniega importar backups a usuarios tenant antes de descargar', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(tenantUser);

    const result = await importBackupAction({ url: 'https://example.test/backup.gz' });

    expect(result.success).toBe(false);
    expect(prisma.backupLog.create).not.toHaveBeenCalled();
  });

  it.each([
    ['tenant user', tenantUser],
    ['platform admin', mockUser],
  ])('blocks legacy tenant SQL restore for a %s before storage or engine creation', async (_actor, actor) => {
    vi.mocked(getCurrentUser).mockResolvedValue(actor);
    vi.mocked(prisma.backupLog.findFirst).mockResolvedValue({
      type: 'tenant', status: 'completed', fileName: 'tenant.sql.gz', fileUrl: null,
    } as never);

    const result = await restoreBackupAction({ backupLogId: 'tenant-log', confirmation: 'RESTORE' });

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.message).toContain('formato estructurado seguro');
    expect(createStorage).not.toHaveBeenCalled();
    expect(restoreEngineCtor).not.toHaveBeenCalled();
    expect(restoreEngineRestore).not.toHaveBeenCalled();
    expect(prisma.backupLog.create).not.toHaveBeenCalled();
    expect(prisma.backupLog.update).not.toHaveBeenCalled();
  });

  it.each([
    ['full', 'FULL RESTORE'],
    ['imported', 'FULL RESTORE'],
    ['config', 'RESTORE'],
  ])('keeps the privileged %s restore path separate', async (type, confirmation) => {
    vi.mocked(prisma.backupLog.findFirst).mockResolvedValue({
      type, status: 'completed', fileName: `${type}.sql.gz`, fileUrl: null,
    } as never);

    const result = await restoreBackupAction({ backupLogId: `${type}-log`, confirmation });

    expect(result.success).toBe(true);
    expect(createStorage).toHaveBeenCalledTimes(1);
    expect(restoreEngineCtor).toHaveBeenCalledTimes(1);
    expect(restoreEngineRestore).toHaveBeenCalledWith(`${type}-log`, `${type}.sql.gz`, 'admin-1');
  });
});
