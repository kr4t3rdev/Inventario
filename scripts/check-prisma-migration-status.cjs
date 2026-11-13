const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const appRoot = path.resolve(__dirname, '..');

const historicalMigrations = [
  { name: '20260722130000_make_tenant_id_required_tipo_pago', checksum: '07b3d7eeeed2315a057e4259f6ff329355c8fb01314beee0d2c8363422bb03b3' },
  { name: '20260926000000_hardening_catalog_on_delete', checksum: '059d416cdea5b07892fc854281e95573a68264d39b06f31628a6b5c61a33f4bd' },
];

function selectHistoricalMigrations(rows) {
  return historicalMigrations.filter((migration) => {
    const matching = rows.filter((row) => row.migration_name === migration.name && !row.rolled_back_at);
    if (matching.length > 1 || matching.some((row) => !row.finished_at)) {
      throw new Error(`Incomplete or duplicate historical migration ${migration.name}`);
    }
    if (matching.some((row) => row.checksum !== migration.checksum)) {
      throw new Error(`Unexpected checksum for historical migration ${migration.name}`);
    }
    return matching.length > 0;
  });
}

async function main() {
  const hasPrismaConfig = fs.existsSync(path.join(appRoot, 'prisma.config.ts'));
  const connectionString = (hasPrismaConfig && process.env.DIRECT_URL) || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Database URL is required');
  const client = new Client({ connectionString });
  let selected;
  try {
    await client.connect();
    const result = await client.query(
      'SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = ANY($1::text[])',
      [historicalMigrations.map((migration) => migration.name)],
    );
    selected = selectHistoricalMigrations(result.rows);
  } finally {
    await client.end();
  }

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tcp-prisma-status-'));
  try {
    const prisma = path.join(temp, 'prisma');
    fs.mkdirSync(prisma);
    fs.copyFileSync(path.join(appRoot, 'prisma/schema.prisma'), path.join(prisma, 'schema.prisma'));
    fs.cpSync(path.join(appRoot, 'prisma/migrations'), path.join(prisma, 'migrations'), { recursive: true });
    for (const migration of selected) {
      const sql = fs.readFileSync(path.join(appRoot, 'scripts/prisma-history', `${migration.name}.sql`));
      if (createHash('sha256').update(sql).digest('hex') !== migration.checksum) {
        throw new Error(`Historical migration asset checksum mismatch: ${migration.name}`);
      }
      const target = path.join(prisma, 'migrations', migration.name);
      fs.mkdirSync(target);
      fs.writeFileSync(path.join(target, 'migration.sql'), sql);
    }
    const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'status', '--schema', path.join(prisma, 'schema.prisma')], { cwd: appRoot, stdio: 'inherit' });
    if (result.error) throw result.error;
    return result.status ?? 1;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

module.exports = { historicalMigrations, selectHistoricalMigrations };

if (require.main === module) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error('[start] Migration status check failed:', error.message);
    process.exitCode = 1;
  });
}
