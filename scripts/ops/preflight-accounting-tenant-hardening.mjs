import { pathToFileURL } from 'node:url';

const TARGETS = Object.freeze({
  CierreContable: ['tenantId'],
  PagoCuentaPorPagar: ['tenantId'],
  Servicios: ['tenantId', 'vendorId'],
  CompraServicio: ['tenantId', 'proveedorId'],
  GastoCompra: ['tenantId'],
});

const CATEGORIES = Object.freeze(['ready', 'missing', 'ambiguous', 'invalid']);

export function buildCatalogQuery() {
  const values = Object.entries(TARGETS)
    .flatMap(([table, columns]) => columns.map((column) => `('${table}', '${column}')`))
    .join(', ');
  return `SELECT wanted.table_name, wanted.column_name,
      (column_info.column_name IS NOT NULL) AS present
    FROM (VALUES ${values}) AS wanted(table_name, column_name)
    LEFT JOIN information_schema.columns AS column_info
      ON column_info.table_schema = current_schema()
      AND column_info.table_name = wanted.table_name
      AND column_info.column_name = wanted.column_name
    ORDER BY wanted.table_name, wanted.column_name`;
}

function servicesOwnersSql(columns) {
  const owners = [
    `SELECT venta_servicio."servicioId", venta_servicio."tenantId", FALSE AS is_existing
      FROM "VentaServicios" AS venta_servicio`,
  ];
  if (columns.Servicios?.vendorId) {
    owners.push(`SELECT servicio."servicioId", vendor."tenantId", FALSE AS is_existing
      FROM "Servicios" AS servicio
      LEFT JOIN "Vendor" AS vendor ON vendor."vendorId" = servicio."vendorId"
      WHERE servicio."vendorId" IS NOT NULL`);
  }
  if (columns.Servicios?.tenantId) {
    owners.push(`SELECT servicio."servicioId", servicio."tenantId", TRUE AS is_existing
      FROM "Servicios" AS servicio
      WHERE servicio."tenantId" IS NOT NULL`);
  }
  return `owners AS (${owners.join('\n      UNION ALL\n      ')})`;
}

function serviceClassification(columns) {
  const owners = servicesOwnersSql(columns);
  const hasTenant = columns.Servicios?.tenantId;
  const noOwner = hasTenant
    ? `WHEN summary.owner_count = 0 THEN 'missing'`
    : `WHEN summary.lineage_count = 0 THEN 'missing'`;
  return `${owners},
    owner_rows AS (
      SELECT owners.*, tenant."tenantId" AS valid_tenant
      FROM owners
      LEFT JOIN "tenants" AS tenant ON tenant."tenantId" = owners."tenantId"
    ),
    owner_summary AS (
      SELECT "servicioId",
        count(*) FILTER (WHERE NOT is_existing) AS lineage_rows,
        count(DISTINCT "tenantId") FILTER (WHERE NOT is_existing) AS lineage_count,
        min("tenantId") FILTER (WHERE NOT is_existing) AS lineage_tenant,
        count(*) AS owner_count,
        bool_or("tenantId" IS NULL OR valid_tenant IS NULL) AS invalid_owner,
        max("tenantId") FILTER (WHERE is_existing) AS existing_tenant,
        bool_or(is_existing AND valid_tenant IS NULL) AS invalid_existing
      FROM owner_rows
      GROUP BY "servicioId"
    ),
    service_classified AS (
      SELECT servicio."servicioId",
        CASE
          WHEN summary.invalid_owner OR coalesce(summary.invalid_existing, FALSE) THEN 'invalid'
          WHEN summary.lineage_count > 1 THEN 'ambiguous'
          ${noOwner}
          ${hasTenant ? `WHEN summary.existing_tenant IS NOT NULL
            AND summary.lineage_count > 0
            AND summary.existing_tenant <> summary.lineage_tenant THEN 'invalid'` : ''}
          WHEN summary.owner_count IS NULL THEN 'missing'
          ELSE 'ready'
        END AS category
      FROM "Servicios" AS servicio
      LEFT JOIN owner_summary AS summary
        ON summary."servicioId" = servicio."servicioId"
    )`;
}

function categoryQuery(classifiedCte, classifiedTable) {
  return `WITH ${classifiedCte}
    SELECT category, count(*)::bigint AS count
    FROM ${classifiedTable}
    GROUP BY category
    ORDER BY category`;
}

function buildCierreQuery(columns) {
  if (!columns.CierreContable?.tenantId) {
    return categoryQuery(`classified AS (
      SELECT 'missing'::text AS category FROM "CierreContable"
    )`, 'classified');
  }
  return categoryQuery(`classified AS (
    SELECT CASE
      WHEN cierre."tenantId" IS NULL THEN 'missing'
      WHEN tenant."tenantId" IS NULL THEN 'invalid'
      ELSE 'ready'
    END AS category
    FROM "CierreContable" AS cierre
    LEFT JOIN "tenants" AS tenant ON tenant."tenantId" = cierre."tenantId"
  )`, 'classified');
}

function buildPagoQuery(columns) {
  const tenantConflict = columns.PagoCuentaPorPagar?.tenantId
    ? `WHEN pago."tenantId" IS NOT NULL AND pago."tenantId" <> cuenta."tenantId"
        THEN 'invalid'`
    : '';
  return categoryQuery(`classified AS (
    SELECT CASE
      WHEN cuenta."cuentaPorPagarId" IS NULL OR tenant."tenantId" IS NULL THEN 'invalid'
      ${tenantConflict}
      ${columns.PagoCuentaPorPagar?.tenantId ? `WHEN pago."tenantId" IS NULL THEN 'ready'` : ''}
      ELSE 'ready'
    END AS category
    FROM "PagoCuentaPorPagar" AS pago
    LEFT JOIN "CuentaPorPagar" AS cuenta
      ON cuenta."cuentaPorPagarId" = pago."cuentaPorPagarId"
    LEFT JOIN "tenants" AS tenant ON tenant."tenantId" = cuenta."tenantId"
  )`, 'classified');
}

function buildServiciosQuery(columns) {
  const classified = serviceClassification(columns);
  return categoryQuery(classified, 'service_classified');
}

function buildCompraServicioQuery(columns) {
  const classified = serviceClassification(columns);
  const vendorJoin = columns.CompraServicio?.proveedorId
    ? `LEFT JOIN "Vendor" AS vendor ON vendor."vendorId" = compra."proveedorId"`
    : '';
  const vendorBad = columns.CompraServicio?.proveedorId
    ? `OR (compra."proveedorId" IS NOT NULL AND
          (vendor."vendorId" IS NULL OR vendor."tenantId" IS DISTINCT FROM resolved.tenant_id))`
    : '';
  const query = `${classified},
    resolved_services AS (
      SELECT "servicioId", min("tenantId") AS tenant_id
      FROM owners
      GROUP BY "servicioId"
      HAVING count(DISTINCT "tenantId") = 1
    ),
    classified AS (
      SELECT CASE
        WHEN servicio."servicioId" IS NULL THEN 'invalid'
        WHEN servicio_class.category = 'ambiguous' THEN 'ambiguous'
        WHEN servicio_class.category = 'invalid' THEN 'invalid'
        WHEN servicio_class.category = 'missing' THEN 'missing'
        WHEN resolved.tenant_id IS NULL THEN 'missing'
        WHEN tenant."tenantId" IS NULL ${vendorBad} THEN 'invalid'
      ${columns.CompraServicio?.tenantId
        ? `WHEN compra."tenantId" IS NOT NULL
          AND compra."tenantId" <> resolved.tenant_id THEN 'invalid'`
        : ''}
        ELSE 'ready'
      END AS category
      FROM "CompraServicio" AS compra
      LEFT JOIN "Servicios" AS servicio
        ON servicio."servicioId" = compra."servicioId"
      LEFT JOIN service_classified AS servicio_class
        ON servicio_class."servicioId" = servicio."servicioId"
      LEFT JOIN resolved_services AS resolved
        ON resolved."servicioId" = compra."servicioId"
      LEFT JOIN "tenants" AS tenant ON tenant."tenantId" = resolved.tenant_id
      ${vendorJoin}
    )`;
  return categoryQuery(query, 'classified');
}

function buildGastoQuery(columns) {
  const tenantConflict = columns.GastoCompra?.tenantId
    ? `WHEN gasto."tenantId" IS NOT NULL AND gasto."tenantId" <> producto."tenantId"
        THEN 'invalid'`
    : '';
  return categoryQuery(`classified AS (
    SELECT CASE
      WHEN producto."id" IS NULL OR vendor."vendorId" IS NULL THEN 'invalid'
      WHEN producto."tenantId" IS NULL OR vendor."tenantId" IS NULL THEN 'invalid'
      WHEN producto."tenantId" <> vendor."tenantId" THEN 'ambiguous'
      WHEN tenant."tenantId" IS NULL THEN 'invalid'
      ${tenantConflict}
      ELSE 'ready'
    END AS category
    FROM "GastoCompra" AS gasto
    LEFT JOIN "Producto" AS producto ON producto."id" = gasto."productoId"
    LEFT JOIN "Vendor" AS vendor ON vendor."vendorId" = gasto."vendorId"
    LEFT JOIN "tenants" AS tenant ON tenant."tenantId" = producto."tenantId"
  )`, 'classified');
}

const queryBuilders = Object.freeze({
  CierreContable: buildCierreQuery,
  PagoCuentaPorPagar: buildPagoQuery,
  Servicios: buildServiciosQuery,
  CompraServicio: buildCompraServicioQuery,
  GastoCompra: buildGastoQuery,
});

export function classifyCounts(rows) {
  const counts = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  for (const row of rows) {
    if (!CATEGORIES.includes(row.category)) throw new Error('Unexpected preflight category');
    const count = Number(row.count);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid preflight count');
    counts[row.category] += count;
  }
  return {
    ...counts,
    scanned: CATEGORIES.reduce((total, category) => total + counts[category], 0),
    blockers: counts.missing + counts.ambiguous + counts.invalid,
  };
}

export function classifyOwnershipFacts(table, facts) {
  switch (table) {
    case 'CierreContable':
      if (!facts.tenantColumnPresent || !facts.existingTenant) return 'missing';
      return facts.existingTenantValid ? 'ready' : 'invalid';
    case 'PagoCuentaPorPagar':
      if (!facts.parentExists || !facts.parentTenantValid) return 'invalid';
      return facts.existingTenant && facts.existingTenant !== facts.parentTenant
        ? 'invalid'
        : 'ready';
    case 'Servicios': {
      if (facts.invalidSource || facts.invalidExistingTenant) return 'invalid';
      const owners = [...new Set(facts.lineageTenants ?? [])];
      if (owners.length > 1) return 'ambiguous';
      if (owners.length === 0 && !facts.existingTenant) return 'missing';
      if (facts.existingTenant && owners.length > 0 && facts.existingTenant !== owners[0]) {
        return 'invalid';
      }
      return 'ready';
    }
    case 'CompraServicio':
      if (!facts.serviceExists) return 'invalid';
      if (facts.serviceCategory !== 'ready') {
        if (['missing', 'ambiguous', 'invalid'].includes(facts.serviceCategory)) {
          return facts.serviceCategory;
        }
        throw new Error('Invalid service ownership category');
      }
      if (facts.vendorSpecified && (!facts.vendorExists || facts.vendorTenant !== facts.serviceTenant)) {
        return 'invalid';
      }
      return facts.existingTenant && facts.existingTenant !== facts.serviceTenant
        ? 'invalid'
        : 'ready';
    case 'GastoCompra':
      if (!facts.productExists || !facts.vendorExists || !facts.tenantsValid) return 'invalid';
      if (facts.productTenant !== facts.vendorTenant) return 'ambiguous';
      return facts.existingTenant && facts.existingTenant !== facts.productTenant
        ? 'invalid'
        : 'ready';
    default:
      throw new Error('Unsupported accounting tenant model');
  }
}

export function buildPreflightQueries(columns) {
  return Object.fromEntries(
    Object.entries(queryBuilders).map(([table, buildQuery]) => [table, buildQuery(columns)]),
  );
}

export function buildServiceRelationIssuesQuery() {
  return `SELECT count(*)::bigint AS count
    FROM "VentaServicios" AS venta_servicio
    LEFT JOIN "Servicios" AS servicio
      ON servicio."servicioId" = venta_servicio."servicioId"
    LEFT JOIN "tenants" AS tenant
      ON tenant."tenantId" = venta_servicio."tenantId"
    WHERE servicio."servicioId" IS NULL OR tenant."tenantId" IS NULL`;
}

export async function runReadOnlyPreflight(client) {
  let inTransaction = false;
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    inTransaction = true;
    const catalog = await client.query(buildCatalogQuery());
    const columns = Object.fromEntries(Object.keys(TARGETS).map((table) => [table, {}]));
    for (const item of catalog.rows) {
      if (!columns[item.table_name]) {
        continue;
      }
      if (!TARGETS[item.table_name].includes(item.column_name)) continue;
      columns[item.table_name][item.column_name] = item.present === true;
    }
    const results = {};
    for (const [table, buildQuery] of Object.entries(queryBuilders)) {
      const queryResult = await client.query(buildQuery(columns));
      results[table] = classifyCounts(queryResult.rows);
    }
    const relationIssuesResult = await client.query(buildServiceRelationIssuesQuery());
    const relationIssues = Number(relationIssuesResult.rows[0]?.count ?? 0);
    if (!Number.isSafeInteger(relationIssues) || relationIssues < 0) {
      throw new Error('Invalid preflight relationship count');
    }
    await client.query('ROLLBACK');
    inTransaction = false;
    const blockers = Object.values(results).reduce((sum, counts) => sum + counts.blockers, 0)
      + relationIssues;
    const schemaRemediation = Object.entries(columns).flatMap(([table, tableColumns]) =>
      tableColumns.tenantId === false ? [`${table}.tenantId absent`] : [],
    );
    return {
      decision: blockers === 0 ? 'GO' : 'NO-GO',
      blockers,
      relationIssues,
      schemaRemediation,
      results,
    };
  } catch (error) {
    if (inTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original query error; transaction rollback was attempted.
      }
    }
    throw error;
  }
}

export function validateTarget(databaseUrl, approvalTarget) {
  const url = new URL(databaseUrl);
  const dbName = decodeURIComponent(url.pathname.slice(1));
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (localHost && dbName.startsWith('tcp_test_')) {
    return { host: url.hostname, database: dbName };
  }
  const target = `${url.hostname}/${dbName}`;
  if (approvalTarget !== target) {
    throw new Error('Refusing non-test database; explicit exact target approval is required');
  }
  return { host: url.hostname, database: dbName };
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const approvalIndex = args.indexOf('--allow-nonlocal-target');
  const approvalTarget = approvalIndex >= 0 ? args[approvalIndex + 1] : undefined;
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Set DATABASE_URL explicitly before running preflight');
  const target = validateTarget(databaseUrl, approvalTarget);
  const { Client } = await import('pg');
  const client = new Client({ connectionString: databaseUrl, application_name: 'accounting-tenant-preflight' });
  await client.connect();
  try {
    const report = await runReadOnlyPreflight(client);
    console.log(JSON.stringify({ target, ...report }, null, 2));
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
      console.error('Accounting tenant preflight failed; no database values were reported.');
    process.exitCode = 1;
  });
}
