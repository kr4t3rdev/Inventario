/**
 * @description Unit tests for DataExporter — cursor pagination and batch streaming.
 * TDD: RED → GREEN → REFACTOR.
 * DB-dependent methods tested in Phase 8 integration tests.
 */
import { describe, it, expect } from 'vitest'
import { buildCursor, parseCursor } from '../data-exporter'

describe('DataExporter', () => {
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
})
