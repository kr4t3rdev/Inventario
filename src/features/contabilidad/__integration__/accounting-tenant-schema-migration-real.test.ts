import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { prisma } from '@/lib/prisma';

type TenantColumnState = {
  tableName: string;
  columnName: string | null;
  dataType: string | null;
  isNullable: string | null;
};

type TenantConstraintState = {
  tableName: string;
  constraintName: string;
  referencedTable: string;
};

const EXPECTED_TENANT_COLUMNS = [
  'CierreContable',
  'Servicios',
  'PagoCuentaPorPagar',
  'CompraServicio',
  'GastoCompra',
] as const;

const EXPECTED_TENANT_FOREIGN_KEYS = [
  'CierreContable_tenantId_fkey',
  'Servicios_tenantId_fkey',
  'PagoCuentaPorPagar_tenantId_fkey',
  'CompraServicio_tenantId_fkey',
  'GastoCompra_tenantId_fkey',
] as const;

const migrationPath = fileURLToPath(
  new URL('../../../../prisma/migrations/20261012100000_accounting_tenant_id_hardening/migration.sql', import.meta.url),
);

type FixtureOptions = {
  closureTenantColumn?: boolean;
  paymentTenantColumn?: boolean;
  populateClosure?: boolean;
  nullClosure?: boolean;
  servicesTenantColumn?: boolean;
  servicesTenantValue?: string | null;
  servicesVendorColumn?: boolean;
  servicesVendorId?: string | null;
  salesOwnerTenants?: string[];
  purchaseVendorId?: string | null;
  conflict?: 'payment' | 'purchase-vendor' | 'expense-owners';
};

const FAILURE_CASES: Array<[string, FixtureOptions]> = [
  ['payment ownership mismatch', { closureTenantColumn: true, paymentTenantColumn: true, conflict: 'payment' }],
  ['service vendor and sale ownership disagreement', { servicesVendorId: 'vendor-a', salesOwnerTenants: ['tenant-b'] }],
  ['service without any ownership source', { servicesVendorId: null, salesOwnerTenants: [] }],
  ['linked sales with conflicting owners', { servicesVendorColumn: false, salesOwnerTenants: ['tenant-a', 'tenant-b'] }],
  ['existing service tenant conflicts with linked owners', { servicesTenantColumn: true, servicesTenantValue: 'tenant-b' }],
  ['purchase vendor tenant mismatch', { purchaseVendorId: 'vendor-b' }],
  ['expense ownership disagreement', { closureTenantColumn: true, conflict: 'expense-owners' }],
  ['unmapped closure NULL', { closureTenantColumn: true, nullClosure: true }],
];

async function assertExpectedTestDatabase(): Promise<void> {
  const expectedDatabase = process.env.TCP_ACCOUNTING_TENANT_MIGRATION_DB;
  expect(expectedDatabase, 'set the explicitly assigned disposable DB name').toBeTruthy();

  const identity = await prisma.$queryRaw<Array<{
    databaseName: string;
    userName: string;
    serverAddress: string;
    serverPort: number;
  }>>`
    SELECT
      current_database() AS "databaseName",
      current_user AS "userName",
      inet_server_addr()::text AS "serverAddress",
      inet_server_port() AS "serverPort"
  `;

  expect(identity).toEqual([
    {
      databaseName: expectedDatabase,
      userName: 'arturo',
      serverAddress: '127.0.0.1/32',
      serverPort: 5433,
    },
  ]);
}

async function createLegacyFixture(client: Client, options: FixtureOptions): Promise<void> {
  await client.query('CREATE TABLE "tenants" ("tenantId" TEXT PRIMARY KEY)');
  await client.query('CREATE TABLE "CuentaPorPagar" ("cuentaPorPagarId" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL)');
  await client.query('CREATE TABLE "Vendor" ("vendorId" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL)');
  await client.query('CREATE TABLE "Producto" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL)');

  const servicesColumns = ['"servicioId" TEXT PRIMARY KEY'];
  if (options.servicesTenantColumn) servicesColumns.push('"tenantId" TEXT');
  if (options.servicesVendorColumn !== false) servicesColumns.push('"vendorId" TEXT');
  await client.query(`CREATE TABLE "Servicios" (${servicesColumns.join(', ')})`);
  await client.query(
    'CREATE TABLE "VentaServicios" ("ventaServicioId" TEXT PRIMARY KEY, "servicioId" TEXT NOT NULL, "tenantId" TEXT NOT NULL)',
  );

  await client.query(`
    CREATE TABLE "CierreContable" (
      "cierreId" TEXT PRIMARY KEY
      ${options.closureTenantColumn ? ', "tenantId" TEXT' : ''}
    )
  `);
  await client.query(`
    CREATE TABLE "PagoCuentaPorPagar" (
      "pagoCuentaPorPagarId" TEXT PRIMARY KEY,
      "cuentaPorPagarId" TEXT NOT NULL
      ${options.paymentTenantColumn ? ', "tenantId" TEXT' : ''}
    )
  `);
  await client.query(`
    CREATE TABLE "CompraServicio" (
      "compraServicioId" TEXT PRIMARY KEY,
      "servicioId" TEXT NOT NULL,
      "proveedorId" TEXT
    )
  `);
  await client.query(`
    CREATE TABLE "GastoCompra" (
      "gastoCompraId" TEXT PRIMARY KEY,
      "productoId" TEXT NOT NULL,
      "vendorId" TEXT NOT NULL,
      "tenantId" TEXT
    )
  `);

  await client.query(`
    INSERT INTO "tenants" ("tenantId") VALUES ('tenant-a'), ('tenant-b');
    INSERT INTO "CuentaPorPagar" VALUES ('account-a', 'tenant-a'), ('account-b', 'tenant-b');
    INSERT INTO "Vendor" VALUES ('vendor-a', 'tenant-a'), ('vendor-b', 'tenant-b');
    INSERT INTO "Producto" VALUES ('product-a', 'tenant-a');
  `);

  const serviceColumns = ['"servicioId"'];
  const serviceValues: Array<string | null> = ['service-a'];
  if (options.servicesTenantColumn) {
    serviceColumns.push('"tenantId"');
    serviceValues.push(options.servicesTenantValue === undefined ? 'tenant-a' : options.servicesTenantValue);
  }
  if (options.servicesVendorColumn !== false) {
    serviceColumns.push('"vendorId"');
    serviceValues.push(options.servicesVendorId === undefined ? 'vendor-a' : options.servicesVendorId);
  }
  const servicePlaceholders = serviceValues.map((_, index) => `$${index + 1}`).join(', ');
  await client.query(
    `INSERT INTO "Servicios" (${serviceColumns.join(', ')}) VALUES (${servicePlaceholders})`,
    serviceValues,
  );

  const salesOwnerTenants = options.salesOwnerTenants ?? ['tenant-a'];
  for (const [index, tenantId] of salesOwnerTenants.entries()) {
    await client.query(
      'INSERT INTO "VentaServicios" ("ventaServicioId", "servicioId", "tenantId") VALUES ($1, $2, $3)',
      [`sale-service-${index + 1}`, 'service-a', tenantId],
    );
  }

  if (options.populateClosure) {
    if (options.closureTenantColumn) {
      await client.query(`
        INSERT INTO "CierreContable" ("cierreId", "tenantId")
        VALUES ('closure-a', 'tenant-a')
      `);
    } else {
      await client.query(`INSERT INTO "CierreContable" ("cierreId") VALUES ('closure-a')`);
    }
  } else if (options.nullClosure) {
    await client.query(`
      INSERT INTO "CierreContable" ("cierreId", "tenantId")
      VALUES ('closure-null', NULL)
    `);
  }

  await client.query(
    `INSERT INTO "PagoCuentaPorPagar" ("pagoCuentaPorPagarId", "cuentaPorPagarId"${options.paymentTenantColumn ? ', "tenantId"' : ''})
     VALUES ('payment-a', 'account-a'${options.paymentTenantColumn ? ", 'tenant-b'" : ''})`,
  );
  await client.query(
    'INSERT INTO "CompraServicio" VALUES ($1, $2, $3)',
    [
      'service-purchase-a',
      'service-a',
      options.purchaseVendorId === undefined
        ? options.conflict === 'purchase-vendor'
          ? 'vendor-b'
          : 'vendor-a'
        : options.purchaseVendorId,
    ],
  );
  await client.query(`
    INSERT INTO "GastoCompra" ("gastoCompraId", "productoId", "vendorId", "tenantId")
    VALUES ('expense-a', 'product-a', '${options.conflict === 'expense-owners' ? 'vendor-b' : 'vendor-a'}', NULL),
      ('expense-preserved', 'product-a', 'vendor-a', 'tenant-a')
  `);
}

async function withMigrationFixture<T>(
  options: FixtureOptions,
  run: (client: Client, migrationSql: string) => Promise<T>,
): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  expect(connectionString, 'an explicit disposable DATABASE_URL is required').toBeTruthy();
  const client = new Client({ connectionString });
  const schema = `accounting_tenant_migration_${randomUUID().replaceAll('-', '')}`;
  await client.connect();

  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await createLegacyFixture(client, options);
    const migrationSql = await readFile(migrationPath, 'utf8');
    return await run(client, migrationSql);
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
}

describe('accounting tenant schema migration', () => {
  beforeAll(async () => {
    await assertExpectedTestDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('requires tenantId and a Tenant foreign key on each accounting model', async () => {
    const columns = await prisma.$queryRaw<TenantColumnState[]>`
      SELECT
        expected.table_name AS "tableName",
        column_info.column_name AS "columnName",
        column_info.data_type AS "dataType",
        column_info.is_nullable AS "isNullable"
      FROM unnest(${[...EXPECTED_TENANT_COLUMNS]}::text[]) AS expected(table_name)
      LEFT JOIN information_schema.columns AS column_info
        ON column_info.table_schema = current_schema()
        AND column_info.table_name = expected.table_name
        AND column_info.column_name = 'tenantId'
      ORDER BY expected.table_name
    `;

    expect(columns).toHaveLength(EXPECTED_TENANT_COLUMNS.length);
    for (const column of columns) {
      expect(column.columnName, `${column.tableName}.tenantId must exist`).toBe('tenantId');
      expect(column.dataType, `${column.tableName}.tenantId must be TEXT`).toBe('text');
      expect(column.isNullable, `${column.tableName}.tenantId must be required`).toBe('NO');
    }

    const constraints = await prisma.$queryRaw<TenantConstraintState[]>`
      SELECT
        relation.relname AS "tableName",
        constraint_row.conname AS "constraintName",
        referenced_relation.relname AS "referencedTable"
      FROM pg_constraint AS constraint_row
      JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
      JOIN pg_class AS referenced_relation ON referenced_relation.oid = constraint_row.confrelid
      WHERE constraint_row.contype = 'f'
        AND relation.relnamespace = current_schema()::regnamespace
        AND constraint_row.conname = ANY(${[...EXPECTED_TENANT_FOREIGN_KEYS]}::text[])
      ORDER BY relation.relname
    `;

    expect(constraints).toHaveLength(EXPECTED_TENANT_FOREIGN_KEYS.length);
    for (const constraint of constraints) {
      expect(constraint.referencedTable, `${constraint.constraintName} must target tenants`).toBe(
        'tenants',
      );
    }
  });

  it('backfills unanimous service and accounting ownership, preserving explicit closure ownership', async () => {
    await withMigrationFixture(
      { closureTenantColumn: true, populateClosure: true },
      async (client, migrationSql) => {
        await client.query(migrationSql);

        const rows = await client.query(`
          SELECT 'payment' AS kind, "tenantId" FROM "PagoCuentaPorPagar"
          UNION ALL
          SELECT 'service', "tenantId" FROM "Servicios"
          UNION ALL
          SELECT "compraServicioId", "tenantId" FROM "CompraServicio"
          UNION ALL
          SELECT "gastoCompraId", "tenantId" FROM "GastoCompra"
          UNION ALL
          SELECT "cierreId", "tenantId" FROM "CierreContable"
          ORDER BY kind
        `);

        expect(rows.rows).toEqual([
          { kind: 'closure-a', tenantId: 'tenant-a' },
          { kind: 'expense-a', tenantId: 'tenant-a' },
          { kind: 'expense-preserved', tenantId: 'tenant-a' },
          { kind: 'payment', tenantId: 'tenant-a' },
          { kind: 'service', tenantId: 'tenant-a' },
          { kind: 'service-purchase-a', tenantId: 'tenant-a' },
        ]);

        const requiredColumns = await client.query(`
          SELECT table_name, is_nullable
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = ANY(ARRAY['CierreContable', 'Servicios', 'PagoCuentaPorPagar', 'CompraServicio', 'GastoCompra'])
            AND column_name = 'tenantId'
          ORDER BY table_name
        `);
        expect(requiredColumns.rows).toEqual([
          { table_name: 'CierreContable', is_nullable: 'NO' },
          { table_name: 'CompraServicio', is_nullable: 'NO' },
          { table_name: 'GastoCompra', is_nullable: 'NO' },
          { table_name: 'PagoCuentaPorPagar', is_nullable: 'NO' },
          { table_name: 'Servicios', is_nullable: 'NO' },
        ]);
      },
    );
  });

  it('uses linked VentaServicios when the legacy Servicios.vendorId column is absent', async () => {
    await withMigrationFixture(
      { servicesVendorColumn: false, salesOwnerTenants: ['tenant-a'] },
      async (client, migrationSql) => {
        await client.query(migrationSql);

        const rows = await client.query(`
          SELECT servicio."tenantId" AS service_tenant, compra."tenantId" AS purchase_tenant
          FROM "Servicios" AS servicio
          JOIN "CompraServicio" AS compra
            ON compra."servicioId" = servicio."servicioId"
        `);
        expect(rows.rows).toEqual([
          { service_tenant: 'tenant-a', purchase_tenant: 'tenant-a' },
        ]);
      },
    );
  });

  it('preserves a valid explicit service tenant and permits a purchase without a vendor', async () => {
    await withMigrationFixture(
      {
        servicesTenantColumn: true,
        servicesTenantValue: 'tenant-a',
        purchaseVendorId: null,
      },
      async (client, migrationSql) => {
        await client.query(migrationSql);

        const rows = await client.query(`
          SELECT servicio."tenantId" AS service_tenant, compra."tenantId" AS purchase_tenant,
            compra."proveedorId" AS vendor_id
          FROM "Servicios" AS servicio
          JOIN "CompraServicio" AS compra
            ON compra."servicioId" = servicio."servicioId"
        `);
        expect(rows.rows).toEqual([
          { service_tenant: 'tenant-a', purchase_tenant: 'tenant-a', vendor_id: null },
        ]);
      },
    );
  });

  it('permits an empty CierreContable table without inventing a tenant', async () => {
    await withMigrationFixture({}, async (client, migrationSql) => {
      await client.query(migrationSql);

      const state = await client.query(`
        SELECT is_nullable
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'CierreContable'
          AND column_name = 'tenantId'
      `);
      expect(state.rows).toEqual([{ is_nullable: 'NO' }]);
      expect(await client.query('SELECT count(*)::integer FROM "CierreContable"')).toMatchObject({
        rows: [{ count: 0 }],
      });
    });
  });

  it('rejects unmapped populated CierreContable rows before changing the schema', async () => {
    await withMigrationFixture(
      { populateClosure: true },
      async (client, migrationSql) => {
        const failure = await client.query(migrationSql).then(
          () => null,
          (error: unknown) => error,
        );

        expect(String(failure)).toContain('explicitly reviewed tenant mapping');
        await client.query('ROLLBACK');

        const state = await client.query(`
          SELECT
            EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = current_schema()
                AND table_name = 'CierreContable'
                AND column_name = 'tenantId'
            ) AS has_tenant_column,
            (SELECT count(*)::integer FROM "CierreContable") AS closure_count
        `);
        expect(state.rows).toEqual([{ has_tenant_column: false, closure_count: 1 }]);
      },
    );
  });

  it.each(FAILURE_CASES)('rejects %s without persisting partial DDL', async (_caseName, options) => {
    await withMigrationFixture(options, async (client, migrationSql) => {
      const failure = await client.query(migrationSql).then(
        () => null,
        (error: unknown) => error,
      );

      expect(failure).toBeTruthy();
      await client.query('ROLLBACK');

      const state = await client.query(`
        SELECT
          (SELECT count(*)::integer FROM "PagoCuentaPorPagar") AS payment_count,
          (SELECT count(*)::integer FROM "Servicios") AS service_count,
          (SELECT count(*)::integer FROM "CompraServicio") AS service_purchase_count,
          (SELECT count(*)::integer FROM "GastoCompra") AS expense_count,
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'Servicios'
              AND column_name = 'tenantId'
          ) AS service_tenant_column_added,
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'PagoCuentaPorPagar'
              AND column_name = 'tenantId'
          ) AS payment_tenant_column_added
      `);
      expect(state.rows).toEqual([
        {
          payment_count: 1,
          service_count: 1,
          service_purchase_count: 1,
          expense_count: 2,
          service_tenant_column_added: options.servicesTenantColumn ?? false,
          payment_tenant_column_added: options.paymentTenantColumn ?? false,
        },
      ]);
    });
  });
});
