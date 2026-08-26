import { register, Counter, Gauge, collectDefaultMetrics, Registry } from 'prom-client'
import type {
  AccountingPolicyOrigin,
  ProvisioningResult,
} from '@/features/contabilidad/types/accounting-policy'
import { prisma } from '@/lib/prisma'

// Singleton para el registro de métricas para evitar errores de recarga en desarrollo
// "Metric with name ... has already been registered"
let metricsRegistry: Registry

declare global {
  var _metricsRegistry: Registry | undefined
}

if (process.env.NODE_ENV === 'production') {
  metricsRegistry = register
} else {
  if (!global._metricsRegistry) {
    global._metricsRegistry = register
  }
  metricsRegistry = global._metricsRegistry
}

// Inicializar métricas por defecto (CPU, memoria, etc.)
// Solo si no se han inicializado ya
try {
  collectDefaultMetrics({ register: metricsRegistry })
} catch (e) {
  // Ignorar error si ya se están recolectando
}

// Definición de contadores personalizados
// Usamos un patrón para obtener o crear la métrica para soportar Hot Reloading

const getOrCreateCounter = (name: string, help: string, labelNames: string[]) => {
  const existing = metricsRegistry.getSingleMetric(name)
  if (existing) {
    return existing as Counter
  }
  return new Counter({
    name,
    help,
    labelNames,
    registers: [metricsRegistry],
  })
}

const getOrCreateGauge = (name: string, help: string, labelNames: string[] = []) => {
  const existing = metricsRegistry.getSingleMetric(name)
  if (existing) {
    return existing as Gauge
  }
  return new Gauge({
    name,
    help,
    labelNames,
    registers: [metricsRegistry],
  })
}

export const licenseValidationCounter = getOrCreateCounter(
  'licencias_validaciones_total',
  'Total de validaciones de licencias',
  ['status', 'reason'] // status: 'valid', 'invalid', 'error'. reason: 'active', 'expired', 'revoked', 'not_found', etc.
)

export const rateLimitCounter = getOrCreateCounter(
  'rate_limit_hits_total',
  'Total de peticiones rechazadas por rate limit',
  ['endpoint', 'ip']
)

export const idempotencyCounter = getOrCreateCounter(
  'idempotency_hits_total',
  'Total de peticiones manejadas por idempotencia',
  ['endpoint', 'action'] // action: 'cache_hit', 'conflict'
)

export const licenseCreationCounter = getOrCreateCounter(
  'licencias_creadas_total',
  'Total de licencias creadas',
  ['plan', 'origen'] // origen: 'manual', 'api'
)

// Métricas de provisioning de política contable (baja cardinalidad:
// nunca incluir tenantId, actor ni moneda en las etiquetas).
export const accountingPolicyPreflightCounter = getOrCreateCounter(
  'accounting_policy_preflight_total',
  'Tenants inspeccionados por el preflight de política contable',
  ['classification'] // classification: 'POLICY_PRESENT', 'MISSING_NO_EVIDENCE', 'MISSING_WITH_EVIDENCE', 'REVIEW_REQUIRED'
)

export const accountingPolicyProvisioningCounter = getOrCreateCounter(
  'accounting_policy_provisioning_total',
  'Decisiones de provisioning de política contable',
  ['origin', 'result'] // origin: 'ONBOARDING', 'DEMO', 'TENANT_UI', 'ROLLOUT'; result: 'CREATED', 'UPDATED', 'NO_OP', 'CONFLICT', 'BLOCKED'
)

export const accountingPolicyRolloutEntriesCounter = getOrCreateCounter(
  'accounting_policy_rollout_entries_total',
  'Entradas aplicadas por lotes de rollout de política contable',
  ['result'] // result: 'CREATED', 'NO_OP', 'CONFLICT', 'BLOCKED', 'FAILED'
)

export const operationalTenantsWithoutAccountingPolicyGauge = getOrCreateGauge(
  'operational_tenants_without_accounting_policy',
  'Tenants operativos sin política contable configurada; mayor que cero exige acción',
  []
)

/**
 * @description Publica una decisión solo después de que la transacción exterior confirmó el commit.
 * @param {AccountingPolicyOrigin} origin - Origen de la operación contable.
 * @param {ProvisioningResult} result - Resultado durable confirmado.
 * @returns {void} Incrementa el contador post-commit.
 */
export function recordAccountingPolicyProvisioningCommitted(
  origin: AccountingPolicyOrigin,
  result: ProvisioningResult,
): void {
  accountingPolicyProvisioningCounter.inc({ origin, result })
}

interface OperationalTenantGaugeClient {
  tenantLicense: {
    count(args: { where: Record<string, unknown> }): Promise<number>
  }
}

/**
 * @description Actualiza el gauge con licencias operativas vigentes sin política.
 * @param {OperationalTenantGaugeClient} client - Cliente Prisma server-side.
 * @returns {Promise<number>} Cantidad observada y publicada.
 */
export async function refreshOperationalTenantsWithoutAccountingPolicy(
  client: OperationalTenantGaugeClient = prisma,
): Promise<number> {
  const count = await client.tenantLicense.count({
    where: {
      activa: true,
      expiracion: { gt: new Date() },
      tenant: { accountingPolicy: null },
    },
  })
  operationalTenantsWithoutAccountingPolicyGauge.set(count)
  return count
}

export { metricsRegistry }
