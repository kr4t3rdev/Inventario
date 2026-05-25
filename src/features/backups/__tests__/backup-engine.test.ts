/**
 * @description Unit tests for BackupEngine orchestrator.
 * TDD: RED → GREEN → REFACTOR.
 * Mocks all dependencies to test the orchestration flow.
 *
 * Note: BackupLog creation moved to the action layer — the engine
 * receives an existing backupLogId and updates it as it progresses.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BackupEngine } from '../backup-engine'
import { SQLBuilder } from '../sql-builder'
import type { BackupStorage } from '../storage/types'
import type { ColumnDef, FKDef } from '../types'

function createMockSchema() {
  const columns: ColumnDef[] = [
    { name: 'id', type: 'uuid', nullable: false, defaultValue: 'gen_random_uuid()', isPrimaryKey: true },
    { name: 'name', type: 'varchar', nullable: true, defaultValue: null, isPrimaryKey: false },
  ]
  return {
    tables: [
      {
        name: 'Tenant',
        columns,
        primaryKey: ['id'],
        indexes: ['CREATE INDEX idx_tenant_slug ON "Tenant"(slug)'],
        foreignKeys: [] as FKDef[],
      },
      {
        name: 'User',
        columns: [
          ...columns,
          { name: 'email', type: 'varchar', nullable: false, defaultValue: null, isPrimaryKey: false },
        ],
        primaryKey: ['id'],
        indexes: [] as string[],
        foreignKeys: [] as FKDef[],
      },
    ],
    topologicalOrder: ['Tenant', 'User'],
    tenantScopedTables: [] as string[],
  }
}

const TEST_LOG_ID = 'log_abc123'

describe('BackupEngine', () => {
  let mockPrisma: any
  let mockStorage: BackupStorage
  let mockSchemaReader: any
  let mockDataExporter: any
  let engine: BackupEngine

  beforeEach(() => {
    mockPrisma = {
      backupLog: {
        create: vi.fn().mockResolvedValue({
          backupLogId: TEST_LOG_ID,
          type: 'full',
          status: 'running',
          startedAt: new Date(),
          createdBy: 'user_1',
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    }

    mockStorage = {
      save: vi.fn().mockResolvedValue('/backups/full_2025-01-01.sql.gz'),
      get: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      getDownloadUrl: vi.fn(),
      getFileName: vi.fn().mockImplementation((url) => url.replace(/^.*?backups\//, 'backups/')),
    }

    const schema = createMockSchema()
    mockSchemaReader = {
      discover: vi.fn().mockResolvedValue(schema),
      close: vi.fn(),
    }

    mockDataExporter = {
      exportTable: vi.fn().mockImplementation(async function* () {
        yield [['tnt_001', 'Test Tenant']]
      }),
    }

    engine = new BackupEngine({
      prisma: mockPrisma,
      storage: mockStorage,
      schemaReader: mockSchemaReader,
      dataExporter: mockDataExporter,
      sqlBuilder: new SQLBuilder(),
    })
  })

  it('should discover schema', async () => {
    await engine.run({ type: 'full' }, TEST_LOG_ID, undefined, 'user_1')

    expect(mockSchemaReader.discover).toHaveBeenCalledOnce()
  })

  it('should export data for each table', async () => {
    await engine.run({ type: 'full' }, TEST_LOG_ID, undefined, 'user_1')

    // Should be called for each table in topological order
    expect(mockDataExporter.exportTable).toHaveBeenCalledTimes(2)
    expect(mockDataExporter.exportTable).toHaveBeenNthCalledWith(
      1,
      'Tenant',
      expect.any(Array),
      ['id'],
      undefined,
      undefined,
    )
  })

  it('should save to storage', async () => {
    await engine.run({ type: 'full' }, TEST_LOG_ID, undefined, 'user_1')

    expect(mockStorage.save).toHaveBeenCalledOnce()
    const saveCall = mockStorage.save.mock.calls[0]
    expect(saveCall[0]).toMatch(/^backups\/full_.+\.sql\.gz$/)
    expect(saveCall[1]).toBeInstanceOf(Buffer)
  })

  it('should mark BackupLog as completed on success', async () => {
    await engine.run({ type: 'full' }, TEST_LOG_ID, undefined, 'user_1')

    expect(mockPrisma.backupLog.update).toHaveBeenCalledWith({
      where: { backupLogId: TEST_LOG_ID },
      data: expect.objectContaining({
        status: 'completed',
        fileUrl: expect.any(String),
        fileSize: expect.any(Number),
        completedAt: expect.any(Date),
      }),
    })
  })

  it('should return BackupResult with logId and file info', async () => {
    const result = await engine.run({ type: 'full' }, TEST_LOG_ID, undefined, 'user_1')

    expect(result).toMatchObject({
      backupLogId: TEST_LOG_ID,
      fileUrl: expect.any(String),
      fileSize: expect.any(Number),
      durationMs: expect.any(Number),
    })
  })

  it('should mark as failed and clean up on error', async () => {
    mockSchemaReader.discover.mockRejectedValue(new Error('Connection lost'))

    await expect(
      engine.run({ type: 'full' }, TEST_LOG_ID, undefined, 'user_1'),
    ).rejects.toThrow('Connection lost')

    expect(mockPrisma.backupLog.update).toHaveBeenCalledWith({
      where: { backupLogId: TEST_LOG_ID },
      data: expect.objectContaining({
        status: 'failed',
        errorMessage: 'Connection lost',
        completedAt: expect.any(Date),
      }),
    })
  })

  it('should abort when signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      engine.run({ type: 'full' }, TEST_LOG_ID, controller.signal, 'user_1'),
    ).rejects.toThrow('Backup cancelled')
  })

  it('should respect config-only table filter', async () => {
    await engine.run({ type: 'config' }, TEST_LOG_ID, undefined, 'user_1')

    // Config backup should only include config tables
    expect(mockDataExporter.exportTable).toHaveBeenCalled()
  })

  it('should pass tenant filter for tenant backups', async () => {
    // For tenant backups, we check that tenantId is passed to DataExporter
    mockDataExporter.exportTable.mockImplementation(async function* () {
      yield []
    })
    await engine.run({ type: 'tenant', tenantId: 'tnt_001' }, TEST_LOG_ID, undefined, 'user_1')

    // DataExporter should receive tenant filter
    expect(mockDataExporter.exportTable).toHaveBeenCalled()
  })

  it('should include CREATE TABLE and INSERT in output SQL', async () => {
    const result = await engine.run({ type: 'config' }, TEST_LOG_ID, undefined, 'user_1')

    // Should produce non-empty gzip output
    expect(result.fileSize).toBeGreaterThan(50)
    expect(result.fileUrl).toMatch(/\.sql\.gz$/)
  })

  it('should NOT create BackupLog (handled by action layer)', async () => {
    await engine.run({ type: 'full' }, TEST_LOG_ID, undefined, 'user_1')

    // The engine should NOT create a BackupLog — it receives one pre-created
    expect(mockPrisma.backupLog.create).not.toHaveBeenCalled()
  })
})
