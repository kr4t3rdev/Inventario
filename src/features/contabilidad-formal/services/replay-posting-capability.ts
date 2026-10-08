/** Runtime authority for the historical period-guard bypass; no public token constructor. */
import { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';
import { getDefaultPermissionsForRole } from '@/lib/auth/permission-registry';
import { normalizeTenantRole } from '@/lib/auth/roles';
import { resolveEffectivePlanFeatures } from '@/lib/plan-features';
import type { ContextoPosting, EventoContableInput } from './posting-engine';
import {
  computeReplayPreflightDigest,
  type ReplayPreflightDigestSnapshot,
} from './replay-preflight-digest';

type ReplayDb = Pick<Prisma.TransactionClient, 'tenantMembership' | 'tenantLicense'>;
const REPLAY_PERMISSION = 'financiero.contabilidad.acceder';
declare const replayCapabilityBrand: unique symbol;
/** Opaque runtime authority; structural copies are not valid capabilities. */
export interface ReplayPostingCapability { readonly [replayCapabilityBrand]: true }
interface CapabilityScope extends ContextoPosting { periodoId: string; replayRunId: string }
interface Authority extends CapabilityScope {
  tx: Prisma.TransactionClient;
  expiresAt: Date;
  snapshot: ReplayPreflightDigestSnapshot;
}
const authorities = new WeakMap<object, Authority>();

/** @description Fails closed before any ledger mutation when authority is absent or out of scope. */
function invalidCapability(): never {
  throw new ActionError('Capacidad de replay no válida', 'INVALID_REPLAY_CAPABILITY');
}

/**
 * @description Issues a non-forgeable capability only for a persisted approved RUNNING run.
 * @param tx - Owning transaction; no capability can be transferred to another transaction.
 * @param scope - Run, tenant, actor and period identities already authenticated by the service.
 * @param callback - Authorized posting scope; authority is revoked on success or failure.
 * @returns Callback result without leaking usable authority beyond its lifetime.
 */
export async function withReplayPostingCapability<T>(
  tx: Prisma.TransactionClient,
  scope: CapabilityScope,
  callback: (capability: ReplayPostingCapability) => Promise<T>,
): Promise<T> {
  const run = await tx.replayRun.findUnique({
    where: { tenantId_replayRunId: { tenantId: scope.tenantId, replayRunId: scope.replayRunId } },
    include: { preflight: true, approval: true },
  });
  if (!run) invalidCapability();
  const { preflight, approval } = run;
  const now = new Date();
  if (
    run.tenantId !== scope.tenantId || run.startedByUserId !== scope.userId ||
    run.status !== 'RUNNING' || run.digestVersion !== 2 ||
    preflight.tenantId !== scope.tenantId || preflight.periodoId !== scope.periodoId ||
    preflight.replayPreflightId !== run.replayPreflightId || preflight.status !== 'APPROVED' ||
    preflight.digestVersion !== run.digestVersion || preflight.digest !== run.digest ||
    preflight.expiresAt <= now ||
    preflight.expiresAt.getTime() !== preflight.generatedAt.getTime() + 86_400_000 ||
    approval.tenantId !== scope.tenantId || approval.replayPreflightId !== run.replayPreflightId ||
    approval.replayApprovalId !== run.replayApprovalId || approval.status !== 'APPROVED' ||
    approval.requestedByUserId !== preflight.requestedByUserId ||
    approval.approvedByUserId === preflight.requestedByUserId ||
    approval.digestVersion !== run.digestVersion || approval.digest !== run.digest
  ) invalidCapability();
  const snapshot = preflight.snapshot as unknown as ReplayPreflightDigestSnapshot;
  try {
    if (snapshot.tenantId !== scope.tenantId || snapshot.period.periodId !== scope.periodoId ||
      computeReplayPreflightDigest(snapshot) !== run.digest) invalidCapability();
  } catch { invalidCapability(); }
  await requireCurrentReplayEntitlement(tx, scope.tenantId);
  await requireCurrentReplayPermission(tx, scope.tenantId, scope.userId);
  await requireCurrentReplayPermission(tx, scope.tenantId, approval.approvedByUserId);
  const capability = Object.freeze({}) as ReplayPostingCapability;
  authorities.set(capability, {
    ...scope, tx, expiresAt: new Date(preflight.expiresAt),
    snapshot: JSON.parse(JSON.stringify(snapshot)) as ReplayPreflightDigestSnapshot,
  });
  try { return await callback(capability); }
  finally { authorities.delete(capability); }
}

/**
 * @description Verifies private authority and the exact approved source valuation/semantics.
 * @param capability - Untrusted token; serialized, forged or revoked values are rejected.
 * @param tx - Current posting transaction.
 * @param ctx - Tenant and authenticated actor.
 * @param evento - Exact approved source payload.
 * @param periodoId - Explicit approved historical period.
 * @returns Nothing when authority is valid; otherwise throws before persistence.
 */
export function assertReplayPostingCapability(
  capability: unknown,
  tx: Prisma.TransactionClient,
  ctx: ContextoPosting,
  evento: EventoContableInput,
  periodoId: string,
): void {
  const authority = capability && typeof capability === 'object' ? authorities.get(capability) : null;
  if (!authority || authority.tx !== tx || authority.tenantId !== ctx.tenantId ||
    authority.userId !== ctx.userId || authority.periodoId !== periodoId ||
    authority.expiresAt <= new Date()) invalidCapability();
  const snapshot = authority.snapshot;
  const source = snapshot.sources.find((row) =>
    row.identity.sourceType === evento.origen.tipo && row.identity.sourceId === evento.origen.id);
  if (!source || source.classification !== 'REPLAYABLE' || source.omissionCause !== null)
    invalidCapability();
  const decimal = (value: Prisma.Decimal | string | number | null | undefined): string | null =>
    value == null ? null : new Prisma.Decimal(value).toString();
  try {
    const expected = { ...snapshot, sources: [source] };
    const actual = { ...snapshot, sources: [{
      ...source,
      semantics: {
        tipo: evento.tipo, fecha: evento.fecha, descripcion: evento.descripcion,
        medioCobro: evento.medioCobro ?? null, referencia: evento.referencia ?? null,
        auxiliares: {
          costoFifo: decimal(evento.auxiliares?.costoFifo),
          intereses: decimal(evento.auxiliares?.intereses),
          montoPagado: decimal(evento.auxiliares?.montoPagado),
          diferenciaFx: decimal(evento.auxiliares?.diferenciaFx),
        },
      },
      valuation: {
        originalAmount: decimal(evento.monto), originalCurrency: evento.moneda?.trim().toUpperCase() || null,
        functionalAmount: decimal(evento.montoFuncional),
        functionalCurrency: evento.monedaFuncional?.trim().toUpperCase() || null,
        fxRate: decimal(evento.tasaCambio), fxEvidenceFingerprint: evento.fxEvidenceFingerprint ?? null,
      },
    }] };
    if (computeReplayPreflightDigest(expected) !== computeReplayPreflightDigest(actual))
      invalidCapability();
  } catch { invalidCapability(); }
}

/** Re-reads current membership and role data; token permissions are not authoritative here. */
export async function requireCurrentReplayPermission(
	client: ReplayDb,
	tenantId: string,
	userId: string,
	requireManager = true,
) {
	const membership = await client.tenantMembership.findFirst({
		where: { tenantId, userId, isActive: true },
		include: { user: { select: { isActive: true } }, customRole: true },
	});
	const tenantRole = normalizeTenantRole(membership?.tenantRole);
	if (
		!membership || !tenantRole || (requireManager && tenantRole !== 'manager') || !membership.user?.isActive ||
		(membership.customRoleId && (
			!membership.customRole?.isActive || membership.customRole.tenantId !== tenantId ||
			!Array.isArray(membership.customRole.permissions)
		))
	) throw new Error('Se requiere una membresía activa de responsable contable');
	const permissions = membership.customRoleId
		? membership.customRole?.permissions as unknown[]
		: [...getDefaultPermissionsForRole(tenantRole)];
	if (!permissions.includes(REPLAY_PERMISSION)) throw new Error('Permiso contable actual requerido');
	return membership;
}

/** Requires a current active tenant license that grants formal accounting. */
export async function requireCurrentReplayEntitlement(client: ReplayDb, tenantId: string) {
	const license = await client.tenantLicense.findFirst({
		where: { tenantId, activa: true, expiracion: { gt: new Date() } },
		include: { plan: { select: { features: true } } },
		orderBy: { inicio: 'desc' },
	});
	if (!license) throw new Error('Licencia activa requerida para contabilidad formal');
	const effectiveFeatures = resolveEffectivePlanFeatures({
		planFeatures: featureRecord(license.plan?.features),
		featureOverrides: featureRecord(license.featureOverrides),
		legacyLicenseFeatures: featureRecord(license.features),
	});
	if (effectiveFeatures['contabilidad-formal'] !== true) {
		throw new Error('La licencia no habilita contabilidad formal');
	}
}

function featureRecord(value: unknown): Record<string, boolean> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
	);
}

