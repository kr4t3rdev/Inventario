import { Prisma, type PrismaClient } from '@/generated/prisma';
import { prisma as defaultPrisma } from '@/lib/prisma';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import { getRequiredTenantAccountingPolicy } from './tenant-accounting-policy-service';
import { exchangeRateProvider } from './exchange-rate-provider';
import type { ExchangeRateProvider } from './exchange-types';

export const FX_EVIDENCE_SOURCE_TYPES = {
  BANK_ACCOUNT: 'BANK_ACCOUNT',
  CAPITAL_INJECTION: 'CAPITAL_INJECTION',
} as const;

type FxEvidenceDb = Pick<PrismaClient, 'cuentaBancaria' | 'inyeccionCapital' | 'fxEvidence'>;

interface CaptureEligibleInput {
  tenantId: string;
  boundaryAt: Date;
}

interface SkippedFxEvidence {
  sourceType: string;
  sourceId: string;
  issue: 'MISSING_RATE' | 'MISSING_PENDING_BALANCE' | 'INVALID_AMOUNT';
}

export interface CaptureFxEvidenceResult {
  capturedCount: number;
  idempotentCount: number;
  skippedCount: number;
  skipped: SkippedFxEvidence[];
}

interface Candidate {
  sourceType: string;
  sourceId: string;
  amount: number;
  currency: string;
  cutoffAt: Date;
  rateBoundaryAt: Date;
}

/**
 * @description Persiste evidencia histórica e inmutable para partidas extranjeras del balance.
 * @param {FxEvidenceDb} db - Cliente Prisma o cliente transaccional.
 * @param {ExchangeRateProvider} rateProvider - Proveedor de tasas históricas.
 * @returns {FxEvidenceService} Servicio configurado.
 */
export function createFxEvidenceService(
  db: FxEvidenceDb = defaultPrisma,
  rateProvider: ExchangeRateProvider = exchangeRateProvider,
) {
  return new FxEvidenceService(db, rateProvider);
}

/**
 * @description Servicio que captura conversiones FX sin sustituir evidencia histórica por una tasa actual.
 */
export class FxEvidenceService {
  constructor(
    private readonly db: FxEvidenceDb,
    private readonly rateProvider: ExchangeRateProvider,
  ) {}

  /**
   * @description Captura bancos e inyecciones extranjeras elegibles al corte indicado.
   * @param {CaptureEligibleInput} input - Tenant y límite temporal.
   * @returns {Promise<CaptureFxEvidenceResult>} Conteo de filas nuevas, idempotentes y omitidas.
   */
  async captureEligible(input: CaptureEligibleInput): Promise<CaptureFxEvidenceResult> {
    const policy = await getRequiredTenantAccountingPolicy(input.tenantId);
    const functionalCurrency = policy.functionalCurrencyCode.trim().toUpperCase();
    const [banks, injections] = await Promise.all([
      this.db.cuentaBancaria.findMany({
        where: { tenantId: input.tenantId, isActive: true, saldo: { not: 0 } },
        select: { cuentaId: true, saldo: true, moneda: true },
      }),
      this.db.inyeccionCapital.findMany({
        where: {
          cuentaBancaria: { tenantId: input.tenantId },
          fechaRegistro: { lte: input.boundaryAt },
        },
        select: {
          id: true,
          tipo: true,
          montoRecibido: true,
          saldoPendiente: true,
          moneda: true,
          fechaRegistro: true,
        },
      }),
    ]);

    const candidates: Candidate[] = [
      ...banks.map((bank) => ({
        sourceType: FX_EVIDENCE_SOURCE_TYPES.BANK_ACCOUNT,
        sourceId: bank.cuentaId,
        amount: Number(bank.saldo),
        currency: bank.moneda,
        cutoffAt: input.boundaryAt,
        rateBoundaryAt: input.boundaryAt,
      })),
      ...injections.flatMap((injection) => {
        const amount = injection.tipo === 'CAPITAL_SOCIAL'
          ? Number(injection.montoRecibido)
          : Number(injection.saldoPendiente);
        if (injection.tipo !== 'CAPITAL_SOCIAL' && injection.saldoPendiente == null) return [];
        return [{
          sourceType: FX_EVIDENCE_SOURCE_TYPES.CAPITAL_INJECTION,
          sourceId: injection.id,
          amount,
          currency: injection.moneda,
          cutoffAt: input.boundaryAt,
          rateBoundaryAt: injection.tipo === 'CAPITAL_SOCIAL'
            ? injection.fechaRegistro
            : input.boundaryAt,
        }];
      }),
    ].filter((candidate) => candidate.currency.trim().toUpperCase() !== functionalCurrency);

    const result: CaptureFxEvidenceResult = {
      capturedCount: 0,
      idempotentCount: 0,
      skippedCount: 0,
      skipped: [],
    };
    const capturedAt = new Date();

    for (const candidate of candidates) {
      if (!Number.isFinite(candidate.amount) || candidate.amount <= 0) {
        result.skipped.push({
          sourceType: candidate.sourceType,
          sourceId: candidate.sourceId,
          issue: 'INVALID_AMOUNT',
        });
        continue;
      }

      const rate = await this.rateProvider.getRateAsOf({
        sourceCurrency: candidate.currency,
        targetCurrency: functionalCurrency,
        boundaryAt: candidate.rateBoundaryAt,
      });
      if (!rate) {
        result.skipped.push({
          sourceType: candidate.sourceType,
          sourceId: candidate.sourceId,
          issue: 'MISSING_RATE',
        });
        continue;
      }

      const evidence = buildAppliedFxEvidence({
        originalAmount: candidate.amount,
        originalCurrency: candidate.currency,
        functionalCurrency,
        exchangeRate: rate.tasa,
        convertedAmount: candidate.amount * rate.tasa,
        rateEffectiveAt: rate.fechaVigencia,
        source: 'current-balance-fx-capture',
        fxCatalogRateId: rate.tasaId,
      });
      const existing = await this.db.fxEvidence.findUnique({
        where: {
          tenantId_sourceType_sourceId_evidenceFingerprint: {
            tenantId: input.tenantId,
            sourceType: candidate.sourceType,
            sourceId: candidate.sourceId,
            evidenceFingerprint: evidence.fxEvidenceFingerprint,
          },
        },
        select: { fxEvidenceId: true },
      });
      if (existing) {
        result.idempotentCount += 1;
        continue;
      }

      try {
        await this.db.fxEvidence.create({
          data: {
          tenantId: input.tenantId,
          sourceType: candidate.sourceType,
          sourceId: candidate.sourceId,
          originalAmount: candidate.amount,
          originalCurrency: candidate.currency.trim().toUpperCase(),
          functionalAmount: candidate.amount * rate.tasa,
          functionalCurrency,
          exchangeRate: rate.tasa,
          rateEffectiveAt: rate.fechaVigencia,
          cutoffAt: candidate.cutoffAt,
          fxCatalogRateId: rate.tasaId,
          provenance: evidence.fxProvenanceKind,
          source: evidence.fxProvenanceSource,
          evidence: evidence as unknown as Prisma.InputJsonValue,
          evidenceFingerprint: evidence.fxEvidenceFingerprint,
          evidenceVersion: evidence.fxEvidenceVersion,
            capturedAt,
          },
        });
        result.capturedCount += 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          result.idempotentCount += 1;
          continue;
        }
        throw error;
      }
    }

    result.skippedCount = result.skipped.length;
    return result;
  }
}

export const fxEvidenceService = createFxEvidenceService();
