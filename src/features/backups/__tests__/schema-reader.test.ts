/**
 * @description Unit tests for SchemaReader — topological sort and schema introspection.
 * TDD: RED → GREEN → REFACTOR.
 */
import { describe, it, expect } from 'vitest'
import { topologicalSort } from '../schema-reader'

describe('SchemaReader', () => {
  describe('topologicalSort', () => {
    it('should return tables in same order when there are no FK dependencies', () => {
      const tables = ['users', 'products', 'categories']
      const result = topologicalSort(tables, [])
      expect(result).toHaveLength(3)
      expect(result).toEqual(expect.arrayContaining(tables))
    })

    it('should sort with parents before children (simple chain)', () => {
      // orders has FK to users => edge [users, orders]
      // order_items has FK to orders => edge [orders, order_items]
      const tables = ['orders', 'users', 'order_items']
      const result = topologicalSort(tables, [
        ['users', 'orders'],
        ['orders', 'order_items'],
      ])
      expect(result.indexOf('users')).toBeLessThan(result.indexOf('orders'))
      expect(result.indexOf('orders')).toBeLessThan(result.indexOf('order_items'))
    })

    it('should handle diamond dependency (two parents, one child)', () => {
      // child has FK to parent_a AND parent_b
      const tables = ['child', 'parent_a', 'parent_b']
      const result = topologicalSort(tables, [
        ['parent_a', 'child'],
        ['parent_b', 'child'],
      ])
      expect(result.indexOf('parent_a')).toBeLessThan(result.indexOf('child'))
      expect(result.indexOf('parent_b')).toBeLessThan(result.indexOf('child'))
    })

    it('should handle deep dependency chain (5 levels)', () => {
      const tables = ['level5', 'level3', 'level1', 'level4', 'level2']
      const result = topologicalSort(tables, [
        ['level1', 'level2'],
        ['level2', 'level3'],
        ['level3', 'level4'],
        ['level4', 'level5'],
      ])
      const idx = (t: string) => result.indexOf(t)
      expect(idx('level1')).toBeLessThan(idx('level2'))
      expect(idx('level2')).toBeLessThan(idx('level3'))
      expect(idx('level3')).toBeLessThan(idx('level4'))
      expect(idx('level4')).toBeLessThan(idx('level5'))
    })

    it('should place tables without FK dependencies first', () => {
      const tables = ['dep_child', 'independent', 'dep_parent']
      const result = topologicalSort(tables, [
        ['dep_parent', 'dep_child'],
      ])
      expect(result.indexOf('independent')).toBeLessThan(result.indexOf('dep_child'))
    })

    it('should throw on circular dependencies', () => {
      const tables = ['table_a', 'table_b']
      expect(() => topologicalSort(tables, [
        ['table_a', 'table_b'],
        ['table_b', 'table_a'],
      ])).toThrow(/cycle|circular/i)
    })

    it('should handle self-referential FK (tree structure)', () => {
      const tables = ['categories', 'products']
      const result = topologicalSort(tables, [
        ['categories', 'categories'], // self-ref, should be ignored
      ])
      expect(result).toHaveLength(2)
    })

    it('should handle multiple FKs to the same parent table', () => {
      const tables = ['users', 'transactions']
      // transactions has FKs from_id->users and to_id->users
      const result = topologicalSort(tables, [
        ['users', 'transactions'],
        ['users', 'transactions'],
      ])
      expect(result.indexOf('users')).toBeLessThan(result.indexOf('transactions'))
    })

    it('should handle single table with no FK', () => {
      const result = topologicalSort(['singleton'], [])
      expect(result).toEqual(['singleton'])
    })

    it('should preserve all tables (no data loss)', () => {
      const tables = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
      const result = topologicalSort(tables, [
        ['b', 'a'],
        ['c', 'a'],
        ['e', 'd'],
      ])
      expect(result).toHaveLength(tables.length)
      expect(result.sort()).toEqual(tables.sort())
    })
  })
})
