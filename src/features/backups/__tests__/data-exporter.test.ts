/**
 * @description Unit tests for DataExporter — cursor pagination and batch streaming.
 * TDD: RED → GREEN → REFACTOR.
 * DB-dependent methods tested in Phase 8 integration tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCursor, DataExporter, parseCursor } from '../data-exporter'
import type { ColumnDef } from '../types'

describe('DataExporter', () => {
  const columns: ColumnDef[] = [
    { name: 'userId', type: 'text', nullable: false, defaultValue: null, isPrimaryKey: true },
    { name: 'name', type: 'text', nullable: true, defaultValue: null, isPrimaryKey: false },
  ]

  describe('buildCursor / parseCursor', () => {
    it('should encode a cursor from a PK value', () => {
      const cursor = buildCursor(42)
      expect(cursor).toBe('NDI=') // base64 of "42"
    })

    it('should encode string PK values', () => {
      const cursor = buildCursor('abc-123')
      expect(cursor).toBe('YWJjLTEyMw==') // base64 of "abc-123"
    })

    it('should round-trip encode/decode numeric cursor', () => {
      const cursor = buildCursor(999)
      const decoded = parseCursor(cursor)
      expect(decoded).toBe('999')
    })

    it('should round-trip encode/decode string cursor', () => {
      const cursor = buildCursor('user_abc_def')
      const decoded = parseCursor(cursor)
      expect(decoded).toBe('user_abc_def')
    })

    it('should handle nullish values', () => {
      expect(() => buildCursor(null)).toThrow()
      expect(() => buildCursor(undefined)).toThrow()
    })

    it('should handle complex PK like cuid', () => {
      const cuid = 'clxyz123456789abcdef'
      const cursor = buildCursor(cuid)
      const decoded = parseCursor(cursor)
      expect(decoded).toBe(cuid)
    })
  })

  describe('tenant filters', () => {
    let pool: { query: ReturnType<typeof vi.fn> }
    let exporter: DataExporter

    beforeEach(() => {
      pool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ userId: 'u1', name: 'User 1' }],
        }),
      }
      exporter = new DataExporter(pool as never, 100)
    })

    it('uses tenant membership subquery when exporting User rows for a tenant', async () => {
      const batches: unknown[][][] = []

      for await (const batch of exporter.exportTable(
        'User',
        columns,
        ['userId'],
        undefined,
        { tenantId: 'tenant-1', mode: 'user-membership' },
      )) {
        batches.push(batch)
      }

      expect(batches).toHaveLength(1)
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          '"userId" IN (SELECT "userId" FROM "tenant_memberships" WHERE "tenantId" = $1)',
        ),
        ['tenant-1'],
      )
    })

    it('uses tenant license subquery when exporting Plan rows for a tenant', async () => {
      await exporter['fetchAllRows']('Plan', columns, {
        tenantId: 'tenant-1',
        mode: 'plan-by-tenant',
      })

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          '"planId" IN (SELECT "planId" FROM "tenant_licenses" WHERE "tenantId" = $1 AND "planId" IS NOT NULL)',
        ),
        ['tenant-1'],
      )
    })
  })
})
