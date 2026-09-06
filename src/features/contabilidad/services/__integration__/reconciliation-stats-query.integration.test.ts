import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { describe, expect, it } from 'vitest';

import { buildPendingSalesCountQuery } from '../reconciliation-stats-query';

const CREATE_TEMP_TABLES = [
  `
    CREATE TEMP TABLE "Venta" (
      "ventaId" text PRIMARY KEY,
      "tenantId" text NOT NULL,
      "total" integer,
      "deletedAt" timestamptz
    ) ON COMMIT DROP;
  `,
  `
    CREATE TEMP TABLE "ReconciliacionVenta" (
      "ventaId" text,
      "tenantId" text NOT NULL,
      "monto" numeric,
      "moneda" text,
      "tasaCambio" numeric,
      "montoConvertido" numeric
    ) ON COMMIT DROP;
  `,
  `
    CREATE TEMP TABLE "facturas" (
      "idFactura" text PRIMARY KEY,
      "tenantId" text NOT NULL,
      "ventaId" text
    ) ON COMMIT DROP;
  `,
  `
    CREATE TEMP TABLE "CuentaPorCobrar" (
      "facturaId" text,
      "tenantId" text NOT NULL,
      "estado" "EstadoCuentaPorCobrar" NOT NULL
    ) ON COMMIT DROP;
  `,
] as const;

interface SaleFixture {
  ventaId: string;
  tenantId: string;
  total: number;
}

interface ReceivableFixture {
  facturaId: string;
  tenantId: string;
  estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA';
}

interface ReconciliationFixture {
  ventaId: string;
  tenantId: string;
  monto: number;
  moneda: string;
  tasaCambio: number | null;
  montoConvertido: number | null;
}

/**
 * @description Creates the temporary relations required by the production query.
 * @param {Prisma.TransactionClient} transaction - Interactive transaction sharing the query connection.
 * @returns {Promise<void>} Resolves after all temporary tables exist.
 */
async function createTemporaryTables(transaction: Prisma.TransactionClient): Promise<void> {
  for (const statement of CREATE_TEMP_TABLES) {
    await transaction.$executeRawUnsafe(statement);
  }
}

/**
 * @description Inserts one sale fixture using a parameterized SQL statement.
 * @param {Prisma.TransactionClient} transaction - Interactive transaction for the fixture.
 * @param {SaleFixture} sale - Sale row to insert.
 * @returns {Promise<void>} Resolves after the sale is inserted.
 */
async function insertSale(
  transaction: Prisma.TransactionClient,
  sale: SaleFixture,
): Promise<void> {
  await transaction.$executeRaw(
    Prisma.sql`
      INSERT INTO "Venta" ("ventaId", "tenantId", "total", "deletedAt")
      VALUES (${sale.ventaId}, ${sale.tenantId}, ${sale.total}, ${null})
    `,
  );
}

/**
 * @description Inserts one receivable fixture using a parameterized SQL statement.
 * @param {Prisma.TransactionClient} transaction - Interactive transaction for the fixture.
 * @param {ReceivableFixture} receivable - Receivable row to insert.
 * @returns {Promise<void>} Resolves after the receivable is inserted.
 */
async function insertReceivable(
  transaction: Prisma.TransactionClient,
  receivable: ReceivableFixture,
): Promise<void> {
  await transaction.$executeRaw(
    Prisma.sql`
      INSERT INTO "CuentaPorCobrar" ("facturaId", "tenantId", "estado")
      VALUES (
        ${receivable.facturaId},
        ${receivable.tenantId},
        ${receivable.estado}::"EstadoCuentaPorCobrar"
      )
    `,
  );
}

/**
 * @description Inserts one canonical invoice fixture using parameterized SQL.
 * @param {Prisma.TransactionClient} transaction - Interactive transaction for the fixture.
 * @param {string} idFactura - Canonical invoice identifier.
 * @param {string} tenantId - Invoice tenant identifier.
 * @param {string} ventaId - Sale identifier linked by the invoice.
 * @returns {Promise<void>} Resolves after the invoice is inserted.
 */
async function insertInvoice(
  transaction: Prisma.TransactionClient,
  idFactura: string,
  tenantId: string,
  ventaId: string,
): Promise<void> {
  await transaction.$executeRaw(
    Prisma.sql`
      INSERT INTO "facturas" ("idFactura", "tenantId", "ventaId")
      VALUES (${idFactura}, ${tenantId}, ${ventaId})
    `,
  );
}

/**
 * @description Inserts one reconciliation fixture using a parameterized SQL statement.
 * @param {Prisma.TransactionClient} transaction - Interactive transaction for the fixture.
 * @param {ReconciliationFixture} reconciliation - Reconciliation row to insert.
 * @returns {Promise<void>} Resolves after the reconciliation is inserted.
 */
async function insertReconciliation(
  transaction: Prisma.TransactionClient,
  reconciliation: ReconciliationFixture,
): Promise<void> {
  await transaction.$executeRaw(
    Prisma.sql`
      INSERT INTO "ReconciliacionVenta" (
        "ventaId",
        "tenantId",
        "monto",
        "moneda",
        "tasaCambio",
        "montoConvertido"
      )
      VALUES (
        ${reconciliation.ventaId},
        ${reconciliation.tenantId},
        ${reconciliation.monto},
        ${reconciliation.moneda},
        ${reconciliation.tasaCambio},
        ${reconciliation.montoConvertido}
      )
    `,
  );
}

describe('buildPendingSalesCountQuery against relational fixtures', () => {
  it('counts only pending sales for the requested tenant after real CxC and reconciliation joins', async () => {
    const requestedTenantId = 'tenant-requested';
    const foreignTenantId = 'tenant-foreign';

    await prisma.$transaction(async (transaction) => {
      await createTemporaryTables(transaction);

      await Promise.all([
        insertSale(transaction, {
          ventaId: 'sale-canonical',
          tenantId: requestedTenantId,
          total: 100,
        }),
        insertSale(transaction, {
          ventaId: 'sale-legacy',
          tenantId: requestedTenantId,
          total: 100,
        }),
        insertSale(transaction, {
          ventaId: 'sale-foreign-cxc',
          tenantId: requestedTenantId,
          total: 100,
        }),
        insertSale(transaction, {
          ventaId: 'sale-completed-cxc',
          tenantId: requestedTenantId,
          total: 100,
        }),
        insertSale(transaction, {
          ventaId: 'sale-reconciled',
          tenantId: requestedTenantId,
          total: 100,
        }),
        insertSale(transaction, {
          ventaId: 'sale-foreign-reconciliation',
          tenantId: requestedTenantId,
          total: 100,
        }),
        insertSale(transaction, {
          ventaId: 'sale-other-tenant',
          tenantId: foreignTenantId,
          total: 100,
        }),
      ]);

      await insertInvoice(
        transaction,
        'invoice-canonical',
        requestedTenantId,
        'sale-canonical',
      );

      await Promise.all([
        insertReceivable(transaction, {
          facturaId: 'invoice-canonical',
          tenantId: requestedTenantId,
          estado: 'PENDIENTE',
        }),
        insertReceivable(transaction, {
          facturaId: 'sale-legacy',
          tenantId: requestedTenantId,
          estado: 'PARCIAL',
        }),
        insertReceivable(transaction, {
          facturaId: 'sale-foreign-cxc',
          tenantId: foreignTenantId,
          estado: 'PENDIENTE',
        }),
        insertReceivable(transaction, {
          facturaId: 'sale-completed-cxc',
          tenantId: requestedTenantId,
          estado: 'PAGADA',
        }),
      ]);

      await Promise.all([
        insertReconciliation(transaction, {
          ventaId: 'sale-reconciled',
          tenantId: requestedTenantId,
          monto: 100,
          moneda: 'CUP',
          tasaCambio: null,
          montoConvertido: 100,
        }),
        insertReconciliation(transaction, {
          ventaId: 'sale-foreign-reconciliation',
          tenantId: foreignTenantId,
          monto: 100,
          moneda: 'CUP',
          tasaCambio: null,
          montoConvertido: 100,
        }),
      ]);

      const [result] = await transaction.$queryRaw<Array<{ count: number }>>(
        buildPendingSalesCountQuery(requestedTenantId),
      );

      expect(result).toEqual({ count: 3 });
    });
  });
});
