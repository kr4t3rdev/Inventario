/**
 * @description Actualiza los precios de lista y por referido de los tres planes.
 *
 * Uso:
 *   DATABASE_URL=... pnpm tsx scripts/ops/update-plan-prices.ts
 */

import pg from 'pg';

const { Pool } = pg;

const PRICES_BY_PLAN_NAME: Record<string, { price: number; referralDiscount: number }> = {
  Básico: { price: 30, referralDiscount: 5 },
  Profesional: { price: 60, referralDiscount: 10 },
  Empresarial: { price: 90, referralDiscount: 15 },
};

/**
 * @description Devuelve el nuevo precio base por nombre de plan.
 * @returns {Record<string, number>} Precios canónicos.
 */
export function getCanonicalPlanPrices(): Record<string, { price: number; referralDiscount: number }> {
  return PRICES_BY_PLAN_NAME;
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
      const prices = PRICES_BY_PLAN_NAME[plan.nombre];

      if (!prices) {
        console.warn(`⚠️ Plan omitido sin precio canónico: ${plan.nombre}`);
        continue;
      }

      await pool.query(
        'UPDATE "Plan" SET precio = $1::numeric, "referralDiscountUsd" = $2::numeric WHERE "planId" = $3',
        [prices.price, prices.referralDiscount, plan.planId],
      );

      console.log(`✓ ${plan.nombre}: $${plan.precio} → $${prices.price} (referido: $${prices.price - prices.referralDiscount}).`);
    }

    console.log(
      '✅ Precios de lista y por referido actualizados en los planes.',
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
