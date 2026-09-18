/**
 * @description Auditoría del inventario modelo↔clasificación (AS-01 T1).
 * Lee el DMMF real de Prisma y lo cruza con MODEL_CLASSIFICATION para
 * verificar cobertura total y resolver las dudas de design §1.
 * Uso: pnpm exec tsx scripts/audit/model-classification.ts [--json]
 * @module scripts/audit/model-classification
 */
import { Prisma } from '../../src/generated/prisma';
import {
  MODEL_CLASSIFICATION,
  listModelsByScope,
} from '../../src/lib/db/model-classification';

const asJson = process.argv.includes('--json');
const models = Prisma.dmmf.datamodel.models;
const byName = new Map(models.map((m) => [m.name, m]));

const missing = models.map((m) => m.name).filter((m) => !(m in MODEL_CLASSIFICATION));
const stale = Object.keys(MODEL_CLASSIFICATION).filter((m) => !byName.has(m));
const scopedWithoutColumn = listModelsByScope('scoped').filter(
  (m) => !byName.get(m)?.fields.some((f) => f.name === 'tenantId'),
);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        total: models.length,
        scoped: listModelsByScope('scoped').length,
        global: listModelsByScope('global').length,
        child: listModelsByScope('child').length,
        pending: listModelsByScope('pending-scope').length,
        missing,
        stale,
        scopedWithoutColumn,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`Total modelos DMMF: ${models.length}`);
  for (const scope of ['scoped', 'global', 'child', 'pending-scope'] as const) {
    const list = listModelsByScope(scope);
    console.log(`\n## ${scope} (${list.length})`);
    for (const m of list) {
      const entry = MODEL_CLASSIFICATION[m];
      const extra =
        entry.scope === 'child' ? ` [padre: ${entry.parentModel}.${entry.parentField}]` : '';
      console.log(`- ${m}${extra}: ${entry.reason}`);
    }
  }
  console.log('\n## Verificación');
  console.log(`Sin clasificar: ${missing.length === 0 ? 'ninguno' : missing.join(', ')}`);
  console.log(`Obsoletos: ${stale.length === 0 ? 'ninguno' : stale.join(', ')}`);
  console.log(
    `Scoped sin columna tenantId: ${scopedWithoutColumn.length === 0 ? 'ninguno' : scopedWithoutColumn.join(', ')}`,
  );
}

if (missing.length > 0 || stale.length > 0 || scopedWithoutColumn.length > 0) process.exit(1);
