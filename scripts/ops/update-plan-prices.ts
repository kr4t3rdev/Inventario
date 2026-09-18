/**
 * @description Actualiza el precio base de los planes Básico, Profesional y
 * Empresarial al nuevo precio de lista (40/80/110 USD). El descuento por
 * referido ($5 USD) se calcula en código, no se persiste en el plan.
 *
 * Uso:
 *   DATABASE_URL=... pnpm tsx scripts/ops/update-plan-prices.ts
 */

import pg from 'pg';

const { Pool } = pg;

const NEW_PRICE_BY_PLAN_NAME: Record<string, number> = {
  Básico: 40,
  Profesional: 80,
  Empresarial: 110,
};

/**
 * @description Devuelve el nuevo precio base por nombre de plan.
 * @returns {Record<string, number>} Precios canónicos.
 */
export function getCanonicalPlanPrices(): Record<string, number> {
  return NEW_PRICE_BY_PLAN_NAME;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL es requerido');
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const { rows } = await pool.query<{
      planId: string;
      nombre: string;
      precio: string;
    }>('SELECT "planId", nombre, precio FROM "Plan" ORDER BY precio ASC');

    for (const plan of rows) {
      const newPrice = NEW_PRICE_BY_PLAN_NAME[plan.nombre];

      if (!newPrice) {
        console.warn(`⚠️ Plan omitido sin precio canónico: ${plan.nombre}`);
        continue;
      }

      await pool.query('UPDATE "Plan" SET precio = $1::numeric WHERE "planId" = $2', [
        newPrice,
        plan.planId,
      ]);

      console.log(`✓ ${plan.nombre}: $${plan.precio} → $${newPrice}.`);
    }

    console.log(
      '✅ Precios base actualizados. Descuento por referido ($5 USD) se aplica en código.',
    );
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error actualizando precios de planes:', error);
    process.exit(1);
  });
}
