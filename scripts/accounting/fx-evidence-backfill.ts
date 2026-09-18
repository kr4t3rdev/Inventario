/**
 * Diagnóstico histórico de evidencia FX (solo lectura).
 *
 * Clasifica las reconciliaciones legacy frente al catálogo de tasas vigentes y reporta
 * conteos por disposición sin escribir nada. Ejecución:
 *
 *   tsx scripts/accounting/fx-evidence-backfill.ts --tenant=<tenantId> \
 *     [--functional=CUP] [--table=all] [--batch=500]
 *
 * Disposiciones: same_currency | already_complete | uniquely_provable | ambiguous |
 * missing_evidence | invalid_row
 */
import { PrismaClient } from '../../src/generated/prisma';
import {
  classifyBackfillRow,
  type BackfillDisposition,
  type BackfillRowInput,
  type CatalogCandidate,
} from '../../src/features/contabilidad/domain/fx-backfill';

interface CliArgs {
  tenant: string;
  functional: string;
  table: 'all' | 'venta' | 'servicio' | 'gasto';
  batch: number;
}

/**
 * @description Analiza los argumentos de línea de comandos del diagnóstico.
 * @param {string[]} argv - Argumentos crudos de proceso.
 * @returns {CliArgs} Configuración validada del diagnóstico.
 */
function parseArgs(argv: string[]): CliArgs {
  const get = (key: string): string | undefined => {
    const match = argv.find((arg) => arg.startsWith(`--${key}=`));
    return match?.split('=').slice(1).join('=');
  };
  const tenant = get('tenant');
  if (!tenant) {
    console.error('Uso: tsx scripts/accounting/fx-evidence-backfill.ts --tenant=<id> [--table=all]');
    process.exit(1);
  }
  const tableArg = get('table') ?? 'all';
  if (!['all', 'venta', 'servicio', 'gasto'].includes(tableArg)) {
    console.error(`Tabla no soportada: ${tableArg}`);
    process.exit(1);
  }
  return {
    tenant,
    functional: (get('functional') ?? 'CUP').toUpperCase(),
    table: tableArg as CliArgs['table'],
    batch: Number(get('batch') ?? 500),
  };
}

type RowLike = {
  reconciliacionId?: string;
  id?: string;
  monto: unknown;
  moneda: string;
  montoConvertido: unknown;
  tasaCambio: unknown;
  fechaReconciliacion: Date;
  rateEffectiveAt?: Date | null;
  fxEvidenceFingerprint?: string | null;
};

const EMPTY_COUNTS = (): Record<BackfillDisposition | 'scanned', number> => ({
  scanned: 0,
  same_currency: 0,
  already_complete: 0,
  uniquely_provable: 0,
  ambiguous: 0,
  missing_evidence: 0,
  invalid_row: 0,
});

/**
 * @description Recorre una tabla en lotes por cursor y clasifica cada fila.
 * @param {PrismaClient} prisma - Cliente Prisma de solo lectura.
 * @param {'venta'|'servicio'|'gasto'} table - Tabla a diagnosticar.
 * @param {CliArgs} args - Configuración del diagnóstico.
 * @param {Map<string, CatalogCandidate[]>} catalogByCurrency - Catálogo agrupado por moneda origen.
 * @returns {Promise<{counts: Record<string, number>, samples: Record<string, string[]>}>} Conteos y ejemplos.
 */
async function diagnoseTable(
  prisma: PrismaClient,
  table: 'venta' | 'servicio' | 'gasto',
  args: CliArgs,
  catalogByCurrency: Map<string, CatalogCandidate[]>,
) {
  const model: any = table === 'venta'
    ? prisma.reconciliacionVenta
    : table === 'servicio'
      ? prisma.reconciliacionServicio
      : prisma.reconciliacionGasto;

  const counts = EMPTY_COUNTS();
  const samples: Record<string, string[]> = {};
  let cursor: Date | undefined;

  for (;;) {
    const rows: RowLike[] = await model.findMany({
      where: { tenantId: args.tenant },
      orderBy: { fechaReconciliacion: 'asc' },
      take: args.batch,
      ...(cursor ? { skip: 1, cursor: { fechaReconciliacion: cursor } } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].fechaReconciliacion;

    for (const raw of rows) {
      const row: BackfillRowInput & { id: string } = {
        id: String((raw as any).reconciliacionId ?? raw.id ?? ''),
        monto: Number(raw.monto),
        moneda: String(raw.moneda || 'CUP'),
        montoConvertido: raw.montoConvertido == null ? null : Number(raw.montoConvertido),
        tasaCambio: raw.tasaCambio == null ? null : Number(raw.tasaCambio),
        fechaReconciliacion: raw.fechaReconciliacion,
        rateEffectiveAt: raw.rateEffectiveAt ?? null,
        fxEvidenceFingerprint: raw.fxEvidenceFingerprint ?? null,
      };
      const candidates = catalogByCurrency.get(row.moneda.toUpperCase()) ?? [];
      const result = classifyBackfillRow(row, candidates, args.functional);
      counts.scanned += 1;
      counts[result.disposition] += 1;
      if (
        (result.disposition === 'ambiguous' || result.disposition === 'missing_evidence')
        && (samples[result.disposition] ?? []).length < 10
      ) {
        samples[result.disposition] = [...(samples[result.disposition] ?? []), row.id];
      }
    }
  }

  return { counts, samples };
}

/**
 * @description Punto de entrada del diagnóstico dry-run.
 * @returns {Promise<void>} Imprime el resumen JSON y termina sin escribir datos.
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL es obligatorio para leer el catálogo y las reconciliaciones.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const rates = await prisma.tasaCambio.findMany({
      where: { monedaDestino: args.functional },
      select: { tasaId: true, monedaOrigenId: true, tasa: true, fechaVigencia: true },
    });
    const catalogByCurrency = new Map<string, CatalogCandidate[]>();
    for (const rate of rates) {
      const list = catalogByCurrency.get(rate.monedaOrigenId) ?? [];
      list.push({
        tasaId: rate.tasaId,
        tasa: Number(rate.tasa),
        fechaVigencia: rate.fechaVigencia,
      });
      catalogByCurrency.set(rate.monedaOrigenId, list);
    }

    const tables = args.table === 'all'
      ? (['venta', 'servicio', 'gasto'] as const)
      : [args.table];
    const report: Record<string, unknown> = {
      dryRun: true,
      tenant: args.tenant,
      functional: args.functional,
      catalogRates: rates.length,
    };

    for (const table of tables) {
      report[table] = await diagnoseTable(prisma, table, args, catalogByCurrency);
    }

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[fx-backfill] Error:', error);
  process.exit(1);
});
