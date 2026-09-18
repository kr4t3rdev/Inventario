/**
 * @description Alinea `Plan.features` en producción con la definición
 * canónica de `prisma/seed/plans-seed.ts` usando SQL directo vía `pg`.
 *
 * Uso:
 *   DATABASE_URL=... pnpm tsx scripts/ops/sync-plan-features-production.ts
 */

import pg from 'pg';

import {
  PLAN_BASICO_FEATURES,
  PLAN_EMPRESARIAL_FEATURES,
  PLAN_PROFESIONAL_FEATURES,
} from '../../prisma/seed/plans-seed';

const { Pool } = pg;

const FEATURES_BY_PLAN_NAME: Record<string, Record<string, boolean>> = {
  'Básico': PLAN_BASICO_FEATURES,
  Profesional: PLAN_PROFESIONAL_FEATURES,
  Empresarial: PLAN_EMPRESARIAL_FEATURES,
};

/**
 * @description Devuelve los presets canónicos por nombre de plan.
 * @returns {Record<string, Record<string, boolean>>} Features canónicos.
 */
export function getCanonicalPlanFeatures(): Record<string, Record<string, boolean>> {
  return FEATURES_BY_PLAN_NAME;
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
    }>('SELECT "planId", nombre FROM "Plan" ORDER BY precio ASC');

    for (const plan of rows) {
      const canonicalFeatures = FEATURES_BY_PLAN_NAME[plan.nombre];

      if (!canonicalFeatures) {
        console.warn(`⚠️ Plan omitido sin preset canónico: ${plan.nombre}`);
        continue;
      }

      await pool.query('UPDATE "Plan" SET features = $1::jsonb WHERE "planId" = $2', [
        JSON.stringify(canonicalFeatures),
        plan.planId,
      ]);

      console.log(`✓ ${plan.nombre}: Plan.features alineado.`);
    }

    console.log('✅ Producción alineada: solo Plan.features actualizado.');
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error alineando Plan.features en producción:', error);
    process.exit(1);
  });
}
