/**
 * @description Unit tests para recordCostChange() function
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  recordCostChange,
  calculateCostChangePercent,
  calculatePriceChangePercent,
} from './cost-history-utils'

describe('recordCostChange()', () => {
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      producto: {
        findUnique: vi.fn(),
      },
      productoCostHistory: {
        create: vi.fn(),
      },
    }
  })

  // ===== VALIDATION TESTS (no DB needed) =====

  it('returns null when prices did not change', async () => {
    const result = await recordCostChange(mockPrisma, {
      productoId: 'prod-1',
      oldPrecioCosto: 100,
      newPrecioCosto: 100,
      oldPrecioVenta: 150,
      newPrecioVenta: 150,
      reason: 'MANUAL_EDIT',
      changedBy: 'user-1',
      notes: undefined,
    })

    expect(result).toBeNull()
    expect(mockPrisma.producto.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.productoCostHistory.create).not.toHaveBeenCalled()
  })

  it('rejects negative newPrecioCosto', async () => {
    await expect(
      recordCostChange(mockPrisma, {
        productoId: 'prod-1',
        oldPrecioCosto: 100,
        newPrecioCosto: -50,
        oldPrecioVenta: 150,
        newPrecioVenta: 180,
        reason: 'MANUAL_EDIT',
        changedBy: 'user-1',
        notes: undefined,
      })
    ).rejects.toThrow('Los precios deben ser números positivos')
  })

  it('rejects negative newPrecioVenta', async () => {
    await expect(
      recordCostChange(mockPrisma, {
        productoId: 'prod-1',
        oldPrecioCosto: 100,
        newPrecioCosto: 120,
        oldPrecioVenta: 150,
        newPrecioVenta: -50,
        reason: 'MANUAL_EDIT',
        changedBy: 'user-1',
        notes: undefined,
      })
    ).rejects.toThrow('Los precios deben ser números positivos')
  })

  it('rejects non-numeric newPrecioCosto', async () => {
    await expect(
      recordCostChange(mockPrisma, {
        productoId: 'prod-1',
        oldPrecioCosto: 100,
        newPrecioCosto: 'invalid' as any,
        oldPrecioVenta: 150,
        newPrecioVenta: 180,
        reason: 'MANUAL_EDIT',
        changedBy: 'user-1',
        notes: undefined,
      })
    ).rejects.toThrow('Los precios deben ser números positivos')
  })

  it('rejects non-numeric newPrecioVenta', async () => {
    await expect(
      recordCostChange(mockPrisma, {
        productoId: 'prod-1',
        oldPrecioCosto: 100,
        newPrecioCosto: 120,
        oldPrecioVenta: 150,
        newPrecioVenta: 'invalid' as any,
        reason: 'MANUAL_EDIT',
        changedBy: 'user-1',
        notes: undefined,
      })
    ).rejects.toThrow('Los precios deben ser números positivos')
  })

  // ===== DATABASE TESTS =====

  it('throws error when producto not found', async () => {
    mockPrisma.producto.findUnique.mockResolvedValueOnce(null)

    await expect(
      recordCostChange(mockPrisma, {
        productoId: 'nonexistent',
        oldPrecioCosto: 100,
        newPrecioCosto: 120,
        oldPrecioVenta: 150,
        newPrecioVenta: 180,
        reason: 'MANUAL_EDIT',
        changedBy: 'user-1',
        notes: undefined,
      })
    ).rejects.toThrow('Producto con ID nonexistent no encontrado')
  })

  it('creates a cost history record with correct data', async () => {
    mockPrisma.producto.findUnique.mockResolvedValueOnce({ id: 'prod-1' })
    mockPrisma.productoCostHistory.create.mockResolvedValueOnce({
      id: 'history-1',
      productoId: 'prod-1',
    })

    const result = await recordCostChange(mockPrisma, {
      productoId: 'prod-1',
      oldPrecioCosto: 100,
      newPrecioCosto: 120,
      oldPrecioVenta: 150,
      newPrecioVenta: 180,
      reason: 'MANUAL_EDIT',
      changedBy: 'user-1',
      notes: 'Price update',
    })

    expect(result).toEqual({ id: 'history-1', productoId: 'prod-1' })
    expect(mockPrisma.productoCostHistory.create).toHaveBeenCalledOnce()
    expect(mockPrisma.productoCostHistory.create).toHaveBeenCalledWith({
      data: {
        productoId: 'prod-1',
        oldPrecioCosto: 100,
        newPrecioCosto: 120,
        oldPrecioVenta: 150,
        newPrecioVenta: 180,
        reason: 'MANUAL_EDIT',
        changedBy: 'user-1',
        notes: 'Price update',
        changedAt: expect.any(Date),
      },
      select: {
        id: true,
        productoId: true,
      },
    })
  })

  it('creates record when only costo changed', async () => {
    mockPrisma.producto.findUnique.mockResolvedValueOnce({ id: 'prod-1' })
    mockPrisma.productoCostHistory.create.mockResolvedValueOnce({
      id: 'history-2',
      productoId: 'prod-1',
    })

    const result = await recordCostChange(mockPrisma, {
      productoId: 'prod-1',
      oldPrecioCosto: 100,
      newPrecioCosto: 120,
      oldPrecioVenta: 150,
      newPrecioVenta: 150,
      reason: 'RESTOCK',
      changedBy: 'user-1',
      notes: undefined,
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('history-2')
    expect(mockPrisma.productoCostHistory.create).toHaveBeenCalledOnce()
  })

  it('creates record when only precio changed', async () => {
    mockPrisma.producto.findUnique.mockResolvedValueOnce({ id: 'prod-1' })
    mockPrisma.productoCostHistory.create.mockResolvedValueOnce({
      id: 'history-3',
      productoId: 'prod-1',
    })

    const result = await recordCostChange(mockPrisma, {
      productoId: 'prod-1',
      oldPrecioCosto: 100,
      newPrecioCosto: 100,
      oldPrecioVenta: 150,
      newPrecioVenta: 180,
      reason: 'ADJUSTMENT',
      changedBy: 'user-1',
      notes: 'Price adjustment',
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('history-3')
  })

  it('allows null/undefined notes', async () => {
    mockPrisma.producto.findUnique.mockResolvedValueOnce({ id: 'prod-1' })
    mockPrisma.productoCostHistory.create.mockResolvedValueOnce({
      id: 'history-4',
      productoId: 'prod-1',
    })

    const result = await recordCostChange(mockPrisma, {
      productoId: 'prod-1',
      oldPrecioCosto: 0,
      newPrecioCosto: 100,
      oldPrecioVenta: 0,
      newPrecioVenta: 150,
      reason: 'INITIAL',
      changedBy: 'system',
      notes: undefined,
    })

    expect(result).not.toBeNull()
  })

  it('handles database errors', async () => {
    mockPrisma.producto.findUnique.mockResolvedValueOnce({ id: 'prod-1' })
    mockPrisma.productoCostHistory.create.mockRejectedValueOnce(
      new Error('Database connection lost')
    )

    await expect(
      recordCostChange(mockPrisma, {
        productoId: 'prod-1',
        oldPrecioCosto: 100,
        newPrecioCosto: 120,
        oldPrecioVenta: 150,
        newPrecioVenta: 180,
        reason: 'MANUAL_EDIT',
        changedBy: 'user-1',
        notes: undefined,
      })
    ).rejects.toThrow('Database connection lost')
  })
})

// ===== HELPER FUNCTION TESTS =====

describe('calculateCostChangePercent()', () => {
  it('calculates percentage change correctly', () => {
    expect(calculateCostChangePercent(100, 120)).toBe(20)
  })

  it('calculates negative percentage correctly', () => {
    expect(calculateCostChangePercent(100, 80)).toBe(-20)
  })

  it('returns 100 when old value is 0 and new is positive', () => {
    expect(calculateCostChangePercent(0, 100)).toBe(100)
  })

  it('returns 0 when old value is 0 and new is 0', () => {
    expect(calculateCostChangePercent(0, 0)).toBe(0)
  })
})

describe('calculatePriceChangePercent()', () => {
  it('calculates percentage change correctly', () => {
    expect(calculatePriceChangePercent(150, 180)).toBe(20)
  })

  it('calculates negative percentage correctly', () => {
    expect(calculatePriceChangePercent(150, 120)).toBe(-20)
  })

  it('returns 100 when old value is 0 and new is positive', () => {
    expect(calculatePriceChangePercent(0, 150)).toBe(100)
  })

  it('returns 0 when old value is 0 and new is 0', () => {
    expect(calculatePriceChangePercent(0, 0)).toBe(0)
  })
})
