import { canRunAccountingPolicyRollout } from '@/lib/auth/accounting-policy-capabilities';
import {
  preflightAccountingPoliciesForRollout,
  type AccountingPolicyPreflightClassification,
} from '@/features/contabilidad/services/accounting-policy-preflight-service';
import { provisionTenantAccountingPolicy } from
  '@/features/contabilidad/services/tenant-accounting-policy-service';
import { prismaPlatform as prisma } from '@/lib/db/platform-prisma';
import { ActionError } from '@/lib/server-actions';
import { verifyAccountingPolicyAuditRetention } from '@/lib/services/audit-log-service';
import {
  accountingPolicyPreflightCounter,
  accountingPolicyRolloutEntriesCounter,
} from '@/lib/metrics';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import {
  getAccountingPolicyManifestHash,
  parseAccountingPolicyManifest,
  type AccountingPolicyManifestV1,
} from './lib/accounting-policy-manifest';
import {
  assertAccountingPolicyRolloutGates,
  type AccountingPolicyRolloutGates,
} from './lib/accounting-policy-rollout-gates';

type ProjectedResult = 'CREATE' | 'NO_OP' | 'CONFLICT' | 'BLOCKED';

interface DryRunInput {
  manifest: unknown;
  executorUserId: string;
}

interface ApplyInput extends DryRunInput {
  dryRunId: string;
  correlationId: string;
  apply: boolean;
  productionGates?: AccountingPolicyRolloutGates;
}

interface DryRunEntry {
  tenantId: string;
  projectedResult: ProjectedResult;
}

interface ApplyEntry {
  tenantId: string;
  finalResult: string;
}

/**
 * @description Traduce la clasificación aprobada del manifiesto a evidencia canónica.
 * @param {AccountingPolicyPreflightClassification} classification - Estado esperado.
 * @returns {'NONE' | 'PRESENT'} Evidencia esperada por el orquestador.
 */
function toExpectedEvidence(
  classification: AccountingPolicyPreflightClassification,
): 'NONE' | 'PRESENT' {
  return classification === 'MISSING_WITH_EVIDENCE' ? 'PRESENT' : 'NONE';
}

/**
 * @description Proyecta un resultado sin ejecutar escrituras de política.
 * @param {AccountingPolicyManifestV1['entries'][number]} manifestEntry - Decisión aprobada.
 * @param {object} preflightEntry - Estado observado del tenant.
 * @param {boolean} hasValidTenantApproval - Aprobación tenant vigente y exacta.
 * @returns {ProjectedResult} Resultado proyectado de forma determinista.
 */
function projectEntry(
  manifestEntry: AccountingPolicyManifestV1['entries'][number],
  preflightEntry: {
    classification: AccountingPolicyPreflightClassification;
    existingCurrencyCode?: string;
  },
  hasValidTenantApproval: boolean,
): ProjectedResult {
  if (preflightEntry.classification === 'POLICY_PRESENT') {
    return preflightEntry.existingCurrencyCode === manifestEntry.functionalCurrencyCode
      ? 'NO_OP'
      : 'CONFLICT';
  }
  if (preflightEntry.classification !== manifestEntry.expectedClassification) return 'BLOCKED';
  if (
    preflightEntry.classification === 'MISSING_WITH_EVIDENCE'
    && !hasValidTenantApproval
  ) return 'BLOCKED';
  return 'CREATE';
}

/**
 * @description Persiste un dry-run vinculante y no modifica políticas contables.
 * @param {DryRunInput} input - Manifiesto y operador autenticable.
 * @returns {Promise<object>} Run, hash, proyecciones y resumen conciliado.
 */
export async function runAccountingPolicyDryRun(input: DryRunInput): Promise<{
  runId: string;
  manifestHash: string;
  entries: DryRunEntry[];
  summary: Record<ProjectedResult, number>;
}> {
  const manifest = parseAccountingPolicyManifest(input.manifest);
  const manifestHash = getAccountingPolicyManifestHash(manifest);
  const preflight = await preflightAccountingPoliciesForRollout(
    input.executorUserId,
    manifest.entries.map((entry) => entry.tenantId),
  );
  const approvalIds = manifest.entries.flatMap((entry) =>
    entry.tenantApprovalId ? [entry.tenantApprovalId] : []);
  const approvals = approvalIds.length > 0
    ? await prisma.accountingPolicyTenantApproval.findMany({
        where: {
          approvalId: { in: approvalIds },
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
        select: {
          approvalId: true,
          tenantId: true,
          functionalCurrencyCode: true,
        },
      })
    : [];
  const validApprovals = new Map(approvals.map((approval) => [approval.approvalId, approval]));
  // Conciliación previa a cualquier escritura operacional: cada tenant del
  // manifiesto debe aparecer exactamente una vez en el preflight.
  const observedCounts = new Map<string, number>();
  for (const entry of preflight.entries) {
    observedCounts.set(entry.tenantId, (observedCounts.get(entry.tenantId) ?? 0) + 1);
  }
  const missingInspection = manifest.entries.find(
    (entry) => (observedCounts.get(entry.tenantId) ?? 0) !== 1,
  );
  if (missingInspection) {
    throw new ActionError(
      'El preflight no inspeccionó cada tenant del manifiesto exactamente una vez',
      'PREFLIGHT_INCOMPLETE',
    );
  }
  const observedByTenant = new Map(
    preflight.entries.map((entry) => [entry.tenantId, entry]),
  );
  for (const entry of preflight.entries) {
    accountingPolicyPreflightCounter.inc({ classification: entry.classification });
  }
  const entries = manifest.entries.map((entry): DryRunEntry => ({
    tenantId: entry.tenantId,
    projectedResult: projectEntry(
      entry,
      observedByTenant.get(entry.tenantId) ?? { classification: 'REVIEW_REQUIRED' },
      Boolean(
        entry.tenantApprovalId
        && validApprovals.get(entry.tenantApprovalId)?.tenantId === entry.tenantId
        && validApprovals.get(entry.tenantApprovalId)?.functionalCurrencyCode
          === entry.functionalCurrencyCode,
      ),
    ),
  }));
  const run = await prisma.accountingPolicyRolloutRun.create({
    data: {
      mode: 'DRY_RUN',
      manifestHash,
      status: 'RUNNING',
      executorUserId: input.executorUserId,
      approverUserId: manifest.platformApproval.approverUserId,
      reason: manifest.reason,
    },
    select: { runId: true },
  });

  await prisma.accountingPolicyRolloutEntry.createMany({
    data: manifest.entries.map((entry) => {
      const observed = observedByTenant.get(entry.tenantId);
      const projected = entries.find((candidate) => candidate.tenantId === entry.tenantId);
      return {
        runId: run.runId,
        tenantId: entry.tenantId,
        functionalCurrencyCode: entry.functionalCurrencyCode,
        expectedClassification: entry.expectedClassification,
        observedClassification: observed?.classification ?? 'REVIEW_REQUIRED',
        projectedResult: projected?.projectedResult ?? 'BLOCKED',
        existingCurrencyCode: observed?.existingCurrencyCode ?? null,
        tenantApprovalId: entry.tenantApprovalId ?? null,
      };
    }),
  });
  const summary = entries.reduce<Record<ProjectedResult, number>>(
    (result, entry) => ({
      ...result,
      [entry.projectedResult]: result[entry.projectedResult] + 1,
    }),
    { CREATE: 0, NO_OP: 0, CONFLICT: 0, BLOCKED: 0 },
  );
  await prisma.accountingPolicyRolloutRun.update({
    where: { runId: run.runId },
    data: { status: 'COMPLETED', summary, completedAt: new Date() },
  });
  return { runId: run.runId, manifestHash, entries, summary };
}

/**
 * @description Aplica un manifiesto ligado a un dry-run exitoso, tenant por tenant.
 * @param {ApplyInput} input - Gates explícitos, identidades y correlación operacional.
 * @returns {Promise<object>} Run durable y resultados finales independientes.
 */
export async function applyAccountingPolicyRollout(input: ApplyInput): Promise<{
  runId: string;
  manifestHash: string;
  entries: ApplyEntry[];
}> {
  if (!input.apply) {
    throw new ActionError('El apply requiere confirmación explícita', 'APPLY_CONFIRMATION_REQUIRED');
  }
  const manifest = parseAccountingPolicyManifest(input.manifest);
  const approverUserId = manifest.platformApproval.approverUserId;
  if (approverUserId === input.executorUserId) {
    throw new ActionError(
      'El aprobador y el ejecutor deben ser identidades distintas',
      'SEPARATION_OF_DUTIES_REQUIRED',
    );
  }
  // Production writes are fail-closed until each independently verifiable
  // operational gate is supplied by the protected release session.
  assertAccountingPolicyRolloutGates(input.productionGates);
  if (!await verifyAccountingPolicyAuditRetention()) {
    throw new ActionError('El rollout no cumple los gates de retención', 'ROLLOUT_NOT_READY');
  }
  const [executorAllowed, approverAllowed] = await Promise.all([
    canRunAccountingPolicyRollout(input.executorUserId),
    canRunAccountingPolicyRollout(approverUserId),
  ]);
  if (!executorAllowed || !approverAllowed) {
    throw new ActionError('Las identidades del rollout no están autorizadas', 'FORBIDDEN');
  }

  const manifestHash = getAccountingPolicyManifestHash(manifest);
  const matchingDryRun = await prisma.accountingPolicyRolloutRun.findFirst({
    where: {
      runId: input.dryRunId,
      mode: 'DRY_RUN',
      status: 'COMPLETED',
      manifestHash,
    },
    select: { runId: true },
  });
  if (!matchingDryRun) {
    throw new ActionError('No existe un dry-run exitoso para este manifiesto', 'DRY_RUN_MISMATCH');
  }
  const persistedDryRunEntries = await prisma.accountingPolicyRolloutEntry.findMany({
    where: { runId: input.dryRunId },
    select: { tenantId: true, projectedResult: true },
  });
  const manifestTenantIds = new Set(manifest.entries.map((entry) => entry.tenantId));
  const persistedTenantIds = new Set(
    persistedDryRunEntries.map((projection) => projection.tenantId),
  );
  const hasExactDryRunEntries = persistedDryRunEntries.length === manifest.entries.length
    && persistedTenantIds.size === manifestTenantIds.size
    && [...manifestTenantIds].every((tenantId) => persistedTenantIds.has(tenantId));
  if (!hasExactDryRunEntries) {
    throw new ActionError(
      'Las entradas persistidas del dry-run no coinciden exactamente con el manifiesto',
      'DRY_RUN_ENTRIES_MISMATCH',
    );
  }
  const dryRunProjections = new Map(
    persistedDryRunEntries.map((projection) => [projection.tenantId, projection.projectedResult]),
  );
  const applyableProjections = new Set<ProjectedResult>(['CREATE', 'NO_OP', 'CONFLICT']);
  const blockingProjection = manifest.entries.find((entry) => {
    const projected = dryRunProjections.get(entry.tenantId);
    return projected === 'BLOCKED'
      || !applyableProjections.has(projected as ProjectedResult);
  });

  /**
   * @description Evalúa stop conditions contra la proyección vinculante.
   *              Detiene el lote ante conflicto no proyectado o alta donde se
   *              esperaba bloqueo (mutación no manifestada o aislamiento roto).
   * @param {string} tenantId - Tenant aplicado.
   * @param {string} finalResult - Resultado observado por el orquestador.
   * @returns {boolean} True cuando debe detenerse el apply.
   */
  const shouldStop = (tenantId: string, finalResult: string): boolean => {
    const projected = dryRunProjections.get(tenantId);
    if (!projected) return false;
    const expectedOutcome = {
      CREATE: new Set(['CREATED', 'NO_OP']),
      NO_OP: new Set(['NO_OP']),
      CONFLICT: new Set(['CONFLICT']),
      BLOCKED: new Set(['BLOCKED']),
    }[projected];
    return !expectedOutcome || !expectedOutcome.has(finalResult);
  };

  const run = await prisma.accountingPolicyRolloutRun.create({
    data: {
      mode: 'APPLY',
      manifestHash,
      status: 'RUNNING',
      executorUserId: input.executorUserId,
      approverUserId,
      reason: manifest.reason,
    },
    select: { runId: true },
  });
  await prisma.accountingPolicyRolloutEntry.createMany({
    data: manifest.entries.map((entry) => ({
      runId: run.runId,
      tenantId: entry.tenantId,
      functionalCurrencyCode: entry.functionalCurrencyCode,
      expectedClassification: entry.expectedClassification,
      observedClassification: blockingProjection ? 'BLOCKED' : 'PENDING',
      projectedResult: dryRunProjections.get(entry.tenantId) ?? null,
      finalResult: blockingProjection ? 'BLOCKED' : null,
      safeError: blockingProjection
        ? 'Apply detenido: el dry-run contiene entradas bloqueadas'
        : null,
      tenantApprovalId: entry.tenantApprovalId ?? null,
    })),
  });

  const entries: ApplyEntry[] = blockingProjection
    ? manifest.entries.map((entry) => ({ tenantId: entry.tenantId, finalResult: 'BLOCKED' }))
    : [];
  // Un dry-run bloqueado o inválido no puede llegar al provisioning. Se crea el
  // run de apply para conservar la señal operacional durable y se detiene antes
  // del primer tenant.
  let stopTriggered = Boolean(blockingProjection);
  if (blockingProjection) {
    await prisma.accountingPolicyRolloutEntry.updateMany({
      where: { runId: run.runId },
      data: {
        observedClassification: 'BLOCKED',
        finalResult: 'BLOCKED',
        safeError: 'Apply detenido: el dry-run contiene entradas bloqueadas',
      },
    });
  }
  for (const entry of manifest.entries) {
    if (stopTriggered) break;
    let result: Awaited<ReturnType<typeof provisionTenantAccountingPolicy>>;
    try {
      result = await provisionTenantAccountingPolicy({
        tenantId: entry.tenantId,
        functionalCurrencyCode: entry.functionalCurrencyCode,
        actorUserId: input.executorUserId,
        origin: 'ROLLOUT',
        reason: entry.reason,
        correlationId: input.correlationId,
        expectedEvidence: toExpectedEvidence(entry.expectedClassification),
        manifestHash,
        platformApproverUserId: approverUserId,
        tenantApprovalId: entry.tenantApprovalId,
      });
    } catch {
      entries.push({ tenantId: entry.tenantId, finalResult: 'FAILED' });
      stopTriggered = true;
      try {
        accountingPolicyRolloutEntriesCounter.inc({ result: 'FAILED' });
      } catch (error) {
        console.error('No se pudo registrar el fallo del rollout', {
          tenantId: entry.tenantId,
          error: error instanceof Error ? error.message : 'Error de telemetría desconocido',
        });
      }
      try {
        await prisma.accountingPolicyRolloutEntry.updateMany({
          where: { runId: run.runId, tenantId: entry.tenantId },
          data: { finalResult: 'FAILED', safeError: 'No se pudo aplicar la entrada' },
        });
      } catch (error) {
        console.error('No se pudo registrar el fallo del rollout en la entrada', {
          tenantId: entry.tenantId,
          error: error instanceof Error ? error.message : 'Error de bookkeeping desconocido',
        });
      }
      continue;
    }

    // El provisioning ya confirmó el commit. Ninguna falla posterior de
    // observabilidad puede convertir ese resultado durable en FAILED.
    entries.push({ tenantId: entry.tenantId, finalResult: result.result });
    try {
      accountingPolicyRolloutEntriesCounter.inc({ result: result.result });
    } catch (error) {
      console.error('No se pudo registrar la métrica de entradas del rollout', {
        tenantId: entry.tenantId,
        result: result.result,
        error: error instanceof Error ? error.message : 'Error de telemetría desconocido',
      });
    }
    try {
      await prisma.accountingPolicyRolloutEntry.updateMany({
        where: { runId: run.runId, tenantId: entry.tenantId },
        data: {
          observedClassification: result.evidence,
          finalResult: result.result,
          existingCurrencyCode: result.existingCurrencyCode,
        },
      });
    } catch (error) {
      stopTriggered = true;
      console.error('No se pudo registrar el resultado comprometido del rollout', {
        tenantId: entry.tenantId,
        result: result.result,
        error: error instanceof Error ? error.message : 'Error de bookkeeping desconocido',
      });
      try {
        await prisma.accountingPolicyRolloutEntry.updateMany({
          where: { runId: run.runId, tenantId: entry.tenantId },
          data: {
            observedClassification: result.evidence,
            finalResult: result.result,
            existingCurrencyCode: result.existingCurrencyCode,
            safeError: 'Resultado comprometido; bookkeeping requiere revisión',
          },
        });
      } catch (retryError) {
        console.error('No se pudo conservar el resultado comprometido del rollout', {
          tenantId: entry.tenantId,
          result: result.result,
          error: retryError instanceof Error
            ? retryError.message
            : 'Error de bookkeeping desconocido',
        });
      }
    }
    if (shouldStop(entry.tenantId, result.result)) stopTriggered = true;
  }
  const failed = entries.some((entry) => entry.finalResult === 'FAILED');
  await prisma.accountingPolicyRolloutRun.update({
    where: { runId: run.runId },
    data: {
      status: stopTriggered ? 'STOPPED' : failed ? 'PARTIAL' : 'COMPLETED',
      summary: entries.reduce<Record<string, number>>((summary, entry) => ({
        ...summary,
        [entry.finalResult]: (summary[entry.finalResult] ?? 0) + 1,
      }), {}),
      completedAt: new Date(),
    },
  });
  if (stopTriggered) {
    throw new ActionError(
      'Stop condition activada: el estado observado difiere de la proyección vinculante',
      'STOP_CONDITION_TRIGGERED',
    );
  }
  return { runId: run.runId, manifestHash, entries };
}

const CLI_USAGE = `Uso: accounting-policy-rollout <comando> [opciones]

Comandos:
  preflight   Inspecciona tenants explícitos sin mutar datos de negocio.
    --tenants id1,id2     Lista explícita de tenants (obligatorio).
    --executor usuario    Operador autenticable con capacidad rollout (obligatorio).

  dry-run     Persiste un dry-run vinculante a partir de un manifiesto.
    --manifest ruta       Ruta del manifiesto JSON V1 (obligatorio).
    --executor usuario    Operador autenticable (obligatorio).

  apply       Aplica el manifiesto ligado a un dry-run exitoso, tenant por tenant.
    --apply               Confirmación explícita (sin este flag no escribe nada).
    --manifest ruta       Ruta del manifiesto JSON V1 (obligatorio).
    --dry-run-id id       Dry-run exitoso del contenido exacto (obligatorio).
    --correlation-id id   Correlación operacional durable (obligatorio).
    --executor usuario    Ejecutor autenticable distinto del aprobador (obligatorio).
    --capability-mappings-proof referencia
                          Evidencia verificable de mapeos reales de capacidades (obligatorio).
    --tenant-responsibles-proof referencia
                          Evidencia verificable de responsables de tenant disponibles (obligatorio).
    --database-backup-proof referencia
                          Evidencia verificable del respaldo de base de datos (obligatorio).
    --pilot-proof referencia
                          Evidencia verificable del piloto completado sin desvíos (obligatorio).
    --audit-retention-verified
                          Opción legacy ignorada; el servidor verifica la retención.

Códigos de salida: 0 éxito, 1 error de dominio o autorización, 2 uso incorrecto.`;

const CLI_SAFE_ERROR_MESSAGES: Record<string, string> = {
  APPLY_CONFIRMATION_REQUIRED: 'El apply requiere confirmación explícita.',
  CLI_USAGE_ERROR: 'Uso incorrecto. Consulte --help.',
  DRY_RUN_ENTRIES_MISMATCH: 'Las entradas del dry-run no coinciden con el manifiesto.',
  DRY_RUN_MISMATCH: 'No existe un dry-run válido para este manifiesto.',
  FORBIDDEN: 'Las identidades del rollout no están autorizadas.',
  PREFLIGHT_INCOMPLETE: 'El preflight no inspeccionó todos los tenants requeridos.',
  ROLLOUT_NOT_READY: 'Los gates obligatorios del rollout no están satisfechos.',
  SEPARATION_OF_DUTIES_REQUIRED: 'El aprobador y el ejecutor deben ser distintos.',
  STOP_CONDITION_TRIGGERED: 'El rollout fue detenido por una condición de seguridad.',
  ROLLOUT_CLI_ERROR: 'Error operativo seguro.',
};

interface CliFlags {
  [key: string]: string | boolean | undefined;
}

/**
 * @description Analiza los argumentos de la CLI en comando y banderas simples.
 * @param {string[]} argv - Argumentos sin el binario.
 * @returns {{ command: string; flags: CliFlags }} Comando y banderas reconocidas.
 */
function parseCliArgs(argv: string[]): { command: string; flags: CliFlags } {
  const [command = '', ...rest] = argv;
  const flags: CliFlags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = rest[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }
  return { command, flags };
}

/**
 * @description Exige banderas de texto obligatorias para un comando.
 * @param {CliFlags} flags - Banderas parseadas.
 * @param {string[]} required - Nombres de bandera requeridos.
 * @returns {void} Lanza ActionError de uso si falta alguna.
 */
function requireFlagValues(flags: CliFlags, required: string[]): void {
  const missing = required.filter((key) => typeof flags[key] !== 'string' || !flags[key]);
  if (missing.length > 0) {
    throw new ActionError(
      `Faltan opciones obligatorias: ${missing.map((key) => `--${key}`).join(', ')}`,
      'CLI_USAGE_ERROR',
    );
  }
}

/**
 * @description Lee y valida el manifiesto indicado por la CLI.
 * @param {string} path - Ruta local del manifiesto JSON.
 * @returns {Promise<AccountingPolicyManifestV1>} Manifiesto validado.
 */
async function readManifestFromCli(path: string): Promise<AccountingPolicyManifestV1> {
  return parseAccountingPolicyManifest(JSON.parse(await readFile(path, 'utf8')));
}

/**
 * @description Convierte las pruebas explícitas de la CLI en gates de apply.
 * @param {CliFlags} flags - Banderas parseadas del comando apply.
 * @returns {AccountingPolicyRolloutGates} Gates con referencias auditables.
 */
function parseProductionGatesFromCli(flags: CliFlags): AccountingPolicyRolloutGates {
  requireFlagValues(flags, [
    'capability-mappings-proof',
    'tenant-responsibles-proof',
    'database-backup-proof',
    'pilot-proof',
  ]);
  return {
    capabilityMappings: {
      verified: true,
      evidenceRef: String(flags['capability-mappings-proof']),
    },
    tenantResponsibles: {
      verified: true,
      evidenceRef: String(flags['tenant-responsibles-proof']),
    },
    databaseBackup: {
      verified: true,
      evidenceRef: String(flags['database-backup-proof']),
    },
    pilot: {
      verified: true,
      evidenceRef: String(flags['pilot-proof']),
    },
  };
}

/**
 * @description Punto de entrada operativo de la CLI. El dry-run es seguro por
 *              defecto; apply exige confirmación explícita no ambigua. Los
 *              errores se imprimen solo con código estable y mensaje seguro.
 * @param {string[]} argv - Argumentos de línea de comandos sin el binario.
 * @returns {Promise<number>} Código de salida: 0 éxito, 1 dominio/autorización,
 *          2 uso incorrecto.
 */
export async function runAccountingPolicyCli(argv: string[]): Promise<number> {
  const writeUsage = (): number => {
    console.log(CLI_USAGE);
    return 0;
  };
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return writeUsage();
  }

  const { command, flags } = parseCliArgs(argv);
  try {
    if (command === 'preflight') {
      requireFlagValues(flags, ['tenants', 'executor']);
      const result = await preflightAccountingPoliciesForRollout(
        String(flags.executor),
        String(flags.tenants).split(',').map((tenantId) => tenantId.trim()).filter(Boolean),
      );
      console.log(JSON.stringify({ summary: result.summary }, null, 2));
      return 0;
    }

    if (command === 'dry-run') {
      requireFlagValues(flags, ['manifest', 'executor']);
      const manifest = await readManifestFromCli(String(flags.manifest));
      const result = await runAccountingPolicyDryRun({
        manifest,
        executorUserId: String(flags.executor),
      });
      console.log(JSON.stringify({
        runId: result.runId,
        manifestHash: result.manifestHash,
        summary: result.summary,
      }, null, 2));
      return 0;
    }

    if (command === 'apply') {
      if (flags.apply !== true) {
        throw new ActionError(
          'El apply requiere el flag --apply como confirmación explícita',
          'CLI_USAGE_ERROR',
        );
      }
      requireFlagValues(flags, ['manifest', 'dry-run-id', 'correlation-id', 'executor']);
      const productionGates = parseProductionGatesFromCli(flags);
      const manifest = await readManifestFromCli(String(flags.manifest));
      const result = await applyAccountingPolicyRollout({
        manifest,
        executorUserId: String(flags.executor),
         dryRunId: String(flags['dry-run-id']),
         correlationId: String(flags['correlation-id']),
         apply: true,
         productionGates,
       });
      console.log(JSON.stringify({
        runId: result.runId,
        manifestHash: result.manifestHash,
        entries: result.entries,
      }, null, 2));
      return 0;
    }

    throw new ActionError(
      `Comando desconocido: ${command}. Consulte --help.`,
      'CLI_USAGE_ERROR',
    );
  } catch (error) {
    const requestedCode = (error as { code?: unknown }).code;
    const normalizedCode = typeof requestedCode === 'string' ? requestedCode : '';
    const code = Object.hasOwn(CLI_SAFE_ERROR_MESSAGES, normalizedCode)
      ? normalizedCode
      : 'ROLLOUT_CLI_ERROR';
    if (code === 'ROLLOUT_CLI_ERROR') {
      // Detailed diagnostics stay in server logs; never interpolate an
      // untrusted exception message into the operator-facing output.
      console.error('accounting-policy-rollout failed', error);
    }
    console.error(`${code}: ${CLI_SAFE_ERROR_MESSAGES[code]}`);
    return code === 'CLI_USAGE_ERROR' ? 2 : 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  void runAccountingPolicyCli(process.argv.slice(2)).then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    () => {
      process.exitCode = 1;
    },
  );
}
