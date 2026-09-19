/**
 * @description Applies the guarded legacy Vercel tenant schema repair.
 * @returns {Promise<void>} Resolves after the transaction completes.
 */
async function main() {
  const { Client } = require('pg');
  const fs = require('node:fs');
  const path = require('node:path');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const sqlPath = path.join(
    __dirname,
    'repair-vercel-tenant-schema.sql',
  );

  try {
    await client.connect();
    await client.query(fs.readFileSync(sqlPath, 'utf8'));
    console.log('Legacy Vercel tenant schema repair completed successfully.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Legacy Vercel tenant schema repair failed:', error.message);
  process.exitCode = 1;
});
