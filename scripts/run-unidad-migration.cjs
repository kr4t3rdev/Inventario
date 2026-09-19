/**
 * @description Script de migración para Railway pre-deploy.
 * Ejecuta el SQL de unidad-tenant-scoping usando pg (node-postgres) directo.
 *
 * No depende de Prisma CLI ni de prisma.config.ts.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🔧 Ejecutando migración: unidad-tenant-scoping...');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('  ✅ Conectado a la base de datos');

    const sqlPath = path.join(__dirname, '..', 'prisma', 'migrations', 'unidad-tenant-scoping.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // pg nativo ejecuta multi-statement sin problemas
    await client.query(sql);
    console.log('✅ Migración completada exitosamente.');
  } catch (err) {
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
