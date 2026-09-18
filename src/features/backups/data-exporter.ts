/**
 * @description DataExporter — exports table data using cursor-based pagination
 * (keyset pagination) and yields batches of rows via AsyncGenerator.
 *
 * Keyset pagination avoids the OFFSET performance cliff for large tables.
 * Each batch is fetched via `WHERE pk > last_seen ORDER BY pk LIMIT batchSize`.
 */
import { Pool } from 'pg'
import type { ColumnDef } from './types'

const BATCH_SIZE = 1000

/**
 * Base64-encode a PK value into a cursor string.
 */
export function buildCursor(value: number | string | null | undefined): string {
  if (value == null) throw new Error('Cannot build cursor from null/undefined')
  return Buffer.from(String(value)).toString('base64')
}

/**
 * Base64-decode a cursor string back to the original PK value.
 */
export function parseCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64').toString('utf-8')
}

const NUMERIC_TYPES = new Set([
  'int2', 'int4', 'int8', 'smallint', 'integer', 'bigint',
  'float4', 'float8', 'real', 'double precision', 'numeric', 'decimal',
])

export type TenantFilterMode =
  | 'tenant-column'
  | 'tenant-row'
  | 'user-membership'
  | 'plan-by-tenant'

export interface TenantTableFilter {
  tenantId: string
  mode: TenantFilterMode
}

/**
 * DataExporter class — streams table rows in batches using cursor pagination.
 */
export class DataExporter {
  private pool: Pool
  private batchSize: number

  constructor(pool: Pool, batchSize: number = BATCH_SIZE) {
    this.pool = pool
    this.batchSize = batchSize
  }

  /**
   * AsyncGenerator that yields batches of rows for a table.
   * Uses keyset (cursor) pagination: `WHERE pk > $1 ORDER BY pk LIMIT $2`.
   *
   * For tables without a PK, falls back to a single non-paginated query.
   */
  async *exportTable(
    tableName: string,
    columns: ColumnDef[],
    pkColumns: string[],
    signal?: AbortSignal,
    tenantFilter?: TenantTableFilter,
  ): AsyncGenerator<unknown[][]> {
    const pkCol = pkColumns[0]
    if (!pkCol) {
      const rows = await this.fetchAllRows(tableName, columns, tenantFilter)
      if (rows.length > 0) yield rows
      return
    }

    const pkType = columns.find((c) => c.name === pkCol)?.type ?? 'text'
    const isNumeric = NUMERIC_TYPES.has(pkType)
    const colNames = columns.map((c) => `"${c.name}"`).join(', ')

    let cursor: string | null = null

    while (true) {
      if (signal?.aborted) {
        throw new DOMException('Backup cancelled', 'AbortError')
      }

      const rows = await this.fetchBatch(
        tableName, colNames, pkCol, isNumeric, cursor, tenantFilter,
      )

      if (rows.length === 0) break

      yield rows

      // Update cursor from last row's PK value
      const lastRow = rows[rows.length - 1]
      const pkIndex = columns.findIndex((c) => c.name === pkCol)
      if (pkIndex >= 0 && lastRow[pkIndex] != null) {
        cursor = buildCursor(lastRow[pkIndex] as string | number)
      }

      if (rows.length < this.batchSize) break
    }
  }

  /**
   * Fetch a single batch using keyset pagination.
   */
  private async fetchBatch(
    tableName: string,
    colNames: string,
    pkCol: string,
    isNumeric: boolean,
    cursor: string | null,
    tenantFilter?: TenantTableFilter,
  ): Promise<unknown[][]> {
    const conditions: string[] = []
    const params: unknown[] = []

    if (cursor) {
      const decoded = parseCursor(cursor)
      // Use parameterized query — pg driver handles type coercion
      conditions.push(`"${pkCol}" > $1`)
      params.push(isNumeric ? Number(decoded) : decoded)
    }

    if (tenantFilter) {
      this.appendTenantFilter(conditions, params, tenantFilter)
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : ''

    const query = `SELECT ${colNames} FROM "${tableName}" ${whereClause} ORDER BY "${pkCol}" LIMIT ${this.batchSize}`

    const result = await this.pool.query(query, params)
    return result.rows.map((row) => {
      const colList = colNames.split(',').map((c) => c.replace(/"/g, '').trim())
      return colList.map((col) => row[col])
    })
  }

  /**
   * Fetch all rows from a table without pagination (for PK-less tables).
   */
  private async fetchAllRows(
    tableName: string,
    columns: ColumnDef[],
    tenantFilter?: TenantTableFilter,
  ): Promise<unknown[][]> {
    const colNames = columns.map((c) => `"${c.name}"`).join(', ')

    const conditions: string[] = []
    const params: unknown[] = []

    if (tenantFilter) {
      this.appendTenantFilter(conditions, params, tenantFilter)
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : ''

    const query = `SELECT ${colNames} FROM "${tableName}" ${whereClause}`
    const result = await this.pool.query(query, params)
    return result.rows.map((row) =>
      columns.map((col) => row[col.name]),
    )
  }

  private appendTenantFilter(
    conditions: string[],
    params: unknown[],
    tenantFilter: TenantTableFilter,
  ): void {
    const paramIdx = params.length + 1

    switch (tenantFilter.mode) {
      case 'tenant-column':
        conditions.push(`"tenantId" = $${paramIdx}`)
        params.push(tenantFilter.tenantId)
        return
      case 'tenant-row':
        conditions.push(`"tenantId" = $${paramIdx}`)
        params.push(tenantFilter.tenantId)
        return
      case 'user-membership':
        conditions.push(
          `"userId" IN (SELECT "userId" FROM "tenant_memberships" WHERE "tenantId" = $${paramIdx})`,
        )
        params.push(tenantFilter.tenantId)
        return
      case 'plan-by-tenant':
        conditions.push(
          `"planId" IN (SELECT "planId" FROM "tenant_licenses" WHERE "tenantId" = $${paramIdx} AND "planId" IS NOT NULL)`,
        )
        params.push(tenantFilter.tenantId)
        return
    }
  }
}
