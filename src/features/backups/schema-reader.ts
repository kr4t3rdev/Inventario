/**
 * @description SchemaReader — discovers database schema via PostgreSQL
 * information_schema and system catalogs. Uses a dedicated pg.Pool
 * (separate from Prisma) for raw SQL access.
 */
import { Pool } from 'pg'
import type { TableSchema, ColumnDef, FKDef } from './types'

export interface SchemaReaderResult {
  tables: TableSchema[]
  topologicalOrder: string[]
  tenantScopedTables: string[]
}

/**
 * Topological sort using Kahn's algorithm.
 *
 * @param tables — all table names to sort
 * @param edges — pairs of [parent, child] meaning parent must come before child
 *                (e.g., table A has FK to table B => edge [B, A])
 * @returns tables in dependency order (parents before children)
 * @throws Error if a circular dependency is detected
 */
export function topologicalSort(
  tables: string[],
  edges: Array<[parent: string, child: string]>,
): string[] {
  // inDegree[table] = how many tables must come before it
  const inDegree = new Map<string, number>()
  // adjacency[table] = tables that depend on it
  const adjacency = new Map<string, Set<string>>()

  // Initialize
  for (const table of tables) {
    inDegree.set(table, 0)
    adjacency.set(table, new Set())
  }

  // Build graph: parent -> child (parent must come first)
  const seen = new Set<string>()
  for (const [parent, child] of edges) {
    if (parent === child) continue // skip self-referential

    if (!inDegree.has(parent) || !inDegree.has(child)) continue

    const edgeKey = `${parent}|${child}`
    if (seen.has(edgeKey)) continue // deduplicate
    seen.add(edgeKey)

    // child depends on parent — increment child's in-degree
    adjacency.get(parent)!.add(child)
    inDegree.set(child, (inDegree.get(child) ?? 0) + 1)
  }

  // Kahn's algorithm
  const queue: string[] = []
  for (const [table, degree] of inDegree) {
    if (degree === 0) queue.push(table)
  }

  const result: string[] = []
  while (queue.length > 0) {
    const table = queue.shift()!
    result.push(table)

    for (const dependent of adjacency.get(table) ?? []) {
      const newDegree = (inDegree.get(dependent) ?? 1) - 1
      inDegree.set(dependent, newDegree)
      if (newDegree === 0) queue.push(dependent)
    }
  }

  if (result.length !== tables.length) {
    const remaining = tables.filter((t) => !result.includes(t))
    throw new Error(
      `Circular dependency detected among tables: ${remaining.join(', ')}`,
    )
  }

  return result
}

/**
 * SchemaReader class — connects to PostgreSQL via pg.Pool and introspects
 * schema to discover tables, columns, primary keys, indexes, and FK dependencies.
 */
export class SchemaReader {
  private pool: Pool

  constructor(pool?: Pool) {
    this.pool = pool ?? new Pool({ connectionString: process.env.DATABASE_URL })
  }

  /**
   * Full schema discovery: discovers all user tables, columns, FKs, indexes,
   * and returns them in topological order.
   */
  async discover(): Promise<SchemaReaderResult> {
    const tableNames = await this.discoverTableNames()
    const allFks = await this.discoverForeignKeys(tableNames)

    // Build edges: [parent, child] for topological sort
    // Table A has FK to Table B => child = A, parent = B => edge [B, A]
    const edges: Array<[string, string]> = []
    for (const fk of allFks) {
      edges.push([fk.refTable, fk.tableName])
    }

    const topologicalOrder = topologicalSort(tableNames, edges)

    const tables: TableSchema[] = []
    for (const name of topologicalOrder) {
      const columns = await this.discoverColumns(name)
      const primaryKey = await this.discoverPrimaryKey(name)
      const indexes = await this.discoverIndexes(name)
      const foreignKeys = allFks.filter((fk) => fk.tableName === name)

      tables.push({
        name,
        columns: columns.map((col) => ({
          ...col,
          isPrimaryKey: primaryKey.includes(col.name),
        })),
        primaryKey,
        indexes,
        foreignKeys,
      })
    }

    const tenantScopedTables = await this.discoverTenantScopedTables(tableNames)

    return { tables, topologicalOrder, tenantScopedTables }
  }

  /**
   * Discover all user tables in the public schema, excluding system and Prisma migration tables.
   */
  async discoverTableNames(): Promise<string[]> {
    const result = await this.pool.query(`
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT IN ('_prisma_migrations')
      ORDER BY tablename
    `)
    return result.rows.map((r) => r.tablename as string)
  }

  /**
   * Discover columns for a given table from information_schema.
   */
  async discoverColumns(tableName: string): Promise<Omit<ColumnDef, 'isPrimaryKey'>[]> {
    const result = await this.pool.query(
      `
      SELECT
        column_name AS name,
        COALESCE(data_type, 'text') AS type,
        is_nullable = 'YES' AS nullable,
        column_default AS "defaultValue"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
      `,
      [tableName],
    )
    return result.rows.map((r) => ({
      name: r.name as string,
      type: r.type as string,
      nullable: r.nullable as boolean,
      defaultValue: r.defaultValue as string | null,
    }))
  }

  /**
   * Discover primary key columns for a table.
   */
  async discoverPrimaryKey(tableName: string): Promise<string[]> {
    const result = await this.pool.query(
      `
      SELECT a.attname AS column_name
      FROM pg_class t
        JOIN pg_index i ON t.oid = i.indrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
      WHERE t.relname = $1
        AND t.relkind = 'r'
        AND i.indisprimary
      ORDER BY a.attnum
      `,
      [tableName],
    )
    return result.rows.map((r) => r.column_name as string)
  }

  /**
   * Discover foreign key constraints for all tables in the list.
   * Returns FKDef[] for topological sorting of tables during dump/restore.
   */
  async discoverForeignKeys(tableNames: string[]): Promise<FKDef[]> {
    if (tableNames.length === 0) return []

    const result = await this.pool.query(
      `
      SELECT
        tc.table_name AS "tableName",
        kcu.column_name AS "columnName",
        ccu.table_name AS "refTable",
        ccu.column_name AS "refColumn"
      FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = ANY($1)
      `,
      [tableNames],
    )
    return result.rows.map((r) => ({
      tableName: r.tableName as string,
      refTable: r.refTable as string,
      refColumn: r.refColumn as string,
    }))
  }

  /**
   * Discover index definitions for a table from pg_indexes.
   */
  async discoverIndexes(tableName: string): Promise<string[]> {
    const result = await this.pool.query(
      `
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = $1
      ORDER BY indexname
      `,
      [tableName],
    )
    return result.rows.map((r) => r.indexdef as string)
  }

  /**
   * Detect which tables have a tenantId column for per-tenant filtering.
   */
  async discoverTenantScopedTables(tableNames: string[]): Promise<string[]> {
    if (tableNames.length === 0) return []

    const result = await this.pool.query(
      `
      SELECT DISTINCT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
        AND column_name = 'tenantId'
      ORDER BY table_name
      `,
      [tableNames],
    )
    return result.rows.map((r) => r.table_name as string)
  }

  /**
   * Close the underlying pg.Pool.
   */
  async close(): Promise<void> {
    await this.pool.end()
  }
}
