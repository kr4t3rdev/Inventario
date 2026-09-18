import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';

import { hashImmutableFinancialEvidence } from './immutable-financial-evidence';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';

type CheckpointErrorCode =
  | 'CUTOFF_EVIDENCE_UNAVAILABLE'
  | 'CHECKPOINT_INTEGRITY_FAILED'
  | 'CHECKPOINT_PAYLOAD_INCOMPLETE';

/** Error esperado al capturar o verificar un checkpoint contable. */
export class FinancialAuxiliaryCheckpointError extends Error {
  /**
   * @description Construye un error tipado de checkpoint.
   * @param {string} message - Mensaje seguro.
   * @param {CheckpointErrorCode} code - Código estable del dominio.
   * @returns {FinancialAuxiliaryCheckpointError} Error tipado.
   */
  constructor(message: string, public readonly code: CheckpointErrorCode) {
    super(message);
    this.name = 'FinancialAuxiliaryCheckpointError';
  }
}

/** Evidencia mínima inmutable necesaria para servir balance y resultados sin relecturas. */
export interface FinancialAuxiliaryCheckpointPayloadV1 {
  version: 1;
  cutoffAt: string;
  capturedAt: string;
  resultThrough: string;
  functionalCurrency: string;
  balance: unknown;
  result: unknown;
  sourceFingerprints: Record<string, string>;
  appliedFxEvidence: unknown[];
}

export interface FinancialAuxiliaryEvidence {
  sourceId: string;
  sourceType: string;
  status: string;
  identity: Record<string, unknown>;
  originalAmount: string;
  originalCurrency: string;
  functionalAmount: string | null;
  functionalCurrency: string;
  fxEvidence: Record<string, unknown> | null;
  evidenceFingerprint: string;
}

/**
 * @description Lee las partidas auxiliares actuales que respaldan un checkpoint v3.
 * Todas las consultas incluyen el tenant propietario y se ejecutan con el cliente
 * transaccional que ya retiene el lock contable común.
 * @param {{client: Prisma.TransactionClient; tenantId: string; cutoffAt: Date; functionalCurrency: string}} params - Contexto de captura.
 * @returns {Promise<FinancialAuxiliaryCheckpointPayloadV3['auxiliaries']>} Evidencia nativa auditable.
 */
export async function collectFinancialAuxiliaryEvidence(params: {
  client: Prisma.TransactionClient;
  tenantId: string;
  cutoffAt: Date;
  functionalCurrency: string;
}): Promise<FinancialAuxiliaryCheckpointPayloadV3['auxiliaries']> {
  const db = params.client;
  const functionalCurrency = params.functionalCurrency.trim().toUpperCase();
  const [bankAccounts, stockLocations, purchaseItems, receivables, payables, injections] =
    await Promise.all([
      db.cuentaBancaria.findMany({
        where: { tenantId: params.tenantId, isActive: true },
        select: { cuentaId: true, nombreBanco: true, tipoCuenta: true, saldo: true, moneda: true },
      }),
      db.stockUbicacion.findMany({
        where: { tenantId: params.tenantId, cantidad: { gt: 0 } },
        select: {
          id: true,
          productoId: true,
          tipoUbicacion: true,
          ubicacionId: true,
          cantidad: true,
          producto: { select: { precioCosto: true } },
        },
      }),
      db.compraDocumentoItem.findMany({
        where: {
          tenantId: params.tenantId,
          compraDocumento: { deletedAt: null },
        },
        select: {
          compraDocumentoItemId: true,
          compraDocumentoId: true,
          productoId: true,
          cantidad: true,
          precioUnitario: true,
          totalLinea: true,
        },
      }),
      db.cuentaPorCobrar.findMany({
        where: { tenantId: params.tenantId },
        select: {
          id: true,
          montoDeuda: true,
          montoPagado: true,
          estado: true,
          prestamoCash: { select: { moneda: true } },
        },
      }),
      db.cuentaPorPagar.findMany({
        where: { tenantId: params.tenantId, deletedAt: null },
        select: {
          cuentaPorPagarId: true,
          saldoPendiente: true,
          moneda: true,
          estado: true,
        },
      }),
      db.inyeccionCapital.findMany({
        where: {
          cuentaBancaria: { tenantId: params.tenantId },
          fechaRegistro: { lte: params.cutoffAt },
        },
        select: {
          id: true,
          tipo: true,
          montoRecibido: true,
          saldoPendiente: true,
          moneda: true,
          fechaRegistro: true,
          estado: true,
        },
      }),
    ]);

  const bankEvidence = bankAccounts.map((account) => buildAuxiliaryEvidence({
    sourceId: account.cuentaId,
    sourceType: 'BANK_ACCOUNT',
     status: 'ACTIVE',
    identity: {
      bankName: account.nombreBanco,
      accountType: account.tipoCuenta,
    },
    originalAmount: toAmountString(account.saldo),
    originalCurrency: account.moneda,
    functionalCurrency,
  }));
  const inventoryEvidence = [
    ...stockLocations.map((location) => buildAuxiliaryEvidence({
      sourceId: location.id,
      sourceType: 'STOCK_LOCATION',
      status: 'ACTIVE',
      identity: {
        productId: location.productoId,
        locationType: location.tipoUbicacion,
        locationId: location.ubicacionId,
        quantity: location.cantidad,
        unitCost: toAmountString(location.producto.precioCosto),
      },
      originalAmount: String(location.cantidad),
      originalCurrency: functionalCurrency,
      functionalCurrency,
    })),
    ...purchaseItems.map((item) => buildAuxiliaryEvidence({
      sourceId: item.compraDocumentoItemId,
      sourceType: 'PURCHASE_INVENTORY_LAYER',
      status: 'ACTIVE',
      identity: {
        purchaseDocumentId: item.compraDocumentoId,
        productId: item.productoId,
        quantity: item.cantidad,
        unitCost: toAmountString(item.precioUnitario),
      },
      originalAmount: toAmountString(item.totalLinea),
      originalCurrency: functionalCurrency,
      functionalCurrency,
    })),
  ];
  const receivableEvidence = receivables.map((receivable) => buildAuxiliaryEvidence({
    sourceId: receivable.id,
    sourceType: 'RECEIVABLE',
    status: String(receivable.estado),
    identity: {
      debt: toAmountString(receivable.montoDeuda),
      paid: toAmountString(receivable.montoPagado),
    },
    originalAmount: toAmountString(
      Number(receivable.montoDeuda) - Number(receivable.montoPagado),
    ),
    originalCurrency: receivable.prestamoCash?.moneda ?? functionalCurrency,
    functionalCurrency,
  }));
  const payableEvidence = payables.map((payable) => buildAuxiliaryEvidence({
    sourceId: payable.cuentaPorPagarId,
    sourceType: 'PAYABLE',
    status: String(payable.estado),
    identity: {},
    originalAmount: toAmountString(payable.saldoPendiente),
    originalCurrency: payable.moneda,
    functionalCurrency,
  }));
  const debtEvidence = injections
    .filter((injection) => injection.tipo !== 'CAPITAL_SOCIAL')
    .map((injection) => buildAuxiliaryEvidence({
      sourceId: injection.id,
      sourceType: 'EXTERNAL_DEBT',
      status: String(injection.estado ?? 'UNKNOWN'),
      identity: {
        type: injection.tipo,
        registeredAt: injection.fechaRegistro.toISOString(),
      },
      originalAmount: toAmountString(injection.saldoPendiente ?? injection.montoRecibido),
      originalCurrency: injection.moneda,
      functionalCurrency,
    }));
  const capitalEvidence = injections
    .filter((injection) => injection.tipo === 'CAPITAL_SOCIAL')
    .map((injection) => buildAuxiliaryEvidence({
      sourceId: injection.id,
      sourceType: 'CAPITAL',
      status: String(injection.estado ?? 'UNKNOWN'),
      identity: { registeredAt: injection.fechaRegistro.toISOString() },
      originalAmount: toAmountString(injection.montoRecibido),
      originalCurrency: injection.moneda,
      functionalCurrency,
    }));

  return {
    bankAccounts: bankEvidence,
    inventory: inventoryEvidence,
    receivables: receivableEvidence,
    payables: payableEvidence,
    debt: debtEvidence,
    capital: capitalEvidence,
  };
}

export interface FinancialAuxiliaryCheckpointPayloadV3 {
  version: 3;
  tenantId: string;
  cutoffAt: string;
  capturedAt: string;
  resultThrough: string;
  functionalCurrency: string;
  balance: unknown;
  result: unknown;
  sourceFingerprints: Record<string, string>;
  appliedFxEvidence: unknown[];
  auxiliaries: {
    bankAccounts: FinancialAuxiliaryEvidence[];
    inventory: FinancialAuxiliaryEvidence[];
    receivables: FinancialAuxiliaryEvidence[];
    payables: FinancialAuxiliaryEvidence[];
    debt: FinancialAuxiliaryEvidence[];
    capital: FinancialAuxiliaryEvidence[];
  };
}

export type FinancialAuxiliaryCheckpointPayload =
  | FinancialAuxiliaryCheckpointPayloadV1
  | FinancialAuxiliaryCheckpointPayloadV3;

interface CollectedCheckpointEvidence {
  functionalCurrency: string;
  balance: unknown;
  result: unknown;
  resultThrough: string;
  sourceFingerprints: Record<string, string>;
  appliedFxEvidence: unknown[];
  auxiliaries?: FinancialAuxiliaryCheckpointPayloadV3['auxiliaries'];
}

export interface CaptureCheckpointParams {
  tenantId: string;
  capturedBy: string;
  schemaVersion?: 1 | 3;
  requestedCutoffAt?: Date;
  client?: Prisma.TransactionClient;
  collectEvidence: (
    client: Prisma.TransactionClient,
    cutoffAt: Date,
  ) => Promise<CollectedCheckpointEvidence>;
}

/**
 * @description Captura evidencia actual bajo aislamiento serializable y lock tenant-scoped.
 * @param {CaptureCheckpointParams} params - Tenant, actor y recolector canónico.
 * @returns {Promise<object>} Checkpoint persistido.
 */
export async function captureFinancialAuxiliaryCheckpoint(params: CaptureCheckpointParams) {
  const capture = async (tx: Prisma.TransactionClient) => {
    await acquireAccountingTenantLock(tx, params.tenantId);

    if (params.requestedCutoffAt) {
      const requestedCheckpoint = await tx.financialAuxiliaryCheckpoint.findUnique({
        where: {
          tenantId_cutoffAt: {
            tenantId: params.tenantId,
            cutoffAt: params.requestedCutoffAt,
          },
        },
      });
      if (requestedCheckpoint) return requestedCheckpoint;
    }

    const [boundary] = await tx.$queryRaw<Array<{ cutoffAt: Date }>>`
      SELECT transaction_timestamp() AS "cutoffAt"
    `;
    if (!boundary) {
      throw new FinancialAuxiliaryCheckpointError(
        'No se pudo establecer el corte contable actual',
        'CUTOFF_EVIDENCE_UNAVAILABLE',
      );
    }
    if (
      params.requestedCutoffAt &&
      params.requestedCutoffAt.getTime() !== boundary.cutoffAt.getTime()
    ) {
      throw new FinancialAuxiliaryCheckpointError(
        'No existe evidencia inmutable para el corte solicitado',
        'CUTOFF_EVIDENCE_UNAVAILABLE',
      );
    }

    const existing = await tx.financialAuxiliaryCheckpoint.findUnique({
      where: {
        tenantId_cutoffAt: {
          tenantId: params.tenantId,
          cutoffAt: boundary.cutoffAt,
        },
      },
    });
    if (existing) return existing;

    const evidence = await params.collectEvidence(tx, boundary.cutoffAt);
    const [completion] = await tx.$queryRaw<Array<{ capturedAt: Date }>>`
      SELECT clock_timestamp() AS "capturedAt"
    `;
    if (!completion || completion.capturedAt < boundary.cutoffAt) {
      throw new FinancialAuxiliaryCheckpointError(
        'La cronología del checkpoint no es válida',
        'CUTOFF_EVIDENCE_UNAVAILABLE',
      );
    }
    const payload = params.schemaVersion === 3
      ? buildV3CheckpointPayload({
          tenantId: params.tenantId,
          cutoffAt: boundary.cutoffAt,
          capturedAt: completion.capturedAt,
          evidence,
        })
      : {
          version: 1 as const,
          cutoffAt: boundary.cutoffAt.toISOString(),
          capturedAt: completion.capturedAt.toISOString(),
          resultThrough: evidence.resultThrough,
          functionalCurrency: evidence.functionalCurrency.trim().toUpperCase(),
          balance: evidence.balance,
          result: evidence.result,
          sourceFingerprints: evidence.sourceFingerprints,
          appliedFxEvidence: evidence.appliedFxEvidence,
        } satisfies FinancialAuxiliaryCheckpointPayloadV1;
    return tx.financialAuxiliaryCheckpoint.create({
      data: {
        tenantId: params.tenantId,
        schemaVersion: params.schemaVersion === 3 ? 3 : undefined,
        cutoffAt: boundary.cutoffAt,
        capturedAt: completion.capturedAt,
        functionalCurrencyCode: payload.functionalCurrency,
        payload: payload as unknown as Prisma.InputJsonValue,
        hashIntegridad: hashImmutableFinancialEvidence(payload),
        capturedBy: params.capturedBy,
      },
    });
  };

  if (params.client) return capture(params.client);
  return prisma.$transaction(capture, { isolationLevel: 'Serializable' });
}

interface FindCheckpointParams {
  tenantId: string;
  cutoffAt: Date;
}

/**
 * @description Lee un checkpoint por tenant y corte exactos, verificando su hash.
 * @param {FindCheckpointParams} params - Identidad tenant-scoped del checkpoint.
 * @returns {Promise<object | null>} Checkpoint íntegro o null si no existe.
 */
export async function findFinancialAuxiliaryCheckpoint(params: FindCheckpointParams) {
  const checkpoint = await prisma.financialAuxiliaryCheckpoint.findUnique({
    where: {
      tenantId_cutoffAt: {
        tenantId: params.tenantId,
        cutoffAt: params.cutoffAt,
      },
    },
  });
  if (!checkpoint) return null;
  const payload = checkpoint.payload as unknown as FinancialAuxiliaryCheckpointPayload;
  const payloadVersion = payload.version;
  if (
    hashImmutableFinancialEvidence(checkpoint.payload) !== checkpoint.hashIntegridad ||
    (payloadVersion !== 1 && payloadVersion !== 3) ||
    payload.cutoffAt !== checkpoint.cutoffAt.toISOString() ||
    payload.capturedAt !== checkpoint.capturedAt.toISOString() ||
    payload.functionalCurrency !== checkpoint.functionalCurrencyCode ||
    (payloadVersion === 3 && (
      payload.tenantId !== params.tenantId ||
      checkpoint.schemaVersion !== 3 ||
      !isCompleteV3CheckpointPayload(payload)
    ))
  ) {
    throw new FinancialAuxiliaryCheckpointError(
      'La integridad del checkpoint contable no es válida',
      'CHECKPOINT_INTEGRITY_FAILED',
    );
  }
  return {
    ...checkpoint,
    payload,
  };
}

function buildV3CheckpointPayload(params: {
  tenantId: string;
  cutoffAt: Date;
  capturedAt: Date;
  evidence: CollectedCheckpointEvidence;
}): FinancialAuxiliaryCheckpointPayloadV3 {
  if (!params.evidence.auxiliaries || !isCompleteAuxiliaryGroups(params.evidence.auxiliaries)) {
    throw new FinancialAuxiliaryCheckpointError(
      'La evidencia nativa del checkpoint v3 está incompleta',
      'CHECKPOINT_PAYLOAD_INCOMPLETE',
    );
  }
  const payload: FinancialAuxiliaryCheckpointPayloadV3 = {
    version: 3,
    tenantId: params.tenantId,
    cutoffAt: params.cutoffAt.toISOString(),
    capturedAt: params.capturedAt.toISOString(),
    resultThrough: params.evidence.resultThrough,
    functionalCurrency: params.evidence.functionalCurrency.trim().toUpperCase(),
    balance: params.evidence.balance,
    result: params.evidence.result,
    sourceFingerprints: params.evidence.sourceFingerprints,
    appliedFxEvidence: params.evidence.appliedFxEvidence,
    auxiliaries: params.evidence.auxiliaries,
  };
  if (!isCompleteV3CheckpointPayload(payload)) {
    throw new FinancialAuxiliaryCheckpointError(
      'La evidencia nativa del checkpoint v3 está incompleta',
      'CHECKPOINT_PAYLOAD_INCOMPLETE',
    );
  }
  return payload;
}

function isCompleteV3CheckpointPayload(
  payload: FinancialAuxiliaryCheckpointPayload,
): payload is FinancialAuxiliaryCheckpointPayloadV3 {
  return payload.version === 3 &&
    typeof payload.tenantId === 'string' &&
    isCompleteAuxiliaryGroups(payload.auxiliaries);
}

function isCompleteAuxiliaryGroups(
  auxiliaries: FinancialAuxiliaryCheckpointPayloadV3['auxiliaries'] | undefined,
): auxiliaries is FinancialAuxiliaryCheckpointPayloadV3['auxiliaries'] {
  if (!auxiliaries || typeof auxiliaries !== 'object') return false;
  const groups = [
    auxiliaries.bankAccounts,
    auxiliaries.inventory,
    auxiliaries.receivables,
    auxiliaries.payables,
    auxiliaries.debt,
    auxiliaries.capital,
  ];
  return groups.every((group) => Array.isArray(group) && group.every(isCompleteAuxiliary));
}

function isCompleteAuxiliary(value: unknown): value is FinancialAuxiliaryEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const auxiliary = value as Partial<FinancialAuxiliaryEvidence>;
  return typeof auxiliary.sourceId === 'string' && auxiliary.sourceId.length > 0 &&
    typeof auxiliary.sourceType === 'string' && auxiliary.sourceType.length > 0 &&
    typeof auxiliary.status === 'string' && auxiliary.status.length > 0 &&
    Boolean(auxiliary.identity) && typeof auxiliary.identity === 'object' &&
    typeof auxiliary.originalAmount === 'string' &&
    typeof auxiliary.originalCurrency === 'string' &&
    (auxiliary.functionalAmount === null || typeof auxiliary.functionalAmount === 'string') &&
    typeof auxiliary.functionalCurrency === 'string' &&
    (auxiliary.fxEvidence === null || typeof auxiliary.fxEvidence === 'object') &&
    typeof auxiliary.evidenceFingerprint === 'string' &&
    auxiliary.evidenceFingerprint.length > 0;
}

function buildAuxiliaryEvidence(params: {
  sourceId: string;
  sourceType: string;
  status: string;
  identity: Record<string, unknown>;
  originalAmount: string;
  originalCurrency: string;
  functionalCurrency: string;
}): FinancialAuxiliaryEvidence {
  const originalCurrency = params.originalCurrency.trim().toUpperCase();
  const sameCurrency = originalCurrency === params.functionalCurrency;
  const evidence = {
    sourceId: params.sourceId,
    sourceType: params.sourceType,
    status: params.status,
    identity: params.identity,
    originalAmount: params.originalAmount,
    originalCurrency,
    functionalAmount: sameCurrency ? params.originalAmount : null,
    functionalCurrency: params.functionalCurrency,
    fxEvidence: null,
  };
  return {
    ...evidence,
    evidenceFingerprint: hashImmutableFinancialEvidence(evidence),
  };
}

function toAmountString(value: unknown): string {
  if (value && typeof value === 'object' && 'toString' in value) {
    return String(value);
  }
  return String(value ?? '0');
}
